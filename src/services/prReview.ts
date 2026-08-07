import type { ValidationIssue, ValidationReport } from '../types/validation';
import { locateIssue } from './issueLocator';
import { verdictFor } from './fileValidation';

// Sprint 3 (blueprint) — GitHub PR bot. Pure helpers only: no @actions/* and no
// Octokit imports, so this is unit-testable and the action stays a thin wrapper.
// Validator logic is never duplicated here — issues arrive already computed.

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

export interface CommentPlan {
  /** Comments anchored to lines that exist in the PR diff. */
  inline: ReviewComment[];
  /** Issues that could not be anchored — surfaced in the review body instead. */
  unanchored: Array<{ path: string; issue: ValidationIssue }>;
}

/**
 * Line numbers ADDED or MODIFIED on the right-hand side of a unified diff.
 *
 * GitHub rejects a review comment whose line is not part of the diff (422), so
 * an issue on an untouched line has to go in the review body instead of inline.
 * Only `+` and context lines advance the new-file counter; `-` lines do not.
 */
export function parseAddedLines(patch: string | undefined): Set<number> {
  const added = new Set<number>();
  if (!patch) return added;

  let newLine = 0;
  for (const raw of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith('+')) {
      added.add(newLine);
      newLine += 1;
    } else if (raw.startsWith('-') || raw.startsWith('\\')) {
      // deletion / "\ No newline at end of file" — new-file counter unchanged
    } else {
      // context line
      newLine += 1;
    }
  }
  return added;
}

const SEVERITY_BADGE: Record<string, string> = {
  error: '🛑 **Error**',
  warning: '⚠️ **Warning**',
  suggestion: '💡 **Suggestion**',
};

/** Markdown body for a single inline comment: type, severity, fix, score. */
export function buildCommentBody(issue: ValidationIssue, score: number): string {
  const badge = SEVERITY_BADGE[issue.severity] ?? `**${issue.severity}**`;
  const lines = [
    `${badge} · \`${issue.id}\` · file score **${score}/100** (${verdictFor(score)})`,
    '',
    issue.title ? `**${issue.title}**` : '',
    issue.description ?? '',
  ];
  if (issue.fix) {
    lines.push('', '**Suggested fix**', '```sql', issue.fix, '```');
  }
  lines.push('', '<sub>Posted by [SafeSQL Pro](https://safesqlpro.dev) — pre-execution SQL validation</sub>');
  return lines.filter((l) => l !== '').join('\n');
}

/**
 * Split a file's issues into inline comments and unanchored leftovers, using
 * the diff's added-line set to decide which can be posted inline.
 */
export function planComments(
  path: string,
  sql: string,
  report: ValidationReport,
  addedLines: Set<number>,
): CommentPlan {
  const inline: ReviewComment[] = [];
  const unanchored: Array<{ path: string; issue: ValidationIssue }> = [];

  for (const issue of [...report.errors, ...report.warnings]) {
    const range = locateIssue(sql, issue);
    const line = range?.startLineNumber ?? issue.lineStart;
    if (line && addedLines.has(line)) {
      inline.push({ path, line, body: buildCommentBody(issue, report.riskScore) });
    } else {
      unanchored.push({ path, issue });
    }
  }
  return { inline, unanchored };
}

/** Summary markdown for the review body. */
export function buildReviewBody(
  files: Array<{ path: string; score: number; issueCount: number }>,
  unanchored: Array<{ path: string; issue: ValidationIssue }>,
  blocking: boolean,
): string {
  const failing = files.filter((f) => f.issueCount > 0);
  const head = failing.length
    ? `### SafeSQL Pro found ${failing.length} file(s) with issues`
    : '### SafeSQL Pro — no issues found ✅';

  const rows = files
    .map((f) => `| \`${f.path}\` | ${f.score}/100 | ${verdictFor(f.score)} | ${f.issueCount} |`)
    .join('\n');

  const parts = [
    head,
    '',
    '| File | Score | Verdict | Issues |',
    '|---|---|---|---|',
    rows,
  ];

  if (unanchored.length) {
    parts.push(
      '',
      '<details><summary>Issues outside the changed lines</summary>',
      '',
      ...unanchored.map((u) => `- \`${u.path}\` — \`${u.issue.id}\`: ${u.issue.title ?? ''}`),
      '',
      '</details>',
    );
  }

  parts.push(
    '',
    blocking
      ? '_Merge is blocked while errors remain. Set `comment_mode: warn` to report without blocking._'
      : '_Reporting only — `comment_mode: warn` is set, so this will not block the merge._',
  );
  return parts.join('\n');
}
