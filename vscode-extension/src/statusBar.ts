import * as vscode from 'vscode';
import type { ValidationResult } from '@safesqlpro/sdk';
import { statusBarText, statusBarTooltip } from './format';

// Score display in the status bar, e.g. "SafeSQL: 25 CRITICAL".

let item: vscode.StatusBarItem | undefined;

export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'safesql.validate';
  context.subscriptions.push(item);
  return item;
}

export function showResult(result: ValidationResult): void {
  if (!item) return;
  item.text = statusBarText(result);
  item.tooltip = statusBarTooltip(result);
  item.backgroundColor = result.valid
    ? undefined
    : new vscode.ThemeColor(
        result.verdict === 'CRITICAL'
          ? 'statusBarItem.errorBackground'
          : 'statusBarItem.warningBackground',
      );
  item.show();
}

export function showMessage(text: string, tooltip?: string): void {
  if (!item) return;
  item.text = text;
  item.tooltip = tooltip;
  item.backgroundColor = undefined;
  item.show();
}

export function hide(): void {
  item?.hide();
}
