import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { validateSQL } from '../src/services/sqlValidator';
import { parseDDL } from '../src/services/schemaParser';

// SafeSQL Pro benchmark — local validation backend.
//
// Reads {dialect, cases:[{id, sql, ddl}]} from $BENCH_IN and writes per-case
// results to $BENCH_OUT. Imports the SAME validateSQL the product ships, so a
// local run and a hosted-API run exercise identical detector code.
//
// It runs under Vitest (rather than node/tsx) purely for the module transform:
// node-sql-parser is CJS and Node's bare ESM interop cannot resolve its named
// exports. It lives behind benchmark/vitest.config.ts and is excluded from the
// root test run, so it never affects the test gate.
//
// No `tier` is passed, so all 33 detectors run — validateSQL defaults to the
// full set when tier is omitted.

const NOT_DETECTORS = new Set(['SYNTAX_ERROR', 'CUSTOM_RULE']);

interface Case {
  id: string;
  sql: string;
  ddl?: string;
}

it('runs the benchmark corpus through the local engine', () => {
  const inPath = process.env.BENCH_IN;
  const outPath = process.env.BENCH_OUT;
  if (!inPath || !outPath) throw new Error('BENCH_IN and BENCH_OUT must be set');

  const input = JSON.parse(readFileSync(inPath, 'utf8')) as {
    dialect: 'postgresql' | 'mysql' | 'bigquery' | 'snowflake';
    cases: Case[];
  };

  // Parse each distinct DDL once — the corpus shares one schema across 66 cases.
  const schemaCache = new Map<string, ReturnType<typeof parseDDL>>();

  const out = input.cases.map((c) => {
    let schema;
    if (c.ddl) {
      if (!schemaCache.has(c.ddl)) schemaCache.set(c.ddl, parseDDL(c.ddl, input.dialect));
      schema = schemaCache.get(c.ddl);
    }

    const t0 = performance.now();
    const report = validateSQL({ sql: c.sql, schema, dialect: input.dialect });
    const ms = performance.now() - t0;

    const issues = [
      ...(report.errors ?? []),
      ...(report.warnings ?? []),
      ...(report.suggestions ?? []),
    ];
    // One entry per detector id, per METHODOLOGY.md §4.2.
    const fired = [
      ...new Set(issues.map((i) => i.id).filter((id) => id && !NOT_DETECTORS.has(id))),
    ];

    return {
      id: c.id,
      fired,
      riskScore: report.riskScore,
      ms: report.processingMs ?? ms,
      parsed: !issues.some((i) => i.id === 'SYNTAX_ERROR'),
      tier: 'local (all 33)',
      detectorsRun: report.detectorsRun ?? null,
    };
  });

  writeFileSync(outPath, JSON.stringify(out), 'utf8');
});
