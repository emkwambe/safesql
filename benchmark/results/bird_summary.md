# SafeSQL Pro benchmark - `bird`

Run 2026-08-26 16:28 UTC | backend: **local engine** | dialect: **postgresql** | detectors under test: **33**

Classification follows [METHODOLOGY.md](../METHODOLOGY.md) v1.0, written
and approved before the first query ran.

## Headline

1523 false positives observed in automated run.
981 queries flagged for human review.
Final FP count pending manual review.

| | |
|---|---|
| Queries run | 1534 |
| Parsed | 1533 / 1534 |
| True positives | 0 |
| False negatives | 0 |
| False positives (automated, pre-review) | 1523 |
| Flagged for human review | 981 |

## Per-detector

| Detector | TP | FP | FN | TN | Precision | Recall | median ms | p95 ms |
|---|---|---|---|---|---|---|---|---|
| `AGGREGATE_OVER_FANOUT_JOIN` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `AGGREGATION_GRAIN_MISMATCH` | 0 | 256 | 0 | 1278 | 0.0% | n/a | n/a | n/a |
| `AMBIGUOUS_COLUMN` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `AVG_OVER_NULLABLE` | 0 | 26 | 0 | 1508 | 0.0% | n/a | n/a | n/a |
| `CARTESIAN_JOIN` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `COALESCE_IN_JOIN_KEY` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `CONTRADICTORY_FILTER` | 0 | 8 | 0 | 1526 | 0.0% | n/a | n/a | n/a |
| `COUNT_PARENT_AFTER_CHILD_JOIN` | 0 | 4 | 0 | 1530 | 0.0% | n/a | n/a | n/a |
| `COUNT_STAR_VS_COUNT_COL` | 0 | 9 | 0 | 1525 | 0.0% | n/a | n/a | n/a |
| `CROSS_JOIN_RISK` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `DESTRUCTIVE_DDL` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `DESTRUCTIVE_TRUNCATE` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `DIALECT_MISMATCH` | 0 | 128 | 0 | 1406 | 0.0% | n/a | n/a | n/a |
| `HALLUCINATED_COLUMN` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `HALLUCINATED_TABLE` | 0 | 60 | 0 | 1474 | 0.0% | n/a | n/a | n/a |
| `HAVING_WITHOUT_GROUP_BY` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `IMPLICIT_TIMEZONE` | 0 | 52 | 0 | 1482 | 0.0% | n/a | n/a | n/a |
| `INCOMPLETE_GROUP_BY` | 0 | 7 | 0 | 1527 | 0.0% | n/a | n/a | n/a |
| `INNER_JOIN_NULL_EXCLUSION` | 0 | 72 | 0 | 1462 | 0.0% | n/a | n/a | n/a |
| `INTEGER_DIVISION_RISK` | 0 | 3 | 0 | 1531 | 0.0% | n/a | n/a | n/a |
| `JOIN_MULTIPLICATION` | 0 | 544 | 0 | 990 | 0.0% | n/a | n/a | n/a |
| `LEFT_JOIN_FILTERED_IN_WHERE` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `MISSING_TIME_FILTER` | 0 | 193 | 0 | 1341 | 0.0% | n/a | n/a | n/a |
| `MISSING_WHERE_DESTRUCTIVE` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `MULTIPLE_ONE_TO_MANY_JOINS` | 0 | 5 | 0 | 1529 | 0.0% | n/a | n/a | n/a |
| `NON_DETERMINISTIC_WINDOW_ORDER` | 0 | 5 | 0 | 1529 | 0.0% | n/a | n/a | n/a |
| `NOT_IN_NULLABLE` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `NULL_EQUALITY_COMPARISON` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `SCD_JOIN_WITHOUT_EFFECTIVE_DATE` | 0 | 11 | 0 | 1523 | 0.0% | n/a | n/a | n/a |
| `SELECT_STAR_EXPENSIVE` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `SUSPICIOUS_JOIN_KEY` | 0 | 140 | 0 | 1394 | 0.0% | n/a | n/a | n/a |
| `UNKNOWN_ALIAS` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |
| `WINDOW_MISSING_ORDER` | 0 | 0 | 0 | 1534 | n/a | n/a | n/a | n/a |

## Did not parse

- `bird/0603_codebase_community`

## Reproduce

```bash
git clone https://github.com/mpingosystems/safesql
cd safesql && npm ci
python benchmark/run_benchmark.py --dataset bird
```

No API key is required for the local backend: the harness runs the same
engine the product ships. To run against the hosted API instead, add
`--api-key $SAFESQL_API_KEY` (a Pro-or-above key - a free key runs only
12 of 33 detectors and the harness will refuse it).
