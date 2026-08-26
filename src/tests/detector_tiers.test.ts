import { describe, expect, it } from 'vitest';
import {
  FREE_DETECTORS,
  FREE_DETECTOR_COUNT,
  PRO_DETECTORS,
  TOTAL_DETECTORS,
  gatedDetectorCount,
  getDetectorsForTier,
  isDetectorEnabled,
} from '../config/detectorTiers';
import { validateSQL } from '../services/sqlValidator';
import { parseDDL } from '../services/schemaParser';

// Sprint 5C — free/pro detector gating.

const FANOUT_DDL = `
CREATE TABLE customers (id INT PRIMARY KEY, plan TEXT);
CREATE TABLE payments (id INT PRIMARY KEY, customer_id INT REFERENCES customers(id), amount NUMERIC);
CREATE TABLE subscriptions (id INT PRIMARY KEY, customer_id INT REFERENCES customers(id), plan TEXT);
`;

// A SUM across two one-to-many joins: the flagship AGGREGATE_OVER_FANOUT_JOIN
// (Pro-only) fires here, so it is the sharpest test of the gate.
const FANOUT_SQL = `
SELECT c.plan, SUM(p.amount) AS revenue
FROM customers c
JOIN subscriptions s ON s.customer_id = c.id
JOIN payments p ON p.customer_id = c.id
GROUP BY c.plan;
`;

describe('detector tier lists', () => {
  it('free tier has exactly 12 detectors, no duplicates', () => {
    expect(FREE_DETECTORS).toHaveLength(12);
    expect(new Set(FREE_DETECTORS).size).toBe(12);
    expect(FREE_DETECTOR_COUNT).toBe(12);
  });

  it('pro tier has all 33 built-in detectors, no duplicates', () => {
    expect(PRO_DETECTORS).toHaveLength(33);
    expect(new Set(PRO_DETECTORS).size).toBe(33);
    expect(TOTAL_DETECTORS).toBe(33);
  });

  it('pro is a strict superset of free', () => {
    for (const id of FREE_DETECTORS) expect(PRO_DETECTORS).toContain(id);
    expect(PRO_DETECTORS.length).toBeGreaterThan(FREE_DETECTORS.length);
  });

  it('excludes CUSTOM_RULE and SYNTAX_ERROR from the counted set', () => {
    expect(PRO_DETECTORS).not.toContain('CUSTOM_RULE');
    expect(PRO_DETECTORS).not.toContain('SYNTAX_ERROR');
  });

  it('maps every paid tier to the full set', () => {
    expect(getDetectorsForTier('free')).toHaveLength(12);
    for (const tier of ['pro', 'team', 'business', 'enterprise'] as const) {
      expect(getDetectorsForTier(tier)).toHaveLength(33);
    }
  });

  it('reports 21 gated detectors on free and 0 on pro', () => {
    expect(gatedDetectorCount('free')).toBe(21);
    expect(gatedDetectorCount('pro')).toBe(0);
  });

  it('never gates SYNTAX_ERROR or CUSTOM_RULE, on any tier', () => {
    expect(isDetectorEnabled('SYNTAX_ERROR', 'free')).toBe(true);
    expect(isDetectorEnabled('CUSTOM_RULE', 'free')).toBe(true);
  });

  it('gates the flagship fan-out detector on free', () => {
    expect(isDetectorEnabled('AGGREGATE_OVER_FANOUT_JOIN', 'free')).toBe(false);
    expect(isDetectorEnabled('AGGREGATE_OVER_FANOUT_JOIN', 'pro')).toBe(true);
  });
});

describe('validateSQL tier gating', () => {
  const schema = parseDDL(FANOUT_DDL);

  it('omitting tier runs every detector (unchanged pre-5C behaviour)', () => {
    const report = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql' });
    const ids = [...report.errors, ...report.warnings, ...report.suggestions].map((i) => i.id);
    expect(ids).toContain('AGGREGATE_OVER_FANOUT_JOIN');
    expect(report.upgradePrompt).toBeUndefined();
  });

  it('withholds Pro-only findings on the free tier', () => {
    const free = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql', tier: 'free' });
    const ids = [...free.errors, ...free.warnings, ...free.suggestions].map((i) => i.id);
    expect(ids).not.toContain('AGGREGATE_OVER_FANOUT_JOIN');
    for (const id of ids) expect(FREE_DETECTORS).toContain(id);
  });

  it('scores the free result only from the detectors that ran', () => {
    const free = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql', tier: 'free' });
    const pro = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql', tier: 'pro' });
    // Fewer findings -> a higher (less alarming) score. This is the honest
    // consequence of gating and the reason the upgrade prompt has to exist.
    expect(free.riskScore).toBeGreaterThan(pro.riskScore);
  });

  it('reports detectorsRun for both tiers', () => {
    const free = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql', tier: 'free' });
    const pro = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql', tier: 'pro' });
    expect(free.detectorsRun).toHaveLength(12);
    expect(pro.detectorsRun).toHaveLength(33);
  });

  it('sets upgradePrompt only when findings were actually withheld', () => {
    const free = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql', tier: 'free' });
    expect(free.upgradePrompt).toBeTruthy();
    expect(free.upgradePrompt).toContain('33');

    // A query whose only finding is a free detector withholds nothing.
    const clean = validateSQL({
      sql: 'SELECT id, plan FROM customers WHERE id = 1;',
      schema,
      dialect: 'postgresql',
      tier: 'free',
    });
    expect(clean.upgradePrompt).toBeUndefined();
  });

  it('never names a gated detector in the upgrade prompt', () => {
    const free = validateSQL({ sql: FANOUT_SQL, schema, dialect: 'postgresql', tier: 'free' });
    const gated = PRO_DETECTORS.filter((d) => !FREE_DETECTORS.includes(d));
    for (const id of gated) expect(free.upgradePrompt ?? '').not.toContain(id);
  });

  it('still catches a cartesian join on the free tier', () => {
    const free = validateSQL({
      sql: 'SELECT c.id, p.amount FROM customers c CROSS JOIN payments p;',
      schema,
      dialect: 'postgresql',
      tier: 'free',
    });
    const ids = [...free.errors, ...free.warnings, ...free.suggestions].map((i) => i.id);
    expect(ids.some((id) => id === 'CARTESIAN_JOIN' || id === 'CROSS_JOIN_RISK')).toBe(true);
  });

  it('still reports a syntax error on the free tier', () => {
    const free = validateSQL({ sql: 'SELEKT * FROM', dialect: 'postgresql', tier: 'free' });
    expect(free.errors.map((i) => i.id)).toContain('SYNTAX_ERROR');
  });
});
