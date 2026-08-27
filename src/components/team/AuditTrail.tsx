import { useEffect, useState } from 'react';

// Sprint 7 — audit trail: filters, table, detail modal, CSV export.
//
// The three components named in the sprint brief (AuditTrailFilters,
// AuditTrailTable, ExportButton) plus the modal live in one module: they share
// the row and filter types and are never used apart, so splitting them into four
// files would add imports without adding clarity.
//
// NO QUERY TEXT ANYWHERE. `validations` stores only sql_hash, and /compliance
// states publicly that only a hash is kept. Rows and the modal show findings,
// scores and a hash prefix instead.

export interface AuditIssue {
  id: string | null;
  severity: string | null;
  title: string | null;
  description: string | null;
  fix: string | null;
}

export interface AuditRow {
  id: string | null;
  created_at: string | null;
  clerk_user_id: string | null;
  member_email: string;
  member_name: string;
  score: number | null;
  verdict: 'RISKY' | 'REVIEW' | 'SAFE' | null;
  error_count: number;
  warning_count: number;
  issue_count: number;
  top_issue: string | null;
  dialect: string | null;
  sql_hash: string | null;
  issues: AuditIssue[];
}

export interface AuditFilters {
  days: number;
  member: string;
  verdict: string;
  issue: string;
}

export const DEFAULT_FILTERS: AuditFilters = { days: 30, member: '', verdict: '', issue: '' };

const card: React.CSSProperties = {
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 10,
  padding: 18,
};

const control: React.CSSProperties = {
  background: '#0f0f11',
  border: '1px solid #27272a',
  borderRadius: 6,
  color: '#e4e4e7',
  padding: '7px 9px',
  fontSize: 12.5,
};

function verdictTone(v: AuditRow['verdict']): { bg: string; fg: string } {
  if (v === 'RISKY') return { bg: '#2a1215', fg: '#f87171' };
  if (v === 'REVIEW') return { bg: '#2a2113', fg: '#fbbf24' };
  if (v === 'SAFE') return { bg: '#0f2417', fg: '#4ade80' };
  return { bg: '#1f1f23', fg: '#a1a1aa' };
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function initials(s: string): string {
  const parts = (s || '?').split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

// ── A. Filters ──────────────────────────────────────────────────────────────

export function AuditTrailFilters({
  filters,
  members,
  issueTypes,
  onChange,
  disabled,
}: {
  filters: AuditFilters;
  members: { clerk_user_id: string; name: string }[];
  issueTypes: string[];
  onChange: (next: AuditFilters) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<AuditFilters>) => onChange({ ...filters, ...patch });
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <select
        aria-label="Date range"
        value={filters.days}
        disabled={disabled}
        onChange={(e) => set({ days: Number(e.target.value) })}
        style={control}
      >
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </select>

      <select
        aria-label="Member"
        value={filters.member}
        disabled={disabled}
        onChange={(e) => set({ member: e.target.value })}
        style={control}
      >
        <option value="">All members</option>
        {members.map((m) => (
          <option key={m.clerk_user_id} value={m.clerk_user_id}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Verdict"
        value={filters.verdict}
        disabled={disabled}
        onChange={(e) => set({ verdict: e.target.value })}
        style={control}
      >
        <option value="">All verdicts</option>
        <option value="RISKY">RISKY</option>
        <option value="REVIEW">REVIEW</option>
        <option value="SAFE">SAFE</option>
      </select>

      <select
        aria-label="Issue type"
        value={filters.issue}
        disabled={disabled}
        onChange={(e) => set({ issue: e.target.value })}
        style={{ ...control, maxWidth: 260 }}
      >
        {/* Only detectors that actually appear in the window, so the filter
            cannot offer a value that matches nothing. */}
        <option value="">All issue types</option>
        {issueTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── B. Table ────────────────────────────────────────────────────────────────

export function AuditTrailTable({
  rows,
  loading,
  onView,
}: {
  rows: AuditRow[];
  loading?: boolean;
  onView: (row: AuditRow) => void;
}) {
  if (loading) {
    return (
      <div style={card} aria-busy="true" aria-label="Loading audit trail">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 15,
              margin: '12px 0',
              borderRadius: 5,
              background: 'linear-gradient(90deg,#1f1f23 25%,#27272a 50%,#1f1f23 75%)',
              backgroundSize: '200% 100%',
              animation: 'safesql-shimmer 1.4s ease-in-out infinite',
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '26px 18px' }}>
        <p style={{ color: '#a1a1aa', fontSize: 13.5, margin: 0 }}>
          No validations match these filters.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            {['When', 'Member', 'Score', 'Verdict', 'Top issue', ''].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#a1a1aa',
                  borderBottom: '1px solid #27272a',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tone = verdictTone(r.verdict);
            return (
              <tr key={r.id ?? i}>
                <td style={cellStyle}>{fmtTime(r.created_at)}</td>
                <td style={cellStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: '#1e1b31',
                        color: '#a78bfa',
                        fontSize: 9.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {initials(r.member_name)}
                    </span>
                    {r.member_name}
                  </span>
                </td>
                <td style={cellStyle}>{r.score ?? '—'}</td>
                <td style={cellStyle}>
                  <span
                    style={{
                      background: tone.bg,
                      color: tone.fg,
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 4,
                    }}
                  >
                    {r.verdict ?? '—'}
                  </span>
                </td>
                <td style={cellStyle}>
                  {r.top_issue ? (
                    <code style={{ fontSize: 11.5 }}>{r.top_issue}</code>
                  ) : (
                    <span style={{ color: '#4ade80', fontSize: 12 }}>None</span>
                  )}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  <button type="button" onClick={() => onView(r)} style={viewBtn}>
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 12.5,
  color: '#d4d4d8',
  borderBottom: '1px solid #1f1f23',
  whiteSpace: 'nowrap',
};

const viewBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#a78bfa',
  border: '1px solid #27272a',
  borderRadius: 5,
  padding: '3px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
};

// ── C. Export ───────────────────────────────────────────────────────────────

const CSV_LIMIT = 1000;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Guard against CSV injection: a leading =, +, - or @ is executed as a
  // formula by Excel and Sheets, and detector ids and emails are user-adjacent.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildAuditCsv(rows: AuditRow[]): string {
  const header = [
    'timestamp',
    'member_email',
    'score',
    'verdict',
    'issue_count',
    'top_issue',
    'dialect',
    'sql_hash',
  ];
  const lines = [header.join(',')];
  for (const r of rows.slice(0, CSV_LIMIT)) {
    lines.push(
      [
        r.created_at,
        r.member_email,
        r.score,
        r.verdict,
        r.issue_count,
        r.top_issue,
        r.dialect,
        r.sql_hash,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function ExportButton({
  rows,
  disabled,
  teamSlug,
  locked,
}: {
  rows: AuditRow[];
  disabled?: boolean;
  teamSlug: string;
  /** True when the team's plan is below Team tier. Shows a locked state rather
   *  than hiding the control — a hidden feature cannot be upgraded toward. */
  locked?: boolean;
}) {
  const download = () => {
    const csv = buildAuditCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safesql-audit-${teamSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (locked) {
    return (
      <a
        href="#/pricing"
        style={{
          display: 'inline-block',
          background: 'transparent',
          color: '#a1a1aa',
          border: '1px dashed #3f3f46',
          borderRadius: 6,
          padding: '7px 13px',
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
        title="Upgrade to the Team plan to export the audit trail"
      >
        🔒 CSV Export — Team plan required
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled || rows.length === 0}
      title={
        rows.length > CSV_LIMIT
          ? `Exports the first ${CSV_LIMIT} of ${rows.length} rows`
          : 'Export the filtered rows as CSV'
      }
      style={{
        background: 'transparent',
        color: disabled || rows.length === 0 ? '#52525b' : '#e4e4e7',
        border: '1px solid #27272a',
        borderRadius: 6,
        padding: '7px 13px',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled || rows.length === 0 ? 'not-allowed' : 'pointer',
      }}
    >
      Export CSV
    </button>
  );
}

// ── D. Detail modal ─────────────────────────────────────────────────────────

export function ValidationDetailModal({
  row,
  onClose,
}: {
  row: AuditRow | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [row, onClose]);

  if (!row) return null;
  const tone = verdictTone(row.verdict);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Validation detail"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.66)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '6vh 16px',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...card,
          maxWidth: 620,
          width: '100%',
          padding: 0,
          // Cap the dialog itself and let the body scroll inside it, so the
          // header stays reachable however many findings a validation has.
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 22px 14px',
            borderBottom: '1px solid #27272a',
            background: '#18181b',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>Validation detail</h2>
            <div style={{ fontSize: 12.5, color: '#71717a' }}>
              {fmtTime(row.created_at)} · {row.member_name} · {row.dialect ?? 'postgresql'}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={viewBtn}>
            Close
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 22px 22px', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '16px 0' }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: tone.fg }}>{row.score ?? '—'}</span>
          <span
            style={{
              background: tone.bg,
              color: tone.fg,
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            {row.verdict ?? '—'}
          </span>
          <span style={{ fontSize: 12.5, color: '#a1a1aa' }}>
            {row.error_count} error{row.error_count === 1 ? '' : 's'}, {row.warning_count} warning
            {row.warning_count === 1 ? '' : 's'}
          </span>
        </div>

        <div
          style={{
            background: '#0f0f11',
            border: '1px solid #27272a',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 12,
            color: '#71717a',
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          Query text is not retained. SafeSQL Pro stores only a SHA-256 hash of the validated SQL
          {row.sql_hash && (
            <>
              {' '}
              — <code style={{ color: '#a1a1aa' }}>{row.sql_hash}…</code>
            </>
          )}
          , so an audit record proves what was checked and what was found without keeping the query
          itself.
        </div>

        <h3 style={{ fontSize: 13.5, margin: '0 0 8px', color: '#a1a1aa' }}>
          Findings ({row.issues.length})
        </h3>
        {row.issues.length === 0 ? (
          <p style={{ color: '#4ade80', fontSize: 13 }}>No findings — this query was clean.</p>
        ) : (
          row.issues.map((iss, i) => (
            <div
              key={i}
              style={{
                borderLeft: `2px solid ${
                  iss.severity === 'error' ? '#ef4444' : iss.severity === 'warning' ? '#f59e0b' : '#52525b'
                }`,
                paddingLeft: 11,
                margin: '11px 0',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <code style={{ fontSize: 12, color: '#e4e4e7' }}>{iss.id}</code>
                <span style={{ fontSize: 10.5, color: '#71717a', textTransform: 'uppercase' }}>
                  {iss.severity}
                </span>
              </div>
              {iss.title && (
                <div style={{ fontSize: 12.5, color: '#d4d4d8', marginTop: 3 }}>{iss.title}</div>
              )}
              {iss.description && (
                <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 3, lineHeight: 1.55 }}>
                  {iss.description}
                </div>
              )}
              {iss.fix && (
                <div style={{ fontSize: 12, color: '#4ade80', marginTop: 5, lineHeight: 1.55 }}>
                  Fix: {iss.fix}
                </div>
              )}
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}

/** Small hook so Team.tsx does not carry modal state inline. */
export function useDetailModal() {
  const [row, setRow] = useState<AuditRow | null>(null);
  return { row, open: setRow, close: () => setRow(null) };
}
