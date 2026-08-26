"""SafeSQL Pro benchmark — seeded corpus definition.

This file is the SOURCE OF TRUTH for the seeded suite. Running it emits:

    benchmark/seeded/defects/<DETECTOR_ID>.sql   (33 files)
    benchmark/seeded/clean/<DETECTOR_ID>.sql     (33 files)
    benchmark/seeded/manifest.json               ground truth for the harness

Each defect query is authored to trigger exactly one target detector. Each clean
control is the corrected form of its pair and must trigger NOTHING.

Regenerate with:  python benchmark/seeded/_corpus.py
"""

import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# (detector_id, note, defect_sql, clean_sql)
CORPUS = [
    (
        "MISSING_WHERE_DESTRUCTIVE",
        "DELETE with no WHERE removes every row.",
        "DELETE FROM subscriptions;",
        "DELETE FROM subscriptions WHERE status = 'cancelled';",
    ),
    (
        "INCOMPLETE_GROUP_BY",
        "country is projected but not grouped.",
        "SELECT c.plan, c.country, SUM(s.amount) AS total\n"
        "FROM subscriptions s\n"
        "JOIN customers c ON c.id = s.customer_id\n"
        "GROUP BY c.plan;",
        "SELECT c.plan, c.country, SUM(s.amount) AS total\n"
        "FROM subscriptions s\n"
        "JOIN customers c ON c.id = s.customer_id\n"
        "GROUP BY c.plan, c.country;",
    ),
    (
        "CONTRADICTORY_FILTER",
        "plan cannot be both 'free' and 'pro'; returns zero rows.",
        "SELECT c.id FROM customers c WHERE c.plan = 'free' AND c.plan = 'pro';",
        "SELECT c.id FROM customers c WHERE c.plan IN ('free', 'pro');",
    ),
    (
        "JOIN_MULTIPLICATION",
        "One-to-many join duplicates each customer row per payment.",
        "SELECT c.id, c.email, p.amount\n"
        "FROM customers c\n"
        "JOIN payments p ON p.customer_id = c.id;",
        "SELECT c.id, c.email\nFROM customers c\nWHERE c.plan = 'pro';",
    ),
    (
        "SELECT_STAR_EXPENSIVE",
        "Unqualified SELECT * in the final projection.",
        "SELECT * FROM payments WHERE status = 'succeeded';",
        "SELECT id, amount, paid_at FROM payments WHERE status = 'succeeded';",
    ),
    (
        "INNER_JOIN_NULL_EXCLUSION",
        "INNER JOIN on a nullable FK silently drops unmatched payments.",
        "SELECT p.id, c.email\n"
        "FROM payments p\n"
        "JOIN customers c ON c.id = p.customer_id;",
        "SELECT p.id, c.email\n"
        "FROM payments p\n"
        "LEFT JOIN customers c ON c.id = p.customer_id;",
    ),
    (
        "AGGREGATION_GRAIN_MISMATCH",
        "Aggregate across a join with no GROUP BY.",
        "SELECT SUM(p.amount)\n"
        "FROM customers c\n"
        "JOIN payments p ON p.customer_id = c.id;",
        "SELECT SUM(p.amount) FROM payments p;",
    ),
    (
        "HALLUCINATED_TABLE",
        "Table 'invoices' is not in the schema.",
        "SELECT i.id, i.total FROM invoices i WHERE i.total > 100;",
        "SELECT p.id, p.amount FROM payments p WHERE p.amount > 100;",
    ),
    (
        "HALLUCINATED_COLUMN",
        "Column 'lifetime_value' does not exist on customers.",
        "SELECT c.id, c.lifetime_value FROM customers c;",
        "SELECT c.id, c.plan FROM customers c;",
    ),
    (
        "NULL_EQUALITY_COMPARISON",
        "= NULL never matches any row.",
        "SELECT c.id FROM customers c WHERE c.country = NULL;",
        "SELECT c.id FROM customers c WHERE c.country IS NULL;",
    ),
    (
        "NOT_IN_NULLABLE",
        "NOT IN over a nullable column returns zero rows if any NULL is present.",
        "SELECT c.id\nFROM customers c\n"
        "WHERE c.id NOT IN (SELECT p.customer_id FROM payments p);",
        "SELECT c.id\nFROM customers c\n"
        "WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.customer_id = c.id);",
    ),
    (
        "AVG_OVER_NULLABLE",
        "AVG skips NULL amounts, changing the denominator.",
        "SELECT AVG(s.amount) AS avg_amount FROM subscriptions s;",
        "SELECT AVG(COALESCE(s.amount, 0)) AS avg_amount FROM subscriptions s;",
    ),
    (
        "UNKNOWN_ALIAS",
        "Alias 'x' is never defined.",
        "SELECT x.id FROM customers c;",
        "SELECT c.id FROM customers c;",
    ),
    (
        "AMBIGUOUS_COLUMN",
        "'plan' exists on both customers and subscriptions.",
        "SELECT plan\nFROM customers c\n"
        "JOIN subscriptions s ON s.customer_id = c.id;",
        "SELECT c.plan\nFROM customers c\n"
        "JOIN subscriptions s ON s.customer_id = c.id;",
    ),
    (
        "LEFT_JOIN_FILTERED_IN_WHERE",
        "WHERE on the right table silently converts LEFT JOIN to INNER.",
        "SELECT c.id, p.amount\n"
        "FROM customers c\n"
        "LEFT JOIN payments p ON p.customer_id = c.id\n"
        "WHERE p.status = 'succeeded';",
        "SELECT c.id, p.amount\n"
        "FROM customers c\n"
        "LEFT JOIN payments p ON p.customer_id = c.id AND p.status = 'succeeded';",
    ),
    (
        "SUSPICIOUS_JOIN_KEY",
        "Joining two unrelated surrogate keys.",
        "SELECT c.id, s.plan\nFROM customers c\nJOIN subscriptions s ON c.id = s.id;",
        "SELECT c.id, s.plan\n"
        "FROM customers c\nJOIN subscriptions s ON s.customer_id = c.id;",
    ),
    (
        "CARTESIAN_JOIN",
        "Implicit cross product via comma join with no predicate.",
        "SELECT c.id, p.amount FROM customers c, payments p;",
        "SELECT c.id, p.amount\n"
        "FROM customers c, payments p\nWHERE p.customer_id = c.id;",
    ),
    (
        "CROSS_JOIN_RISK",
        "Explicit CROSS JOIN produces N x M rows.",
        "SELECT c.id, p.amount FROM customers c CROSS JOIN payments p;",
        "SELECT c.id, p.amount\n"
        "FROM customers c\nJOIN payments p ON p.customer_id = c.id;",
    ),
    (
        "AGGREGATE_OVER_FANOUT_JOIN",
        "FLAGSHIP. Copied verbatim from the product demo query in Editor.tsx.",
        "-- Monthly revenue by plan - for the board deck\n"
        "-- Looks right. Ran without errors. Numbers are wrong by 3-10x.\n"
        "SELECT\n"
        "  c.plan,\n"
        "  DATE_TRUNC('month', p.paid_at) AS month,\n"
        "  SUM(p.amount) AS total_revenue,\n"
        "  COUNT(DISTINCT c.id) AS paying_customers\n"
        "FROM customers c\n"
        "JOIN subscriptions s ON s.customer_id = c.id\n"
        "JOIN payments p ON p.customer_id = c.id\n"
        "WHERE p.status = 'succeeded'\n"
        "  AND p.paid_at >= '2026-01-01'\n"
        "GROUP BY c.plan, DATE_TRUNC('month', p.paid_at)\n"
        "ORDER BY DATE_TRUNC('month', p.paid_at) DESC, total_revenue DESC;",
        "-- Corrected: pre-aggregate payments to one row per customer before joining.\n"
        "WITH pay AS (\n"
        "  SELECT p.customer_id, DATE_TRUNC('month', p.paid_at) AS month,\n"
        "         SUM(p.amount) AS revenue\n"
        "  FROM payments p\n"
        "  WHERE p.status = 'succeeded' AND p.paid_at >= '2026-01-01'\n"
        "  GROUP BY p.customer_id, DATE_TRUNC('month', p.paid_at)\n"
        ")\n"
        "SELECT c.plan, pay.month, SUM(pay.revenue) AS total_revenue\n"
        "FROM customers c\n"
        "JOIN pay ON pay.customer_id = c.id\n"
        "GROUP BY c.plan, pay.month;",
    ),
    (
        "MULTIPLE_ONE_TO_MANY_JOINS",
        "Chasm trap: two child tables cross-multiply.",
        "SELECT c.id, s.plan, p.amount\n"
        "FROM customers c\n"
        "JOIN subscriptions s ON s.customer_id = c.id\n"
        "JOIN payments p ON p.customer_id = c.id;",
        "WITH s AS (\n"
        "  SELECT customer_id, SUM(amount) AS subs FROM subscriptions GROUP BY customer_id\n"
        "), p AS (\n"
        "  SELECT customer_id, SUM(amount) AS pays FROM payments GROUP BY customer_id\n"
        ")\n"
        "SELECT c.id, s.subs, p.pays\n"
        "FROM customers c\n"
        "JOIN s ON s.customer_id = c.id\n"
        "JOIN p ON p.customer_id = c.id;",
    ),
    (
        "SCD_JOIN_WITHOUT_EFFECTIVE_DATE",
        "SCD dimension joined without a validity window.",
        "SELECT c.id, d.segment\n"
        "FROM customers c\n"
        "JOIN customer_history d ON d.customer_id = c.id;",
        "SELECT c.id, d.segment\n"
        "FROM customers c\n"
        "JOIN customer_history d ON d.customer_id = c.id\n"
        "  AND d.valid_from <= CURRENT_DATE AND d.valid_to > CURRENT_DATE;",
    ),
    (
        "INTEGER_DIVISION_RISK",
        "INT / INT truncates toward zero.",
        "SELECT u.customer_id, u.queries_failed / u.queries_run AS failure_rate\n"
        "FROM usage_counters u;",
        "SELECT u.customer_id,\n"
        "       u.queries_failed * 1.0 / NULLIF(u.queries_run, 0) AS failure_rate\n"
        "FROM usage_counters u;",
    ),
    (
        "COUNT_PARENT_AFTER_CHILD_JOIN",
        "COUNT(*) counts joined payment rows, not customers.",
        "SELECT c.plan, COUNT(*) AS customer_count\n"
        "FROM customers c\n"
        "JOIN payments p ON p.customer_id = c.id\n"
        "GROUP BY c.plan;",
        "SELECT c.plan, COUNT(DISTINCT c.id) AS customer_count\n"
        "FROM customers c\n"
        "JOIN payments p ON p.customer_id = c.id\n"
        "GROUP BY c.plan;",
    ),
    (
        "COUNT_STAR_VS_COUNT_COL",
        "COUNT(country) silently skips NULL countries.",
        "SELECT COUNT(c.country) AS n FROM customers c;",
        "SELECT COUNT(*) AS n FROM customers c;",
    ),
    (
        "HAVING_WITHOUT_GROUP_BY",
        "HAVING with no GROUP BY.",
        "SELECT SUM(p.amount) AS total FROM payments p HAVING SUM(p.amount) > 1000;",
        "SELECT p.customer_id, SUM(p.amount) AS total\n"
        "FROM payments p\n"
        "GROUP BY p.customer_id\n"
        "HAVING SUM(p.amount) > 1000;",
    ),
    (
        "MISSING_TIME_FILTER",
        "Unbounded scan of an append-only event table.",
        "SELECT e.id, e.event_type, e.event_value\n"
        "FROM events e;",
        "SELECT e.id, e.event_type, e.event_value\n"
        "FROM events e\n"
        "WHERE e.occurred_at >= TIMESTAMP '2026-01-01 00:00:00';",
    ),
    (
        "DIALECT_MISMATCH",
        "QUALIFY is Snowflake/BigQuery syntax, not PostgreSQL.",
        "SELECT c.id, c.plan,\n"
        "       ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at) AS rn\n"
        "FROM customers c\n"
        "QUALIFY rn = 1;",
        "WITH ranked AS (\n"
        "  SELECT c.id, c.plan,\n"
        "         ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at, c.id) AS rn\n"
        "  FROM customers c\n"
        ")\n"
        "SELECT id, plan FROM ranked WHERE rn = 1;",
    ),
    (
        "NON_DETERMINISTIC_WINDOW_ORDER",
        "ORDER BY created_at has no tie-breaker; ties order arbitrarily.",
        "SELECT c.id,\n"
        "       ROW_NUMBER() OVER (ORDER BY c.created_at) AS rn\n"
        "FROM customers c;",
        "SELECT c.id,\n"
        "       ROW_NUMBER() OVER (ORDER BY c.created_at, c.id) AS rn\n"
        "FROM customers c;",
    ),
    (
        "DESTRUCTIVE_DDL",
        "DROP TABLE is irreversible.",
        "DROP TABLE payments;",
        "SELECT COUNT(*) AS n FROM payments p;",
    ),
    (
        "DESTRUCTIVE_TRUNCATE",
        "TRUNCATE removes every row.",
        "TRUNCATE TABLE payments;",
        "DELETE FROM payments WHERE status = 'failed';",
    ),
    (
        "COALESCE_IN_JOIN_KEY",
        "COALESCE in the ON clause defeats the index and inflates matches.",
        "SELECT c.id, p.amount\n"
        "FROM customers c\n"
        "JOIN payments p ON COALESCE(p.customer_id, c.id) = c.id;",
        "SELECT c.id, p.amount\n"
        "FROM customers c\n"
        "JOIN payments p ON p.customer_id = c.id;",
    ),
    (
        "IMPLICIT_TIMEZONE",
        "TIMESTAMP compared to a timezone-naive string literal.",
        "SELECT e.id FROM events e WHERE e.occurred_at >= '2026-01-01';",
        "SELECT e.id\nFROM events e\n"
        "WHERE e.occurred_at >= TIMESTAMP '2026-01-01 00:00:00';",
    ),
    (
        "WINDOW_MISSING_ORDER",
        "Window function with no ORDER BY at all.",
        "SELECT c.id, ROW_NUMBER() OVER () AS rn FROM customers c;",
        "SELECT c.id, ROW_NUMBER() OVER (ORDER BY c.created_at, c.id) AS rn\n"
        "FROM customers c;",
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
        "suite": "seeded",
        "schema": "schema.sql",
        "dialect": "postgresql",
        "detector_count": 33,
        "methodology": "../METHODOLOGY.md",
        "cases": [],
    }

    seen = set()
    for det, note, bad, good in CORPUS:
        assert det not in seen, "duplicate detector: " + det
        seen.add(det)
        write(os.path.join(defects, det + ".sql"), bad)
        write(os.path.join(clean, det + ".sql"), good)
        manifest["cases"].append(
            {
                "detector": det,
                "note": note,
                "defect": "defects/" + det + ".sql",
                "clean": "clean/" + det + ".sql",
                # Ground truth: the defect MUST trigger `detector`; the clean
                # control MUST trigger nothing at all.
                "defect_expect_fires": [det],
                "clean_expect_fires": [],
            }
        )

    assert len(manifest["cases"]) == 33, len(manifest["cases"])
    io.open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8", newline="\n").write(
        json.dumps(manifest, indent=2) + "\n"
    )
    print("wrote %d defect + %d clean queries + manifest.json" % (len(CORPUS), len(CORPUS)))


if __name__ == "__main__":
    main()
