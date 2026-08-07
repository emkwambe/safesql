# SafeSQL dbt Integration

Validate every dbt SQL model with SafeSQL **before** `dbt run` executes it.
SafeSQL and dbt are sequential, not competitors: SafeSQL validates the query
before execution; dbt tests validate the output after.

## Install

```bash
pip install dbt-safesql
```

That installs the `safesql-dbt` console script and its two dependencies
(`requests`, `pyyaml`). Python 3.9+.

From a checkout instead:

```bash
pip install ./dbt-safesql
```

## Quick start

```bash
export SAFESQL_API_KEY=ssk_live_xxxx
safesql-dbt --project-dir . --dialect postgresql
```

Get an API key at https://safesqlpro.dev/settings (Pro tier and above).

## How enforcement works

**dbt hooks and macros cannot call SafeSQL.** dbt hooks (`on-run-start`,
`pre-hook`, `post-hook`) execute SQL against your warehouse, and dbt's Jinja
sandbox has no HTTP client — so no macro or hook can reach the SafeSQL API.
Enforcement runs *beside* dbt, in one of three places:

### 1. pre-commit (recommended)

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/mpingosystems/safesql
    rev: v0.9.1
    hooks:
      - id: safesql-validate
        args: [--threshold=70, --dialect=postgres]
```

Blocks the commit when a model scores below the threshold.

### 2. CI, or a shell step before dbt run

```bash
safesql-dbt --project-dir . --threshold 70 && dbt run
```

```yaml
# .github/workflows/dbt.yml
- run: pip install dbt-safesql
- run: safesql-dbt --project-dir . --threshold 70
  env:
    SAFESQL_API_KEY: ${{ secrets.SAFESQL_API_KEY }}
```

### 3. dbt_project.yml reminder hook

`dbt_project.yml` in this directory carries a reference `on-run-start` hook and
the `safesql_threshold` / `safesql_warn_only` vars. The hook **logs a reminder
only** — it cannot block the run. Copy the blocks into your own project:

```yaml
vars:
  safesql_threshold: 70
  safesql_warn_only: false

on-run-start:
  - "{{ log('SafeSQL: enforcement runs via `safesql-dbt --threshold=' ~ var('safesql_threshold', 70) ~ '` (pre-commit or CI) — dbt hooks cannot call it.', info=True) }}"
```

## What it does

- Scans `models/**/*.sql`
- Strips dbt Jinja (`{{ ref(...) }}`, `{% ... %}`) so the SQL parses
- Builds a rough DDL from `schema.yml` / `sources.yml` column definitions
- Calls `POST https://safesqlpro.dev/api/validate` for each model
- Prints a per-model score and **exits 1** if any model falls below the threshold

```
SafeSQL: 2 models checked, 2 failing (threshold 70)
  X integration_tests\models\test_cartesian.sql (score: 25, hard error) - 1 issue(s)
     CARTESIAN_JOIN: A JOIN without an ON (or USING) clause produces a Cartesian
     product: every row of the left side paired with every row of "orders".
       Fix: Add a join condition, e.g. JOIN orders ON ....
  X integration_tests\models\test_fanout.sql (score: 25, hard error) - 1 issue(s)
     AGGREGATE_OVER_FANOUT_JOIN: Joining "user_tags" alongside "orders" duplicates
     each "orders" row once per matching "user_tags" row, so SUM(total_amount) is
     multiplied.
       Fix: Pre-aggregate "orders" before joining.
SafeSQL: fix the issues above, or re-run with --warn-only to proceed.
```

Each failing model shows why it failed — `hard error` (the engine returned
errors, which fail at any threshold) or `score below N`. Models at or above the
threshold print as `OK <file> (score: N)`.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--project-dir`  | `.`         | dbt project root |
| `--profiles-dir` | `~/.dbt`    | dbt profiles dir |
| `--dialect`      | `postgresql`| SQL dialect |
| `--api-key`      | `$SAFESQL_API_KEY` | SafeSQL API key (Pro+) |
| `--threshold`    | `70` (`$SAFESQL_THRESHOLD`) | Fail models scoring below this; models at or above it are not reported |
| `--warn-only`    | off (`$SAFESQL_WARN_ONLY`) | Print findings but always exit 0 |

### `--threshold`

Scores follow the SafeSQL score policy:

| Score | Meaning |
|---|---|
| 0–40 | Hard error (unknown column/table, cartesian join, destructive SQL) |
| 41–69 | High-risk semantic warning (fan-out aggregate, LEFT JOIN WHERE, SCD) |
| 70–84 | Medium warning (integer division, COUNT parent after join) |
| 85–100 | Suggestion only |

The default of `70` therefore fails on errors and high-risk warnings and stays
quiet above that. Raise it to `85` to also block medium warnings.

```bash
safesql-dbt --threshold 85     # stricter
safesql-dbt --threshold 41     # hard errors only
```

### `--warn-only`

Reports everything but exits 0, so it never blocks a commit or a build. Useful
when introducing SafeSQL to an existing project with a backlog of findings.

```bash
safesql-dbt --warn-only
```

## Integration tests

`integration_tests/` is a minimal dbt project with two deliberately broken
models:

| Model | Detector | Score |
|---|---|---|
| `test_fanout.sql` | `AGGREGATE_OVER_FANOUT_JOIN` | 25 |
| `test_cartesian.sql` | `CARTESIAN_JOIN` | 25 |

```bash
safesql-dbt --project-dir integration_tests --threshold 70   # exits 1
safesql-dbt --project-dir integration_tests --warn-only      # exits 0
```

It is never built with `dbt run` — `test_cartesian.sql` is intentionally
invalid SQL.

## Environment

| Variable | Purpose |
|---|---|
| `SAFESQL_API_KEY` | API key (same as `--api-key`) |
| `SAFESQL_API_URL` | Override the endpoint, e.g. `http://localhost:8788/api/validate` |
| `SAFESQL_THRESHOLD` | Default for `--threshold` |
| `SAFESQL_WARN_ONLY` | `1`/`true`/`yes` to default `--warn-only` on |
