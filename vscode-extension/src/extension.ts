import * as vscode from 'vscode';
import { SafeSQLError } from '@safesqlpro/sdk';
import { readConfig } from './config';
import { toDiagnostics } from './diagnostics';
import * as statusBar from './statusBar';
import { validateDocument } from './validator';

// SafeSQL Pro — VS Code extension.
//   * validates .sql files on save (and on demand)
//   * inline diagnostics anchored on the offending clause
//   * score in the status bar
// All detection happens server-side via @safesqlpro/sdk.

const SETTINGS_URL = 'https://safesqlpro.dev/settings';

let diagnostics: vscode.DiagnosticCollection;
// One "set your API key" nudge per session — not one per save.
let apiKeyPrompted = false;

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('safesql');
  context.subscriptions.push(diagnostics);
  statusBar.createStatusBar(context);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isSql(doc) && readConfig().validateOnSave) void run(doc, false);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isSql(editor.document)) statusBar.showMessage('SafeSQL: ready');
      else statusBar.hide();
    }),
    vscode.commands.registerCommand('safesql.validate', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showWarningMessage('SafeSQL Pro: open a SQL file first.');
        return;
      }
      void run(editor.document, true);
    }),
  );

  const active = vscode.window.activeTextEditor;
  if (active && isSql(active.document)) statusBar.showMessage('SafeSQL: ready');
}

function isSql(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'sql';
}

async function run(doc: vscode.TextDocument, interactive: boolean): Promise<void> {
  const config = readConfig();

  if (!config.apiKey) {
    // Never crash without a key — prompt once, then stay quiet.
    statusBar.showMessage('SafeSQL: no API key', 'Set safesql.apiKey to enable validation');
    if (interactive || !apiKeyPrompted) {
      apiKeyPrompted = true;
      const choice = await vscode.window.showWarningMessage(
        'SafeSQL Pro: set your API key to enable validation.',
        'Open Settings',
        'Get an API key',
      );
      if (choice === 'Open Settings') {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'safesql.apiKey');
      } else if (choice === 'Get an API key') {
        void vscode.env.openExternal(vscode.Uri.parse(SETTINGS_URL));
      }
    }
    return;
  }

  statusBar.showMessage('SafeSQL: validating…');
  try {
    const result = await validateDocument(doc, config);
    diagnostics.set(doc.uri, toDiagnostics(doc, result));
    statusBar.showResult(result);
    if (interactive && result.issues.length === 0) {
      void vscode.window.showInformationMessage(`SafeSQL Pro: clean — score ${result.score}/100.`);
    }
  } catch (err) {
    diagnostics.delete(doc.uri);
    statusBar.showMessage('SafeSQL: error', String(err));
    void vscode.window.showErrorMessage(`SafeSQL Pro: ${describeError(err)}`);
  }
}

export function describeError(err: unknown): string {
  if (err instanceof SafeSQLError) {
    if (err.status === 401) return `Invalid API key. Get yours at ${SETTINGS_URL}`;
    if (err.status === 429) return 'Monthly API limit reached. Upgrade at https://safesqlpro.dev/pricing';
    return `API error (${err.status}): ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export function deactivate(): void {
  diagnostics?.dispose();
}
