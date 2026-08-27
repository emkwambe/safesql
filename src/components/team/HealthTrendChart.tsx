import type { DailyScore } from './healthChartTypes';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Sprint 7 — 30-day team health trend.
//
// This module is the ONLY place recharts is imported, and Team.tsx loads it with
// React.lazy — so the ~100 KB library lands in its own chunk, fetched only by
// signed-in team users, and never reaches the landing page or editor bundles.
//
// Days with no validations arrive as avg_score: null. recharts breaks the line
// at nulls with connectNulls={false}, which is the honest rendering: a quiet
// weekend is a gap, not a crash to zero.


const card: React.CSSProperties = {
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 10,
  padding: 18,
};

function lineColor(latest: number | null): string {
  if (latest === null) return '#71717a';
  if (latest < 50) return '#ef4444';
  if (latest <= 70) return '#f59e0b';
  return '#10b981';
}

/** "2026-08-25" -> "Aug 25". Parsed as UTC to match the server's day buckets. */
function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

interface TooltipEntry {
  payload?: DailyScore;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div
      style={{
        background: '#0f0f11',
        border: '1px solid #27272a',
        borderRadius: 6,
        padding: '7px 10px',
        fontSize: 12,
        color: '#e4e4e7',
      }}
    >
      {p.avg_score === null
        ? `${shortDay(p.date)}: no validations`
        : `${shortDay(p.date)}: avg score ${p.avg_score} (${p.count} validation${p.count === 1 ? '' : 's'})`}
    </div>
  );
}

export function HealthTrendChart({ data }: { data: DailyScore[] }) {
  const withData = data.filter((d) => d.avg_score !== null);

  if (withData.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '30px 18px' }}>
        <p style={{ color: '#a1a1aa', fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
          Validate SQL with your team to see trends here.
        </p>
      </div>
    );
  }

  const latest = withData[withData.length - 1]?.avg_score ?? null;
  const stroke = lineColor(latest);

  return (
    <div style={{ ...card, paddingLeft: 6 }}>
      <div style={{ width: '100%', height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: -18 }}>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDay}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
              minTickGap={26}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#3f3f46' }} />
            <Line
              type="monotone"
              dataKey="avg_score"
              stroke={stroke}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: stroke }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
