// Sprint 5D — /how-to page data contract.
//
// The page is data-driven: five use cases, each a `UseCase`. Adding or editing
// a use case is a data change, never a JSX change. Every command and snippet
// here must be copy-pasteable as written — see the note on GitHub Action org in
// the page source.

export type UseCaseId =
  | 'dbt'
  | 'ai-sql'
  | 'analytics-engineer'
  | 'compliance'
  | 'engineering-lead';

export type CodeLang = 'bash' | 'yaml' | 'sql' | 'json' | 'text';

export interface CodeSnippet {
  lang: CodeLang;
  /** Shown above the block. Omit for a bare snippet. */
  caption?: string;
  code: string;
  /** Rendered dimmed, with no copy button — it is output, not input. */
  isOutput?: boolean;
}

export interface Step {
  title: string;
  /** One or two sentences. Plain text; no markup. */
  body: string;
  snippets?: CodeSnippet[];
}

export interface UseCase {
  id: UseCaseId;
  /** Tab label. Kept short so five fit on one row at >=900px. */
  label: string;
  /** Who this is for, shown under the tab bar. */
  persona: string;
  /** The problem, in the reader's words. */
  problem: string;
  steps: Step[];
  /** Closing line — what the reader now has. */
  outcome: string;
}
