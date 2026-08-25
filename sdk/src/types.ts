// Public type surface of @safesqlpro/sdk. These mirror the Issue Object
// Contract used by the detection engine, renamed to the external names the
// REST API documents (`issueType` / `message` rather than `id` / `description`).

export type Dialect = 'postgresql' | 'mysql' | 'bigquery' | 'snowflake';

export type Severity = 'error' | 'warning' | 'suggestion';

/** Score bands from the SafeSQL score policy (0-100). */
export type Verdict = 'CLEAN' | 'REVIEW' | 'RISKY' | 'CRITICAL';

export interface Issue {
  /** Detector identifier, e.g. 'AGGREGATE_OVER_FANOUT_JOIN'. */
  issueType: string;
  severity: Severity;
  message: string;
  fix: string;
  /** Negative number: how much this finding subtracts from a perfect 100. */
  scoreImpact: number;
  offendingClause?: string;
  offendingColumn?: string;
  offendingTable?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface ValidationResult {
  /** true when score >= the requested threshold (default 70). */
  valid: boolean;
  score: number;
  verdict: Verdict;
  issues: Issue[];
  /** Server-side detection time in milliseconds. */
  executionTime: number;
}

export interface ValidateParams {
  sql: string;
  ddl?: string;
  dialect?: Dialect;
  /** 0-100. Score below this marks the result invalid. Default 70. */
  threshold?: number;
  /** Abort the request early. */
  signal?: AbortSignal;
}

/** Minimal fetch shape, so the client works in Node, browsers and Workers. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SafeSQLClientOptions {
  /** API key from safesqlpro.dev/settings. */
  apiKey: string;
  /** Override the API origin. Default https://safesqlpro.dev */
  baseUrl?: string;
  /** Injectable fetch — defaults to globalThis.fetch. */
  fetch?: FetchLike;
}
