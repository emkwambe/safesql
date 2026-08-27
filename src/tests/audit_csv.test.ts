import { describe, expect, it } from 'vitest';
import { buildAuditCsv, type AuditRow } from '../components/team/AuditTrail';

// Sprint 7 — CSV export.

const row = (over: Partial<AuditRow> = {}): AuditRow => ({
  id: 'v1',
  created_at: '2026-08-26T10:00:00.000Z',
  clerk_user_id: 'user_1',
  member_email: 'priya@acme.com',
  member_name: 'Priya',
  score: 25,
  verdict: 'RISKY',
  error_count: 1,
  warning_count: 2,
  issue_count: 3,
  top_issue: 'AGGREGATE_OVER_FANOUT_JOIN',
  dialect: 'postgresql',
  sql_hash: 'a1b2c3d4e5f6',
  issues: [],
  ...over,
});

describe('buildAuditCsv', () => {
  it('emits the documented header', () => {
    expect(buildAuditCsv([]).split('\n')[0]).toBe(
      'timestamp,member_email,score,verdict,issue_count,top_issue,dialect,sql_hash',
    );
  });

  it('writes one quoted row per validation', () => {
    const lines = buildAuditCsv([row()]).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"priya@acme.com"');
    expect(lines[1]).toContain('"AGGREGATE_OVER_FANOUT_JOIN"');
    expect(lines[1]).toContain('"RISKY"');
  });

  it('never contains query text — only a hash is stored', () => {
    const csv = buildAuditCsv([row()]);
    expect(csv).not.toMatch(/SELECT/i);
    expect(csv).toContain('a1b2c3d4e5f6');
  });

  it('escapes embedded double quotes', () => {
    const csv = buildAuditCsv([row({ member_name: 'A "quoted" name', member_email: 'a"b@x.com' })]);
    expect(csv).toContain('"a""b@x.com"');
  });

  it('neutralises CSV injection — a leading = is not left executable', () => {
    // Excel and Sheets execute a leading =, +, - or @ as a formula.
    const csv = buildAuditCsv([row({ member_email: '=cmd|/c calc!A1' })]);
    expect(csv).toContain('"\'=cmd|/c calc!A1"');
    expect(csv).not.toContain('"=cmd');
  });

  it('caps the export at 1,000 rows', () => {
    const many = Array.from({ length: 1500 }, (_, i) => row({ id: `v${i}` }));
    expect(buildAuditCsv(many).split('\n')).toHaveLength(1001); // header + 1000
  });

  it('renders nulls as empty cells rather than the string "null"', () => {
    const csv = buildAuditCsv([row({ top_issue: null, score: null, verdict: null })]);
    expect(csv).not.toContain('"null"');
    expect(csv).toContain('""');
  });
});
