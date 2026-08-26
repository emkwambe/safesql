# SafeSQL Pro benchmark - `seeded`

Run 2026-08-26 16:28 UTC | backend: **local engine** | dialect: **postgresql** | detectors under test: **33**

Classification follows [METHODOLOGY.md](../METHODOLOGY.md) v1.0, written
and approved before the first query ran.

## Headline

13 false positives observed in automated run.
21 queries flagged for human review.
Final FP count pending manual review.

| | |
|---|---|
| Queries run | 66 |
| Parsed | 66 / 66 |
| True positives | 33 |
| False negatives | 0 |
| False positives (automated, pre-review) | 13 |
| Flagged for human review | 21 |

## Per-detector

| Detector | TP | FP | FN | TN | Precision | Recall | median ms | p95 ms |
|---|---|---|---|---|---|---|---|---|
| `AGGREGATE_OVER_FANOUT_JOIN` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 4.48 | 4.48 |
| `AGGREGATION_GRAIN_MISMATCH` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.76 | 0.76 |
| `AMBIGUOUS_COLUMN` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.87 | 0.87 |
| `AVG_OVER_NULLABLE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.64 | 0.64 |
| `CARTESIAN_JOIN` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.62 | 0.62 |
| `COALESCE_IN_JOIN_KEY` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 2.21 | 2.21 |
| `CONTRADICTORY_FILTER` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 2.24 | 2.24 |
| `COUNT_PARENT_AFTER_CHILD_JOIN` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.75 | 0.75 |
| `COUNT_STAR_VS_COUNT_COL` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.61 | 0.61 |
| `CROSS_JOIN_RISK` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.64 | 0.64 |
| `DESTRUCTIVE_DDL` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.34 | 0.34 |
| `DESTRUCTIVE_TRUNCATE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.42 | 0.42 |
| `DIALECT_MISMATCH` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 2.16 | 2.16 |
| `HALLUCINATED_COLUMN` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.85 | 0.85 |
| `HALLUCINATED_TABLE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 1.43 | 1.43 |
| `HAVING_WITHOUT_GROUP_BY` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.54 | 0.54 |
| `IMPLICIT_TIMEZONE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.51 | 0.51 |
| `INCOMPLETE_GROUP_BY` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 5.31 | 5.31 |
| `INNER_JOIN_NULL_EXCLUSION` | 1 | 6 | 0 | 27 | 14.3% | 100.0% | 1.20 | 1.20 |
| `INTEGER_DIVISION_RISK` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.84 | 0.84 |
| `JOIN_MULTIPLICATION` | 1 | 7 | 0 | 26 | 12.5% | 100.0% | 1.46 | 1.46 |
| `LEFT_JOIN_FILTERED_IN_WHERE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 1.19 | 1.19 |
| `MISSING_TIME_FILTER` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 1.25 | 1.25 |
| `MISSING_WHERE_DESTRUCTIVE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 5.77 | 5.77 |
| `MULTIPLE_ONE_TO_MANY_JOINS` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.92 | 0.92 |
| `NON_DETERMINISTIC_WINDOW_ORDER` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.71 | 0.71 |
| `NOT_IN_NULLABLE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 1.27 | 1.27 |
| `NULL_EQUALITY_COMPARISON` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.56 | 0.56 |
| `SCD_JOIN_WITHOUT_EFFECTIVE_DATE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.70 | 0.70 |
| `SELECT_STAR_EXPENSIVE` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.80 | 0.80 |
| `SUSPICIOUS_JOIN_KEY` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 1.00 | 1.00 |
| `UNKNOWN_ALIAS` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.60 | 0.60 |
| `WINDOW_MISSING_ORDER` | 1 | 0 | 0 | 33 | 100.0% | 100.0% | 0.57 | 0.57 |

## Reproduce

```bash
git clone https://github.com/mpingosystems/safesql
cd safesql && npm ci
python benchmark/run_benchmark.py --dataset seeded
```

No API key is required for the local backend: the harness runs the same
engine the product ships. To run against the hosted API instead, add
`--api-key $SAFESQL_API_KEY` (a Pro-or-above key - a free key runs only
12 of 33 detectors and the harness will refuse it).
