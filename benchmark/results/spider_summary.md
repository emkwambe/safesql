# SafeSQL Pro benchmark - `spider`

Run 2026-08-26 16:28 UTC | backend: **local engine** | dialect: **postgresql** | detectors under test: **33**

Classification follows [METHODOLOGY.md](../METHODOLOGY.md) v1.0, written
and approved before the first query ran.

## Headline

648 false positives observed in automated run.
459 queries flagged for human review.
Final FP count pending manual review.

| | |
|---|---|
| Queries run | 1034 |
| Parsed | 1032 / 1034 |
| True positives | 0 |
| False negatives | 0 |
| False positives (automated, pre-review) | 648 |
| Flagged for human review | 459 |

## Per-detector

| Detector | TP | FP | FN | TN | Precision | Recall | median ms | p95 ms |
|---|---|---|---|---|---|---|---|---|
| `AGGREGATE_OVER_FANOUT_JOIN` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `AGGREGATION_GRAIN_MISMATCH` | 0 | 49 | 0 | 985 | 0.0% | n/a | n/a | n/a |
| `AMBIGUOUS_COLUMN` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `AVG_OVER_NULLABLE` | 0 | 49 | 0 | 985 | 0.0% | n/a | n/a | n/a |
| `CARTESIAN_JOIN` | 0 | 2 | 0 | 1032 | 0.0% | n/a | n/a | n/a |
| `COALESCE_IN_JOIN_KEY` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `CONTRADICTORY_FILTER` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `COUNT_PARENT_AFTER_CHILD_JOIN` | 0 | 70 | 0 | 964 | 0.0% | n/a | n/a | n/a |
| `COUNT_STAR_VS_COUNT_COL` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `CROSS_JOIN_RISK` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `DESTRUCTIVE_DDL` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `DESTRUCTIVE_TRUNCATE` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `DIALECT_MISMATCH` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `HALLUCINATED_COLUMN` | 0 | 200 | 0 | 834 | 0.0% | n/a | n/a | n/a |
| `HALLUCINATED_TABLE` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `HAVING_WITHOUT_GROUP_BY` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `IMPLICIT_TIMEZONE` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `INCOMPLETE_GROUP_BY` | 0 | 25 | 0 | 1009 | 0.0% | n/a | n/a | n/a |
| `INNER_JOIN_NULL_EXCLUSION` | 0 | 21 | 0 | 1013 | 0.0% | n/a | n/a | n/a |
| `INTEGER_DIVISION_RISK` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `JOIN_MULTIPLICATION` | 0 | 149 | 0 | 885 | 0.0% | n/a | n/a | n/a |
| `LEFT_JOIN_FILTERED_IN_WHERE` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `MISSING_TIME_FILTER` | 0 | 50 | 0 | 984 | 0.0% | n/a | n/a | n/a |
| `MISSING_WHERE_DESTRUCTIVE` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `MULTIPLE_ONE_TO_MANY_JOINS` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `NON_DETERMINISTIC_WINDOW_ORDER` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `NOT_IN_NULLABLE` | 0 | 30 | 0 | 1004 | 0.0% | n/a | n/a | n/a |
| `NULL_EQUALITY_COMPARISON` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `SCD_JOIN_WITHOUT_EFFECTIVE_DATE` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `SELECT_STAR_EXPENSIVE` | 0 | 3 | 0 | 1031 | 0.0% | n/a | n/a | n/a |
| `SUSPICIOUS_JOIN_KEY` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `UNKNOWN_ALIAS` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |
| `WINDOW_MISSING_ORDER` | 0 | 0 | 0 | 1034 | n/a | n/a | n/a | n/a |

## Did not parse

- `spider/0830_orchestra`
- `spider/0831_orchestra`

## Reproduce

```bash
git clone https://github.com/mpingosystems/safesql
cd safesql && npm ci
python benchmark/run_benchmark.py --dataset spider
```

No API key is required for the local backend: the harness runs the same
engine the product ships. To run against the hosted API instead, add
`--api-key $SAFESQL_API_KEY` (a Pro-or-above key - a free key runs only
12 of 33 detectors and the harness will refuse it).
