import { describe, it, expect } from 'vitest';
import {
  buildCommentBody,
  buildReviewBody,
  parseAddedLines,
  planComments,
} from '../services/prReview';
import { validateSqlSource } from '../services/fileValidation';
import type { ValidationIssue } from '../types/validation';

// Blueprint Sprint 3 — PR bot helpers. GitHub rejects review comments on lines
// outside the diff (422), so anchoring correctness is the thing worth testing.

const DDL = `CREATE TABLE users (id UUID PRIMARY KEY, country TEXT);
CREATE TABLE orders (id UUID PRIMARY KEY, user_id UUID, total_amount NUMERIC);
CREATE TABLE user_tags (id UUID PRIMARY KEY, user_id UUID, tag TEXT);`;

describe('parseAddedLines', () => {
  it('returns an empty set for a missing patch', () => {
    expect(parseAddedLines(undefined).size).toBe(0);
  });

  it('counts added lines from the hunk start', () => {
    const patch = ['@@ -1,2 +1,3 @@', ' SELECT 1', '+SELECT 2', ' SELECT 3'].join('\n');
    expect([...parseAddedLines(patch)]).toEqual([2]);
  });

  it('does not advance the new-file counter on deletions', () => {
    const patch = ['@@ -1,3 +1,2 @@', ' keep', '-removed', '+added'].join('\n');
    // line 1 = "keep", line 2 = "added" (the deletion must not shift it)
    expect([...parseAddedLines(patch)]).toEqual([2]);
  });

  it('handles multiple hunks with independent offsets', () => {
    const patch = [
      '@@ -1,2 +1,2 @@',
      ' a',
      '+b',
      '@@ -40,2 +40,3 @@',
      ' c',
      '+d',
      '+e',
    ].join('\n');
    expect([...parseAddedLines(patch)].sort((x, y) => x - y)).toEqual([2, 41, 42]);
  });

  it('ignores the no-newline marker', () => {
    const patch = ['@@ -1 +1,2 @@', ' a', '+b', '\\ No newline at end of file'].join('\n');
    expect([...parseAddedLines(patch)]).toEqual([2]);
  });
});

describe('buildCommentBody', () => {
  const issue = {
    id: 'CARTESIAN_JOIN',
    severity: 'error',
    title: 'JOIN with "orders" has no ON clause',
    description: 'A JOIN without an ON clause produces a Cartesian product.',
    fix: 'Add a join condition, e.g. JOIN orders ON ....',
  } as unknown as ValidationIssue;

  it('includes detector id, severity, score and fix', () => {
    const body = buildCommentBody(issue, 25);
    expect(body).toContain('CARTESIAN_JOIN');
    expect(body).toContain('Error');
    expect(body).toContain('25/100');
    expect(body).toContain('Add a join condition');
    expect(body).toContain('```sql');
  });

  it('omits the fix block when there is no fix', () => {
    const body = buildCommentBody({ ...issue, fix: undefined } as ValidationIssue, 60);
    expect(body).not.toContain('Suggested fix');
  });
});

describe('planComments', () => {
  const sql = `SELECT u.id, u.country, o.total_amount
FROM users u
JOIN orders o`;

  it('anchors an issue that falls on a changed line', () => {
    const report = validateSqlSource(sql, DDL, 'postgresql');
    expect(report.errors.length).toBeGreaterThan(0);
    // Pretend every line of the file is part of the diff.
    const all = new Set([1, 2, 3]);
    const plan = planComments('q.sql', sql, report, all);
    expect(plan.inline.length).toBeGreaterThan(0);
    expect(plan.inline[0].path).toBe('q.sql');
    expect(all.has(plan.inline[0].line)).toBe(true);
  });

  it('moves issues off the diff into unanchored rather than dropping them', () => {
    const report = validateSqlSource(sql, DDL, 'postgresql');
    const plan = planComments('q.sql', sql, report, new Set<number>());
    expect(plan.inline).toHaveLength(0);
    expect(plan.unanchored.length).toBe(report.errors.length + report.warnings.length);
  });
});

describe('buildReviewBody', () => {
  it('reports a clean run', () => {
    const body = buildReviewBody([{ path: 'a.sql', score: 100, issueCount: 0 }], [], false);
    expect(body).toContain('no issues found');
  });

  it('states blocking vs warn-only', () => {
    const rows = [{ path: 'a.sql', score: 25, issueCount: 2 }];
    expect(buildReviewBody(rows, [], true)).toContain('Merge is blocked');
    expect(buildReviewBody(rows, [], false)).toContain('will not block');
  });

  it('lists unanchored issues in a details block', () => {
    const rows = [{ path: 'a.sql', score: 25, issueCount: 1 }];
    const body = buildReviewBody(
      rows,
      [{ path: 'a.sql', issue: { id: 'CARTESIAN_JOIN', title: 'x' } as ValidationIssue }],
      true,
    );
    expect(body).toContain('Issues outside the changed lines');
    expect(body).toContain('CARTESIAN_JOIN');
  });
});
