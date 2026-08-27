// Sprint 7 — team SQL health headline.
//
// Below MIN_VALIDATIONS the score is suppressed entirely rather than shown with
// a caveat: an average over two rows is noise, and a big number invites trust it
// has not earned.

export interface HealthSummary {
  health_score: number;
  /** this week minus last week. null when either week has no validations —
   *  "no change" and "no data" must not render the same arrow. */
  trend: number | null;
  validation_count: number;
  has_enough_data: boolean;
  min_validations: number;
  window_days: number;
}

const card: React.CSSProperties = {
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 10,
  padding: 20,
};

/** Score bands mirror the shipped score policy: 0-40 / 41-69 / 70-84 / 85-100. */
function scoreColor(score: number): string {
  if (score < 41) return '#ef4444';
  if (score < 70) return '#f59e0b';
  return '#10b981';
}

function Trend({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span style={{ fontSize: 13, color: '#71717a' }} title="Not enough history to compare weeks">
        → no comparison yet
      </span>
    );
  }
  if (value === 0) {
    return <span style={{ fontSize: 13, color: '#a1a1aa' }}>→ no change this week</span>;
  }
  const up = value > 0;
  return (
    <span style={{ fontSize: 13, color: up ? '#10b981' : '#ef4444', fontWeight: 600 }}>
      {up ? '↑' : '↓'} {up ? '+' : ''}
      {value} this week
    </span>
  );
}

export function TeamHealthScoreSkeleton() {
  return (
    <div style={card} aria-busy="true" aria-label="Loading team health">
      <Bar w={130} h={13} />
      <div style={{ height: 10 }} />
      <Bar w={96} h={40} />
      <div style={{ height: 10 }} />
      <Bar w={190} h={12} />
    </div>
  );
}

function Bar({ w, h }: { w: number | string; h: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 5,
        background: 'linear-gradient(90deg,#1f1f23 25%,#27272a 50%,#1f1f23 75%)',
        backgroundSize: '200% 100%',
        animation: 'safesql-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

export function TeamHealthScore({ data }: { data: HealthSummary }) {
  const { health_score, trend, validation_count, has_enough_data, min_validations, window_days } =
    data;

  if (!has_enough_data) {
    return (
      <div style={card}>
        <div style={{ fontSize: 12.5, color: '#a1a1aa', marginBottom: 6 }}>Team Health</div>
        <div style={{ fontSize: 15, color: '#e4e4e7', marginBottom: 6 }}>
          Not enough data yet (need {min_validations}+ validations)
        </div>
        <div style={{ fontSize: 12.5, color: '#71717a' }}>
          {validation_count} validation{validation_count === 1 ? '' : 's'} in the last {window_days}{' '}
          days. A score built on fewer than {min_validations} is noise, so we hold it back.
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 12.5, color: '#a1a1aa', marginBottom: 4 }}>Team Health</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            lineHeight: 1,
            color: scoreColor(health_score),
          }}
        >
          {health_score}
        </div>
        <Trend value={trend} />
      </div>
      <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 10 }}>
        Based on {validation_count} validation{validation_count === 1 ? '' : 's'} in the last{' '}
        {window_days} days
      </div>
    </div>
  );
}
