# SafeSQL Pro benchmark - `adversarial`

Run 2026-08-26 16:28 UTC | backend: **local engine** | dialect: **postgresql** | detectors under test: **33**

Classification follows [METHODOLOGY.md](../METHODOLOGY.md) v1.0, written
and approved before the first query ran.

## Headline

3 false positives observed in automated run.
5 queries flagged for human review.
Final FP count pending manual review.

| | |
|---|---|
| Queries run | 20 |
| Parsed | 20 / 20 |
| True positives | 9 |
| False negatives | 1 |
| False positives (automated, pre-review) | 3 |
| Flagged for human review | 5 |

## Per-detector

| Detector | TP | FP | FN | TN | Precision | Recall | median ms | p95 ms |
|---|---|---|---|---|---|---|---|---|
| `AGGREGATE_OVER_FANOUT_JOIN` | 0 | 0 | 1 | 10 | n/a | 0.0% | 1.74 | 1.74 |
| `AGGREGATION_GRAIN_MISMATCH` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `AMBIGUOUS_COLUMN` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `AVG_OVER_NULLABLE` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `CARTESIAN_JOIN` | 0 | 1 | 0 | 9 | 0.0% | n/a | n/a | n/a |
| `COALESCE_IN_JOIN_KEY` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 2.19 | 2.19 |
| `CONTRADICTORY_FILTER` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `COUNT_PARENT_AFTER_CHILD_JOIN` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `COUNT_STAR_VS_COUNT_COL` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `CROSS_JOIN_RISK` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `DESTRUCTIVE_DDL` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `DESTRUCTIVE_TRUNCATE` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `DIALECT_MISMATCH` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `HALLUCINATED_COLUMN` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 2.72 | 2.72 |
| `HALLUCINATED_TABLE` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `HAVING_WITHOUT_GROUP_BY` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `IMPLICIT_TIMEZONE` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `INCOMPLETE_GROUP_BY` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `INNER_JOIN_NULL_EXCLUSION` | 0 | 1 | 0 | 9 | 0.0% | n/a | n/a | n/a |
| `INTEGER_DIVISION_RISK` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 2.44 | 2.44 |
| `JOIN_MULTIPLICATION` | 0 | 1 | 0 | 9 | 0.0% | n/a | n/a | n/a |
| `LEFT_JOIN_FILTERED_IN_WHERE` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 2.67 | 2.67 |
| `MISSING_TIME_FILTER` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `MISSING_WHERE_DESTRUCTIVE` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `MULTIPLE_ONE_TO_MANY_JOINS` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `NON_DETERMINISTIC_WINDOW_ORDER` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 1.59 | 1.59 |
| `NOT_IN_NULLABLE` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 1.39 | 1.39 |
| `NULL_EQUALITY_COMPARISON` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 0.96 | 0.96 |
| `SCD_JOIN_WITHOUT_EFFECTIVE_DATE` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `SELECT_STAR_EXPENSIVE` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 2.61 | 2.61 |
| `SUSPICIOUS_JOIN_KEY` | 1 | 0 | 0 | 10 | 100.0% | 100.0% | 1.67 | 1.67 |
| `UNKNOWN_ALIAS` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |
| `WINDOW_MISSING_ORDER` | 0 | 0 | 0 | 10 | n/a | n/a | n/a | n/a |

## Reproduce

```bash
git clone https://github.com/mpingosystems/safesql
cd safesql && npm ci
python benchmark/run_benchmark.py --dataset adversarial
```

No API key is required for the local backend: the harness runs the same
engine the product ships. To run against the hosted API instead, add
`--api-key $SAFESQL_API_KEY` (a Pro-or-above key - a free key runs only
12 of 33 detectors and the harness will refuse it).
