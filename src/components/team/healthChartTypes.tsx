// Sprint 7 — types and loading skeleton for the health trend chart.
//
// Deliberately separate from HealthTrendChart.tsx, which imports recharts. A
// static import of ANYTHING in that module — a type, a skeleton — pulls the
// whole ~100 KB library into the main bundle and defeats the React.lazy split.
// Team.tsx imports the skeleton and the type from here; the chart itself only
// through the dynamic import.

export interface DailyScore {
  date: string; // YYYY-MM-DD
  avg_score: number | null;
  count: number;
}

/** Placeholder bars rather than blank space, so the section does not collapse
 *  and reflow the page when data lands. */
export function HealthTrendChartSkeleton() {
  const heights = [38, 62, 30, 74, 52, 88, 44, 66, 34, 58, 80, 48];
  return (
    <div
      style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 10,
        padding: 18,
        height: 208,
      }}
      aria-busy="true"
      aria-label="Loading health trend"
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: '100%' }}>
        {heights.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              borderRadius: 4,
              background: 'linear-gradient(180deg,#27272a,#1f1f23)',
              animation: 'safesql-shimmer 1.4s ease-in-out infinite',
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
