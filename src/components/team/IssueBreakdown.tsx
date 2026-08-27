// Sprint 7 — most common issue types, with direction of travel.
//
// The trend compares the current window against the window immediately before
// it (server-side, in /api/teams/health). It reports "stable" unless the change
// clears max(1, 20% of previous) — on counts this small, ±1 is noise, and an
// arrow implies a signal.
//
// Direction is deliberately not colour-coded good/bad. A rising count can mean
// the team is writing worse SQL or simply validating more; the arrow states the
// fact and leaves the reading to the reader.

export interface IssueRow {
  issue_type: string;
  count: number;
  previous_count: number;
  trend: 'up' | 'down' | 'stable';
  pct: number;
}

const card: React.CSSProperties = {
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 10,
  padding: 18,
};

const ARROW: Record<IssueRow['trend'], { glyph: string; color: string; label: string }> = {
  up: { glyph: '↑', color: '#f59e0b', label: 'more than the previous period' },
  down: { glyph: '↓', color: '#10b981', label: 'fewer than the previous period' },
  stable: { glyph: '→', color: '#71717a', label: 'about the same as the previous period' },
};

export function IssueBreakdownSkeleton() {
  return (
    <div style={card} aria-busy="true" aria-label="Loading issue breakdown">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: `${88 - i * 9}%`,
            margin: '11px 0',
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

export function IssueBreakdown({ issues, top = 5 }: { issues: IssueRow[]; top?: number }) {
  if (issues.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '26px 18px' }}>
        <p style={{ color: '#a1a1aa', fontSize: 13.5, margin: 0 }}>
          No issues found this month 🎉
        </p>
      </div>
    );
  }

  const rows = issues.slice(0, top);
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div style={card}>
      {rows.map((r, i) => {
        const a = ARROW[r.trend];
        return (
          <div
            key={r.issue_type}
            style={{
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '1px solid #1f1f23',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 6,
              }}
            >
              <code style={{ fontSize: 12.5, color: '#e4e4e7', flex: 1, minWidth: 0 }}>
                {r.issue_type}
              </code>
              <span style={{ fontSize: 12.5, color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                {r.count} occurrence{r.count === 1 ? '' : 's'}
              </span>
              <span
                title={`${r.count} vs ${r.previous_count} — ${a.label}`}
                style={{ fontSize: 13, color: a.color, fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                {a.glyph}
              </span>
            </div>
            {/* Proportion bar: makes "12 vs 3" legible without reading numbers. */}
            <div style={{ height: 4, background: '#1f1f23', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.round((r.count / max) * 100)}%`,
                  height: '100%',
                  background: '#7c3aed',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
