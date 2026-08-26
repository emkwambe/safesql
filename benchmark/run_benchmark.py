#!/usr/bin/env python3
"""SafeSQL Pro benchmark harness.

Classification follows benchmark/METHODOLOGY.md v1.0, which was written and
approved before any query ran. Read it before interpreting any number here.

Usage
-----
    # Local engine (default) - no API key, works from a fresh clone.
    python benchmark/run_benchmark.py --dataset seeded

    # Hosted API - needs a Pro key so all 33 detectors run.
    python benchmark/run_benchmark.py --dataset seeded \\
        --api-key $SAFESQL_API_KEY --api-url https://safesqlpro.dev/api/validate

Datasets: seeded | adversarial | spider | bird
Spider and BIRD are Phase 2 and exit with a clear message until their loaders
land.

Outputs (benchmark/results/):
    {dataset}_results.json
    {dataset}_summary.md
    {dataset}_review_required.txt
"""

import argparse
import io
import json
import os
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
RESULTS = os.path.join(HERE, "results")

DEFAULT_API_URL = "https://safesqlpro.dev/api/validate"

# METHODOLOGY.md sec.1 - excluded from the detector count and from scoring.
NOT_DETECTORS = {"SYNTAX_ERROR", "CUSTOM_RULE"}

# METHODOLOGY.md sec.6 - the exact pre-review wording. Enforced, not suggested.
PENDING_REVIEW_TEMPLATE = (
    "{fp} false positives observed in automated run.\n"
    "{flagged} queries flagged for human review.\n"
    "Final FP count pending manual review."
)

# METHODOLOGY.md sec.6 - phrasings this harness must never emit.
FORBIDDEN = ("0% false positive", "zero false positives", "no false positives")


# ── validation backends ──────────────────────────────────────────────────────

def validate_local(cases, dialect):
    """Run the bundled engine locally. No API key, no network, no rate limit.

    Drives benchmark/_local_runner.run.ts through Vitest, which imports the same
    validateSQL the product uses - so a local run and an API run exercise
    identical detector code. Vitest is used only for its module transform:
    node-sql-parser is CJS and Node's bare ESM interop cannot resolve its named
    exports.
    """
    import tempfile

    tmp = tempfile.mkdtemp(prefix="safesql-bench-")
    in_path = os.path.join(tmp, "in.json")
    out_path = os.path.join(tmp, "out.json")
    payload = json.dumps({"dialect": dialect, "cases": cases})
    with io.open(in_path, "w", encoding="utf-8", newline="") as fh:
        fh.write(payload)

    env = dict(os.environ, BENCH_IN=in_path, BENCH_OUT=out_path)
    npx = "npx.cmd" if os.name == "nt" else "npx"
    proc = subprocess.run(
        [npx, "vitest", "run", "--config", os.path.join(HERE, "vitest.config.ts")],
        capture_output=True, text=True, encoding="utf-8", cwd=REPO, env=env,
    )
    if proc.returncode != 0 or not os.path.exists(out_path):
        sys.stderr.write((proc.stdout or "")[-2500:])
        sys.stderr.write((proc.stderr or "")[-2500:])
        raise SystemExit("local runner failed (has `npm ci` been run?)")
    with io.open(out_path, encoding="utf-8") as fh:
        return json.loads(fh.read())


def validate_api(cases, dialect, api_key, api_url):
    """Run against the hosted REST API. Requires a Pro-or-above key.

    A free key returns only the 12 free detectors, which would understate recall
    on 21 of the 33 - so the tier is checked and the run aborts if it is free.
    """
    out = []
    for case in cases:
        body = json.dumps(
            {"sql": case["sql"], "ddl": case.get("ddl"), "dialect": dialect}
        ).encode("utf-8")
        req = urllib.request.Request(
            api_url,
            data=body,
            headers={
                "content-type": "application/json",
                "authorization": "Bearer " + api_key,
            },
        )
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                report = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise SystemExit(
                "API %s on %s: %s" % (e.code, case["id"], e.read().decode("utf-8")[:300])
            )
        elapsed = (time.perf_counter() - started) * 1000.0

        tier = report.get("tier")
        if tier == "free":
            raise SystemExit(
                "This API key is on the free plan, so only 12 of 33 detectors ran.\n"
                "The benchmark requires a Pro-or-above key. Aborting rather than\n"
                "publishing understated recall."
            )
        out.append(
            {
                "id": case["id"],
                "fired": _fired(report),
                "riskScore": report.get("riskScore"),
                "ms": report.get("processingMs", elapsed),
                "parsed": not _is_syntax_error(report),
                "tier": tier,
                "detectorsRun": report.get("detectorsRun"),
            }
        )
    return out


def _issues(report):
    return (
        (report.get("errors") or [])
        + (report.get("warnings") or [])
        + (report.get("suggestions") or [])
    )


def _fired(report):
    ids = []
    for issue in _issues(report):
        det = issue.get("id") or issue.get("issueType")
        if det and det not in NOT_DETECTORS and det not in ids:
            ids.append(det)  # METHODOLOGY sec.4.2 - once per (query, detector-id)
    return ids


def _is_syntax_error(report):
    return any(
        (i.get("id") or i.get("issueType")) == "SYNTAX_ERROR" for i in _issues(report)
    )


# ── dataset loaders ──────────────────────────────────────────────────────────

def load_seeded(name):
    root = os.path.join(HERE, name)
    manifest = json.loads(io.open(os.path.join(root, "manifest.json"), encoding="utf-8").read())
    ddl = io.open(os.path.join(root, manifest["schema"]), encoding="utf-8").read()
    cases = []
    for entry in manifest["cases"]:
        for kind in ("defect", "clean"):
            rel = entry.get(kind)
            if not rel:
                continue
            cases.append(
                {
                    "id": "%s/%s" % (kind, entry["detector"]),
                    "kind": kind,
                    "detector": entry["detector"],
                    "note": entry.get("note", ""),
                    "expect": entry["%s_expect_fires" % kind],
                    "sql": io.open(os.path.join(root, rel), encoding="utf-8").read(),
                    "ddl": ddl,
                }
            )
    return manifest, cases



def load_spider():
    """Spider dev set: 1,034 expert-written queries over 20 databases.

    Spider carries no defect labels - every query is presumed CORRECT. So each
    is loaded as kind="clean" with an empty expectation: any detector firing is
    a CANDIDATE false positive requiring human review, never an automatic one
    (METHODOLOGY sec.5).
    """
    root = os.path.join(HERE, "datasets", "spider")
    sys.path.insert(0, root)
    from _schema_to_ddl import load_tables, schema_to_ddl  # noqa: E402

    by_id = load_tables(os.path.join(root, "tables.json"))
    dev = json.loads(io.open(os.path.join(root, "dev.json"), encoding="utf-8").read())

    ddl_cache = {}
    cases = []
    for i, q in enumerate(dev):
        db_id = q["db_id"]
        if db_id not in ddl_cache:
            ddl_cache[db_id] = schema_to_ddl(by_id[db_id]) if db_id in by_id else ""
        cid = "spider/%04d_%s" % (i, db_id)
        cases.append({
            "id": cid,
            "kind": "clean",
            "detector": cid,
            "note": q.get("question", ""),
            "expect": [],
            "sql": q["query"],
            "ddl": ddl_cache[db_id],
        })
    manifest = {
        "suite": "spider",
        "source": "taoyds/spider dev.json + tables.json",
        "dialect": "postgresql (Spider is SQLite - see METHODOLOGY sec.5.1)",
        "query_count": len(cases),
        "db_count": len(ddl_cache),
    }
    return manifest, cases



def load_bird(limit=None):
    """BIRD dev set: 1,534 queries over 11 real SQLite databases.

    Like Spider, BIRD carries no defect labels - the gold SQL is presumed
    CORRECT - so every query loads as kind="clean" with an empty expectation and
    any firing is a CANDIDATE false positive (METHODOLOGY sec.5).

    Unlike Spider, the schemas come from live SQLite files, so they carry real
    types and NOT NULL constraints.
    """
    root = os.path.join(HERE, "datasets", "bird")
    sys.path.insert(0, root)
    from _schema_to_ddl import schema_to_ddl  # noqa: E402

    dev = json.loads(io.open(
        os.path.join(root, "dev_20240627", "dev.json"), encoding="utf-8").read())
    if limit:
        # Deterministic stride so a pilot spans all 11 databases rather than
        # just the first one.
        dev = dev[:: max(1, len(dev) // limit)][:limit]

    ddl_cache = {}
    cases = []
    for i, q in enumerate(dev):
        db_id = q["db_id"]
        if db_id not in ddl_cache:
            ddl_cache[db_id] = schema_to_ddl(db_id)
        cid = "bird/%04d_%s" % (q.get("question_id", i), db_id)
        cases.append({
            "id": cid,
            "kind": "clean",
            "detector": cid,
            "note": "%s | %s" % (q.get("difficulty", ""), q.get("question", "")[:120]),
            "expect": [],
            "sql": q["SQL"],
            "ddl": ddl_cache[db_id],
        })
    manifest = {
        "suite": "bird",
        "source": "BIRD dev_20240627 dev.json + SQLite PRAGMA introspection",
        "query_count": len(cases),
        "db_count": len(ddl_cache),
    }
    return manifest, cases


# ── scoring (METHODOLOGY.md sec.2) ───────────────────────────────────────────

def score(cases, runs):
    by_id = {r["id"]: r for r in runs}
    per_detector = {}
    rows = []

    def bucket(det):
        return per_detector.setdefault(det, {"TP": 0, "FP": 0, "FN": 0, "TN": 0, "ms": []})

    # Detector universe for TN counting. Prefer what the engine reports it ran
    # (always the 33); fall back to case targets for suites whose ids ARE
    # detector names.
    universe = set()
    for r in runs:
        if r.get("detectorsRun"):
            universe.update(r["detectorsRun"])
    all_detectors = sorted(universe) if universe else sorted({c["detector"] for c in cases})

    for case in cases:
        run = by_id[case["id"]]
        fired = set(run["fired"])
        expected = set(case["expect"])
        row = {
            "id": case["id"],
            "kind": case["kind"],
            "target": case["detector"],
            "expected": sorted(expected),
            "fired": sorted(fired),
            "riskScore": run["riskScore"],
            "ms": run["ms"],
            "parsed": run["parsed"],
            "tp": sorted(fired & expected),
            "fn": sorted(expected - fired),
            # Anything that fired but was not expected. On a clean control this
            # is a candidate FP; on a defect it is a co-firing detector and is
            # reviewed, not auto-counted (METHODOLOGY sec.4.1).
            "unexpected": sorted(fired - expected),
        }
        rows.append(row)

        for det in expected:
            b = bucket(det)
            if det in fired:
                b["TP"] += 1
            else:
                b["FN"] += 1
            b["ms"].append(run["ms"])

        if case["kind"] == "clean":
            # A clean control must fire nothing. Every firing is a candidate FP.
            for det in fired:
                bucket(det)["FP"] += 1
            for det in all_detectors:
                if det not in fired:
                    bucket(det)["TN"] += 1

    return rows, per_detector


def summarise(per_detector):
    out = []
    for det in sorted(per_detector):
        b = per_detector[det]
        tp, fp, fn, tn = b["TP"], b["FP"], b["FN"], b["TN"]
        precision = (tp / (tp + fp)) if (tp + fp) else None
        recall = (tp / (tp + fn)) if (tp + fn) else None
        ms = sorted(b["ms"])
        out.append(
            {
                "detector": det,
                "TP": tp,
                "FP": fp,
                "FN": fn,
                "TN": tn,
                "precision": precision,
                "recall": recall,
                "median_ms": statistics.median(ms) if ms else None,
                "p95_ms": ms[max(0, int(len(ms) * 0.95) - 1)] if ms else None,
            }
        )
    return out


def pct(v):
    return "n/a" if v is None else "%.1f%%" % (v * 100.0)


def num(v):
    return "n/a" if v is None else "%.2f" % v


def render_summary(dataset, manifest, rows, table, backend, dialect):
    tp = sum(r["TP"] for r in table)
    fp = sum(r["FP"] for r in table)
    fn = sum(r["FN"] for r in table)
    flagged = sum(1 for r in rows if r["unexpected"])
    unparsed = [r["id"] for r in rows if not r["parsed"]]

    lines = [
        "# SafeSQL Pro benchmark - `%s`" % dataset,
        "",
        "Run %s UTC | backend: **%s** | dialect: **%s** | detectors under test: **33**"
        % (time.strftime("%Y-%m-%d %H:%M", time.gmtime()), backend, dialect),
        "",
        "Classification follows [METHODOLOGY.md](../METHODOLOGY.md) v1.0, written",
        "and approved before the first query ran.",
        "",
        "## Headline",
        "",
        PENDING_REVIEW_TEMPLATE.format(fp=fp, flagged=flagged),
        "",
        "| | |",
        "|---|---|",
        "| Queries run | %d |" % len(rows),
        "| Parsed | %d / %d |" % (len(rows) - len(unparsed), len(rows)),
        "| True positives | %d |" % tp,
        "| False negatives | %d |" % fn,
        "| False positives (automated, pre-review) | %d |" % fp,
        "| Flagged for human review | %d |" % flagged,
        "",
        "## Per-detector",
        "",
        "| Detector | TP | FP | FN | TN | Precision | Recall | median ms | p95 ms |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in table:
        lines.append(
            "| `%s` | %d | %d | %d | %d | %s | %s | %s | %s |"
            % (
                r["detector"], r["TP"], r["FP"], r["FN"], r["TN"],
                pct(r["precision"]), pct(r["recall"]),
                num(r["median_ms"]), num(r["p95_ms"]),
            )
        )

    if unparsed:
        lines += ["", "## Did not parse", ""]
        lines += ["- `%s`" % i for i in unparsed]

    lines += [
        "",
        "## Reproduce",
        "",
        "```bash",
        "git clone https://github.com/mpingosystems/safesql",
        "cd safesql && npm ci",
        "python benchmark/run_benchmark.py --dataset %s" % dataset,
        "```",
        "",
        "No API key is required for the local backend: the harness runs the same",
        "engine the product ships. To run against the hosted API instead, add",
        "`--api-key $SAFESQL_API_KEY` (a Pro-or-above key - a free key runs only",
        "12 of 33 detectors and the harness will refuse it).",
        "",
    ]
    text = "\n".join(lines)

    lowered = text.lower()
    for phrase in FORBIDDEN:
        if phrase in lowered:
            raise SystemExit("summary contains forbidden claim %r (METHODOLOGY sec.6)" % phrase)
    return text


def render_review(dataset, rows):
    flagged = [r for r in rows if r["unexpected"]]
    lines = [
        "SafeSQL Pro benchmark - human review queue - dataset: %s" % dataset,
        "Generated %s UTC" % time.strftime("%Y-%m-%d %H:%M", time.gmtime()),
        "",
        "Every entry below fired a detector that the ground truth did not expect.",
        "Classify each against METHODOLOGY.md sec.3 (the five ambiguous cases) and",
        "sec.4.1 (fan-out family co-firing). A firing on a CLEAN control is a",
        "candidate false positive. A co-firing on a DEFECT is usually a correct",
        "second finding, but must be confirmed, not assumed.",
        "",
        "Final FP count pending manual review.",
        "=" * 72,
        "",
    ]
    if not flagged:
        lines.append("(nothing flagged)")
    for r in flagged:
        lines += [
            "[%s]  kind=%s" % (r["id"], r["kind"]),
            "  expected : %s" % (", ".join(r["expected"]) or "(none)"),
            "  fired    : %s" % ", ".join(r["fired"]),
            "  UNEXPECTED: %s" % ", ".join(r["unexpected"]),
            "  score    : %s" % r["riskScore"],
            "  verdict  : ____ (TP / FP + rationale)",
            "",
        ]
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description="SafeSQL Pro benchmark harness")
    ap.add_argument("--dataset", required=True,
                    choices=["seeded", "adversarial", "spider", "bird"])
    ap.add_argument("--api-key", default=os.environ.get("SAFESQL_API_KEY"))
    ap.add_argument("--api-url", default=DEFAULT_API_URL)
    ap.add_argument("--dialect", default="postgresql")
    ap.add_argument("--limit", type=int, default=None,
                    help="Pilot mode: sample N queries spread across all databases.")
    args = ap.parse_args()

    if args.dataset == "bird":
        manifest, cases = load_bird(limit=args.limit)
    elif args.dataset == "spider":
        manifest, cases = load_spider()
    else:
        manifest, cases = load_seeded(args.dataset)
    backend = "hosted API" if args.api_key else "local engine"
    runs = (
        validate_api(cases, args.dialect, args.api_key, args.api_url)
        if args.api_key
        else validate_local(cases, args.dialect)
    )

    rows, per_detector = score(cases, runs)
    table = summarise(per_detector)

    os.makedirs(RESULTS, exist_ok=True)
    out = {
        "dataset": args.dataset,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "backend": backend,
        "dialect": args.dialect,
        "detector_count": 33,
        "methodology": "METHODOLOGY.md v1.0",
        "review_status": "pending manual review",
        "per_detector": table,
        "queries": rows,
    }
    base = os.path.join(RESULTS, args.dataset)
    io.open(base + "_results.json", "w", encoding="utf-8", newline="\n").write(
        json.dumps(out, indent=2) + "\n")
    io.open(base + "_summary.md", "w", encoding="utf-8", newline="\n").write(
        render_summary(args.dataset, manifest, rows, table, backend, args.dialect))
    io.open(base + "_review_required.txt", "w", encoding="utf-8", newline="\n").write(
        render_review(args.dataset, rows))

    tp = sum(r["TP"] for r in table)
    fp = sum(r["FP"] for r in table)
    fn = sum(r["FN"] for r in table)
    print("dataset=%s backend=%s queries=%d" % (args.dataset, backend, len(rows)))
    print("TP=%d FP=%d FN=%d flagged=%d"
          % (tp, fp, fn, sum(1 for r in rows if r["unexpected"])))
    print("wrote %s_{results.json,summary.md,review_required.txt}" % base)


if __name__ == "__main__":
    main()
