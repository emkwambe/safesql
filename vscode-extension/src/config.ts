import * as vscode from 'vscode';
import type { Dialect } from '@safesqlpro/sdk';

// Workspace settings for the SafeSQL Pro extension (contributes.configuration
// in package.json). Read fresh on every validation so setting changes take
// effect without a reload.

export interface SafeSQLConfig {
  apiKey: string;
  baseUrl?: string;
  threshold: number;
  dialect: Dialect;
  validateOnSave: boolean;
  schemaFile?: string;
}

const DIALECTS: Dialect[] = ['postgresql', 'mysql', 'bigquery', 'snowflake'];

export function readConfig(): SafeSQLConfig {
  const cfg = vscode.workspace.getConfiguration('safesql');
  const dialect = cfg.get<string>('dialect', 'postgresql');
  const baseUrl = cfg.get<string>('baseUrl', '')?.trim();
  const schemaFile = cfg.get<string>('schemaFile', '')?.trim();
  return {
    // Env var wins for teams that would rather not store the key in settings.json.
    apiKey: (process.env.SAFESQL_PRO_API_KEY ?? cfg.get<string>('apiKey', '') ?? '').trim(),
    baseUrl: baseUrl ? baseUrl : undefined,
    threshold: cfg.get<number>('threshold', 70),
    dialect: (DIALECTS as string[]).includes(dialect) ? (dialect as Dialect) : 'postgresql',
    validateOnSave: cfg.get<boolean>('validateOnSave', true),
    schemaFile: schemaFile ? schemaFile : undefined,
  };
}
