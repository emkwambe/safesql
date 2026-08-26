"""SafeSQL Pro benchmark — adversarial corpus (20 queries).

Two kinds, both designed to be hard:

  LOOKS WRONG / IS CORRECT  -> emitted to clean/   -> expects NO detector to fire.
                               Any firing is a candidate false positive.
  LOOKS RIGHT / IS WRONG    -> emitted to defects/ -> expects its target to fire.
                               Silence is a false negative.

The first five "looks wrong" cases are the five ambiguous patterns enumerated in
METHODOLOGY.md §3, so the published FP rate is measured against the exact rules
that were approved before any query ran — not against a friendlier set.

Regenerate with:  python benchmark/adversarial/_corpus.py
"""

import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# (case_id, kind, expected_detectors, rationale, sql)
#   kind "clean"  -> expected must be []
#   kind "defect" -> expected is the detector that SHOULD fire
CORPUS = [
    # ── Looks wrong, is correct (expect silence) ─────────────────────────────
    (
        "A01_date_spine_cross_join", "clean", [],
        "METHODOLOGY 3.1 - a date spine is the correct construction for a "
        "dense calendar, not a defect. Firing here is an FP.",
        "-- Dense monthly calendar per plan: a date spine. Intentional CROSS JOIN.\n"
        "WITH months AS (\n"
        "  SELECT DATE '2026-01-01' AS month\n"
        "  UNION ALL SELECT DATE '2026-02-01'\n"
        "  UNION ALL SELECT DATE '2026-03-01'\n"
        "), plans AS (\n"
        "  SELECT DISTINCT c.plan FROM customers c\n"
        ")\n"
        "SELECT plans.plan, months.month\n"
        "FROM plans CROSS JOIN months;",
    ),
    (
        "A02_select_star_in_cte", "clean", [],
        "METHODOLOGY 3.2 - SELECT * inside a CTE is acceptable; only a final "
        "projection SELECT * is a finding. The final projection here is explicit.",
        "WITH recent AS (\n"
        "  SELECT * FROM payments WHERE paid_at >= DATE '2026-01-01'\n"
        ")\n"
        "SELECT recent.id, recent.amount FROM recent;",
    ),
    (
        "A03_inner_join_nulls_intentional", "clean", [],
        "METHODOLOGY 3.3 - the author intends to drop payments with no customer. "
        "Firing is an FP.",
        "-- Deliberately excludes orphaned payments: unattributed revenue is\n"
        "-- reported separately and must not appear here.\n"
        "SELECT p.id, p.amount, c.email\n"
        "FROM payments p\n"
        "JOIN customers c ON c.id = p.customer_id\n"
        "WHERE p.status = 'succeeded';",
    ),
    (
        "A04_unfiltered_small_reference_table", "clean", [],
        "METHODOLOGY 3.4 - countries is a <500-row reference table; an "
        "unfiltered scan is correct.",
        "SELECT co.code, co.name, co.region FROM countries co ORDER BY co.name;",
    ),
    (
        "A05_fanout_preaggregated_in_cte", "clean", [],
        "METHODOLOGY 3.5 - the reference-correct fix for a fan-out. The "
        "detector is right to stay silent; firing is an FP.",
        "WITH pay AS (\n"
        "  SELECT p.customer_id, SUM(p.amount) AS revenue\n"
        "  FROM payments p\n"
        "  WHERE p.status = 'succeeded'\n"
        "  GROUP BY p.customer_id\n"
        ")\n"
        "SELECT c.plan, SUM(pay.revenue) AS total_revenue\n"
        "FROM customers c\n"
        "JOIN pay ON pay.customer_id = c.id\n"
        "GROUP BY c.plan;",
    ),
    (
        "A06_comma_join_properly_related", "clean", [],
        "Pre-ANSI-92 join syntax, correctly related in WHERE. Regression guard "
        "for the comma-join detection added after Phase 1.",
        "SELECT c.id, p.amount\n"
        "FROM customers c, payments p\n"
        "WHERE p.customer_id = c.id AND p.status = 'succeeded';",
    ),
    (
        "A07_not_in_over_non_nullable", "clean", [],
        "NOT IN is only dangerous over a nullable column. countries.code is a "
        "NOT NULL primary key, so this is safe.",
        "SELECT c.id FROM customers c\n"
        "WHERE c.country NOT IN (SELECT co.code FROM countries co WHERE co.region = 'EU');",
    ),
    (
        "A08_deterministic_window", "clean", [],
        "ORDER BY carries a unique tie-breaker, so row numbering is stable.",
        "SELECT c.id,\n"
        "       ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at, c.id) AS rn\n"
        "FROM customers c;",
    ),
    (
        "A09_guarded_integer_division", "clean", [],
        "Numerator cast to numeric and denominator NULLIF-guarded: neither "
        "truncation nor divide-by-zero applies.",
        "SELECT u.customer_id,\n"
        "       CAST(u.queries_failed AS NUMERIC) / NULLIF(u.queries_run, 0) AS failure_rate\n"
        "FROM usage_counters u;",
    ),
    (
        "A10_count_star_no_join", "clean", [],
        "COUNT(*) is only misleading after a child join. There is no join here.",
        "SELECT c.plan, COUNT(*) AS n FROM customers c GROUP BY c.plan;",
    ),

    # ── Looks right, is wrong (expect a finding) ─────────────────────────────
    (
        "A11_fanout_hidden_in_cte", "defect", ["AGGREGATE_OVER_FANOUT_JOIN"],
        "The CTE looks like pre-aggregation but does not aggregate - it joins. "
        "The SUM outside is still inflated.",
        "WITH joined AS (\n"
        "  SELECT c.plan, p.amount\n"
        "  FROM customers c\n"
        "  JOIN subscriptions s ON s.customer_id = c.id\n"
        "  JOIN payments p ON p.customer_id = c.id\n"
        ")\n"
        "SELECT joined.plan, SUM(joined.amount) AS total FROM joined GROUP BY joined.plan;",
    ),
    (
        "A12_left_join_filter_looks_intentional", "defect", ["LEFT_JOIN_FILTERED_IN_WHERE"],
        "The comment claims the LEFT JOIN is preserved, but the WHERE predicate "
        "on the right side silently converts it to an INNER JOIN.",
        "-- Keep every customer, including those with no successful payment.\n"
        "SELECT c.id, p.amount\n"
        "FROM customers c\n"
        "LEFT JOIN payments p ON p.customer_id = c.id\n"
        "WHERE p.status = 'succeeded';",
    ),
    (
        "A13_null_equality_in_or_branch", "defect", ["NULL_EQUALITY_COMPARISON"],
        "The = NULL is buried in an OR branch and looks like a null check.",
        "SELECT c.id FROM customers c\n"
        "WHERE c.plan = 'pro' OR c.country = NULL;",
    ),
    (
        "A14_not_in_nullable_looks_guarded", "defect", ["NOT_IN_NULLABLE"],
        "The WHERE inside the subquery looks protective but does not exclude "
        "NULL customer_id, so NOT IN can still collapse to zero rows.",
        "SELECT c.id FROM customers c\n"
        "WHERE c.id NOT IN (\n"
        "  SELECT p.customer_id FROM payments p WHERE p.status = 'succeeded'\n"
        ");",
    ),
    (
        "A15_integer_division_inside_avg", "defect", ["INTEGER_DIVISION_RISK"],
        "Wrapping an integer division in AVG does not stop the truncation - "
        "each row truncates to 0 or 1 before averaging.",
        "SELECT AVG(u.queries_failed / u.queries_run) AS avg_failure_rate\n"
        "FROM usage_counters u;",
    ),
    (
        "A16_select_star_final_of_cte_chain", "defect", ["SELECT_STAR_EXPENSIVE"],
        "Two CTEs make it look disciplined, but the final projection is "
        "SELECT * over the whole chain.",
        "WITH a AS (SELECT id, amount, customer_id FROM payments),\n"
        "     b AS (SELECT a.id, a.amount FROM a WHERE a.amount > 0)\n"
        "SELECT * FROM b;",
    ),
    (
        "A17_coalesce_join_key_looks_like_null_handling", "defect", ["COALESCE_IN_JOIN_KEY"],
        "COALESCE in the ON clause reads as defensive null handling but "
        "silently inflates matches and defeats the index.",
        "SELECT c.id, p.amount\n"
        "FROM customers c\n"
        "JOIN payments p ON COALESCE(p.customer_id, p.subscription_id) = c.id;",
    ),
    (
        "A18_window_order_non_unique", "defect", ["NON_DETERMINISTIC_WINDOW_ORDER"],
        "ORDER BY created_at looks deterministic but DATE has day granularity, "
        "so same-day customers tie and order arbitrarily.",
        "SELECT c.id, c.plan,\n"
        "       ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at DESC) AS rn\n"
        "FROM customers c;",
    ),
    (
        "A19_suspicious_key_disguised_by_alias", "defect", ["SUSPICIOUS_JOIN_KEY"],
        "Aliasing to cust/sub makes cust.id = sub.id read like a real "
        "relationship. It joins two unrelated surrogate keys.",
        "SELECT cust.email, sub.plan\n"
        "FROM customers cust\n"
        "JOIN subscriptions sub ON cust.id = sub.id\n"
        "WHERE sub.status = 'active';",
    ),
    (
        "A20_hallucinated_column_plausible_name", "defect", ["HALLUCINATED_COLUMN"],
        "churn_risk_score is exactly the sort of column an LLM invents: "
        "plausible, domain-appropriate, and not in the schema.",
        "SELECT c.id, c.email, c.churn_risk_score\n"
        "FROM customers c\n"
        "WHERE c.plan = 'business';",
    ),
]


def write(path, text):
    if not text.endswith("\n"):
        text += "\n"
    io.open(path, "w", encoding="utf-8", newline="\n").write(text)


def main():
    defects = os.path.join(HERE, "defects")
    clean = os.path.join(HERE, "clean")
    os.makedirs(defects, exist_ok=True)
    os.makedirs(clean, exist_ok=True)

    manifest = {
        "suite": "adversarial",
        "schema": "schema.sql",
        "dialect": "postgresql",
        "detector_count": 33,
        "methodology": "../METHODOLOGY.md",
        "cases": [],
    }

    for case_id, kind, expected, rationale, sql in CORPUS:
        assert kind in ("clean", "defect")
        if kind == "clean":
            assert not expected, case_id
        sub, folder = (clean, "clean") if kind == "clean" else (defects, "defects")
        write(os.path.join(sub, case_id + ".sql"), sql)
        entry = {
            "detector": case_id,
            "note": rationale,
            kind: folder + "/" + case_id + ".sql",
            "%s_expect_fires" % kind: expected,
        }
        manifest["cases"].append(entry)

    assert len(manifest["cases"]) == 20, len(manifest["cases"])
    io.open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8", newline="\n").write(
        json.dumps(manifest, indent=2) + "\n")
    n_clean = sum(1 for c in CORPUS if c[1] == "clean")
    print("wrote %d adversarial queries (%d looks-wrong-is-correct, %d looks-right-is-wrong)"
          % (len(CORPUS), n_clean, len(CORPUS) - n_clean))


if __name__ == "__main__":
    main()
