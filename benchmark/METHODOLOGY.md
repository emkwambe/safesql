# SafeSQL Pro Benchmark — Methodology

**Version:** 1.0 · **Written:** 26 August 2026 · **Status:** approved before any query was run

This document defines how a benchmark result is classified. It was written and
approved **before** the first query executed, so the classification rules could
not be tuned to flatter the results. Every number published on `/benchmark`
follows the definitions below.

---

## 1. What is under test

**33 deterministic detectors** (`src/config/detectorTiers.ts` → `PRO_DETECTOR_SLUGS`).

The count is 33, not 36. `D1`–`D36` is a *specification* sequence, not a detector
count: D34 was completed by the pre-existing `AMBIGUOUS_COLUMN`, D35 by an
enhancement to `UNKNOWN_ALIAS`, and D36 by an extension of `HALLUCINATED_COLUMN`.

**Excluded from the count and from scoring:**

| Excluded | Why |
|---|---|
| `SYNTAX_ERROR` | A parse failure, not a detection. Reported separately as a parse-rate statistic. |
| `CUSTOM_RULE` | A Business-tier engine driven by caller-supplied rules, not a built-in detector. No rules are supplied to the benchmark. |

---

## 2. Classification

Classification is **per (query, detector) pair**, not per query. One query can
contribute a TP for one detector and a TN for thirty-two others.

| | Detector fired | Detector did not fire |
|---|---|---|
| **Pattern is a genuine defect** | **TP** — true positive | **FN** — false negative |
| **Pattern is intentional and correct** | **FP** — false positive | **TN** — true negative |

Stated as the approved definitions:

- **TP** — the detector fires, the pattern is unintentional, and it would produce
  wrong results.
- **FP** — the detector fires, but the pattern is intentional and correct.
- **FN** — the detector does not fire when it should have.
- **TN** — the detector does not fire, correctly.

**Precision** = TP / (TP + FP) · **Recall** = TP / (TP + FN)

Both are reported per detector and in aggregate. A detector with zero
opportunities in a dataset reports `n/a`, never `0` or `100%` — a structural
absence must not read as a score.

---

## 3. Ambiguous cases — decided in advance

These five patterns are the ones where "fires correctly on the pattern" and
"correct for the use case" come apart. Each is classified as follows, regardless
of what it does to the headline numbers.

| # | Pattern | Classification |
|---|---|---|
| 1 | **Deliberate `CROSS JOIN`** — e.g. a date-spine build (`SELECT * FROM dates CROSS JOIN metrics`) | **FP if fired.** A date spine is the correct construction, not a defect. |
| 2 | **`SELECT *` inside a CTE or subquery** | **FP if fired.** `SELECT *` is acceptable inside a CTE; only a final-projection `SELECT *` is a finding. Firing on the CTE alone is a false positive. |
| 3 | **`INNER JOIN` on a nullable FK where NULLs are intentionally excluded** | **FP if fired.** The author knows the NULL rows should drop. |
| 4 | **Missing `WHERE` on a small reference table** (< 500 rows) | **FP if fired.** An unfiltered scan of a 200-row lookup table is not a defect. |
| 5 | **Fan-out `JOIN` correctly pre-aggregated in a CTE** | **TN if not fired.** This is the reference-correct construction and the detector is right to stay silent. If it *does* fire, that is an **FP**. |

Any case not on this list that a reviewer judges ambiguous is logged in
`review_required.txt` with a written rationale and resolved before publication —
it is never silently assigned.

---

## 4. Counting rules for overlapping detectors

Two structural facts about the engine would distort naive counting. Both are
handled explicitly.

### 4.1 The fan-out family

Four detectors can fire on a single fan-out defect:

`JOIN_MULTIPLICATION` · `AGGREGATION_GRAIN_MISMATCH` ·
`AGGREGATE_OVER_FANOUT_JOIN` · `MULTIPLE_ONE_TO_MANY_JOINS`

**Rule:** each is scored **independently against its own trigger condition**. A
query that legitimately satisfies three of the four conditions yields three TPs,
because each detector correctly identified the condition it exists to identify.

**But** the published summary additionally reports a **defect-level** count —
"N distinct defects detected" — alongside the detector-level count, so a single
inflated revenue figure caught four ways is not presented as four catches. Both
numbers appear. The detector-level table never stands alone.

### 4.2 One detector id, many triggers

`DIALECT_MISMATCH` has three producer functions and eight distinct triggers;
`MISSING_TIME_FILTER` has two; `HALLUCINATED_COLUMN` has three emit sites.

**Rule:** counted **once per (query, detector-id)**, not once per trigger or per
emit site. A query tripping two `DIALECT_MISMATCH` triggers is one TP. This
matches how a user experiences the result and prevents multi-trigger detectors
from dominating the totals.

---

## 5. Datasets

| Dataset | Source | Ground truth | Phase |
|---|---|---|---|
| **Seeded defects** | Authored for this benchmark — 33 queries, one per detector | Known by construction: the target detector *must* fire | 1 |
| **Seeded clean** | 33 controls, each the corrected form of its defect pair | Known by construction: **no** detector should fire | 1 |
| **Adversarial** | 20 queries that look wrong but are correct, or look right but are wrong | Hand-labelled, rationale recorded per query | 1 |
| **Spider dev** | 1,034 queries / 200 DBs | Expert-written, presumed correct → a firing is a **candidate FP** pending review | 2 |
| **BIRD dev** | 1,534 queries / 11 DBs | As Spider | 2 |

The seeded and adversarial suites measure **recall and precision against known
ground truth**. Spider and BIRD measure **false-positive rate against
expert-written SQL**. They answer different questions and their numbers are
never merged into a single headline figure.

### 5.1 Known limitation — dialect

Spider and BIRD are **SQLite**. SafeSQL parses via `node-sql-parser` with a
PostgreSQL, MySQL, BigQuery or Snowflake grammar; there is no SQLite grammar.
Queries that fail to parse return `SYNTAX_ERROR` and are **excluded from
precision and recall entirely**, then reported as a separate **parse rate**.
Silently dropping them would inflate precision; counting them as TNs would
inflate it further.

### 5.2 Known limitation — schemas

Ten of the 33 detectors are schema-dependent (`HALLUCINATED_TABLE`,
`HALLUCINATED_COLUMN`, `INNER_JOIN_NULL_EXCLUSION`, `NOT_IN_NULLABLE`,
`AVG_OVER_NULLABLE`, `INTEGER_DIVISION_RISK`, `JOIN_MULTIPLICATION`,
`SUSPICIOUS_JOIN_KEY`, `MISSING_TIME_FILTER`, `COUNT_STAR_VS_COUNT_COL`). Run
without DDL they cannot fire, and their silence is a **structural zero, not a
recall failure**. Any run without schemas reports those ten as `n/a`.

---

## 6. Human review — required before publication

The harness is not permitted to publish a verdict on its own.

1. Every query where **FP > 0** is written to `results/{dataset}_review_required.txt`.
2. A human inspects each against §3 and records: FP confirmed, or reclassified
   as TP with a rationale.
3. Only after review does a final FP count exist.

Until review completes, the summary states — verbatim, and this string is
enforced by the harness:

> X false positives observed in automated run.
> Y queries flagged for human review.
> Final FP count pending manual review.

**No artifact produced by this benchmark may claim "0% false positives" or
"zero false positives" at any point.** If a completed human review supports it,
the permitted phrasing is exactly:

> Zero false positives observed in this benchmark.

— a scoped observation about one run over named datasets, never a property of
the product.

---

## 7. What this benchmark is, and is not

**It is publicly reproducible.** The harness, the seeded corpora, the schemas and
the classification rules are in the repository. Anyone can clone it and re-run
it, and the reproduction commands are published alongside the results.

**It is not independently verified.** It was designed, run and reviewed by the
vendor. The seeded and adversarial suites in particular were authored by the
same party that wrote the detectors, which is a real limitation: they establish
that a detector fires when its own author intended it to. Spider and BIRD are
the external check, and they are external precisely because we did not write
them.

We publish whatever the numbers show, including detectors that score poorly.

---

## 8. Comparison claims

The benchmark measures SafeSQL Pro. It does not run competitors, and therefore
supports **no comparative claim** about them.

One correction is recorded here because it has repeatedly resurfaced:
**SQLSure detects fan-out aggregates.** Its `FANOUT` rule is "SUM/COUNT of
additive measure after one-to-many join" — the same condition as
`AGGREGATE_OVER_FANOUT_JOIN` — and its `CHASM` rule matches
`MULTIPLE_ONE_TO_MANY_JOINS`. Both are error-level in their engine and both are
covered by their own published BIRD/Spider audit. **Fan-out detection is parity
and must not be presented as a differentiator** on the benchmark page or
anywhere else.

Defensible differentiators, none of which require a comparative benchmark to
state: detector breadth (33 vs 9), the executable synthetic proof (SafeSQL runs
the query on schema-matched synthetic data and shows the actual row inflation;
SQLSure is static-only), and the hosted, retained audit trail with approvals.

---

*Mpingo Systems LLC · SafeSQL Pro · benchmark methodology v1.0*
