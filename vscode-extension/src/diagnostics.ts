import * as vscode from 'vscode';
import type { Issue, ValidationResult } from '@safesqlpro/sdk';
import { formatIssueMessage, locateIssue, severityValue } from './format';

// Maps SafeSQL issues onto VS Code diagnostics. The offset math lives in
// format.ts (pure, unit-tested); this file only converts offsets to Ranges.

export function toRange(doc: vscode.TextDocument, issue: Issue): vscode.Range {
  // Detectors that report line numbers win — they are more precise than a
  // token search, which finds the first occurrence only.
  if (typeof issue.lineStart === 'number' && issue.lineStart >= 1) {
    const line = Math.min(issue.lineStart - 1, Math.max(doc.lineCount - 1, 0));
    const endLine = Math.min((issue.lineEnd ?? issue.lineStart) - 1, Math.max(doc.lineCount - 1, 0));
    return new vscode.Range(
      new vscode.Position(line, 0),
      doc.lineAt(Math.max(endLine, line)).range.end,
    );
  }
  const span = locateIssue(doc.getText(), issue);
  return new vscode.Range(doc.positionAt(span.start), doc.positionAt(span.end));
}

export function toDiagnostic(doc: vscode.TextDocument, issue: Issue): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    toRange(doc, issue),
    formatIssueMessage(issue),
    severityValue(issue.severity) as vscode.DiagnosticSeverity,
  );
  diagnostic.source = 'SafeSQL Pro';
  diagnostic.code = issue.issueType;
  return diagnostic;
}

export function toDiagnostics(doc: vscode.TextDocument, result: ValidationResult): vscode.Diagnostic[] {
  return result.issues.map((issue) => toDiagnostic(doc, issue));
}
