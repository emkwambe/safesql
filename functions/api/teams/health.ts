import type { Env } from '../../_shared';
import { admin, callerId, jsonRes, membershipOf, preflight } from './_shared';

// Sprint 7 — GET /api/teams/health. Team-level SQL quality trend.
//
// Reads the REAL validations columns: risk_score (not `score`), report jsonb
// (not an `issues` column), user_id as a users.id UUID (there is no
// user_clerk_id). Verdicts are derived here rather than stored, because
// `validations` has no verdict column.
//
// Query params:
//   ?days=30   window for the headline score (7 | 30 | 90, default 30)

const MIN_VALIDATIONS = 5; // below this the UI shows "Not enough data yet"
const MAX_ROWS = 2000;
const TOP_ISSUES = 8;

interface ReportShape {
  errors?: { id?: string }[];
  warnings?: { id?: string }[];
}

interface Row {
  user_id?: string;
  risk_score?: number | null;
  report?: ReportShape | null;
  created_at?: string;
}

/** Reuses the shipped score bands so /team agrees with the CLI and the SDK. */
export function verdictFor(score: number): 'RISKY' | 'REVIEW' | 'SAFE' {
  if (score < 50) return 'RISKY';
  if (score < 85) return 'REVIEW';
  return 'SAFE';
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD, UTC
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

/** Distinct detector ids in one validation — once per (validation, detector). */
function issueIdsOf(r: Row): string[] {
  const ids = [...(r.report?.errors ?? []), ...(r.report?.warnings ?? [])]
    .map((i) => i?.id)
    .filter((id): id is string => !!id);
  return [...new Set(ids)];
}

export const onRequestOptions = preflight;

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  const clerkUserId = await callerId(request, env);
  if (!clerkUserId) return jsonRes({ error: 'Authentication required' }, 401);

  const db = admin(env);
  const membership = await membershipOf(db, clerkUserId);
  if (!membership) return jsonRes({ error: 'You do not belong to a team' }, 403);
  const { team } = membership;

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get('days'));
  const days = [7, 30, 90].includes(requested) ? requested : 30;

  const now = Date.now();
  const dayMs = 86_400_000;
  const windowStart = new Date(now - days * dayMs);
  // Fetch two windows so "trending" is a comparison, not a guess.
  const fetchStart = new Date(now - days * 2 * dayMs);

  const { data, error } = await db
    .from('validations')
    .select('user_id, risk_score, report, created_at')
    .eq('team_id', team.id)
    .gte('created_at', fetchStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) return jsonRes({ error: `Could not read validations: ${error.message}` }, 500);

  const all = (data ?? []) as Row[];
  const current = all.filter((r) => r.created_at && new Date(r.created_at) >= windowStart);
  const previous = all.filter((r) => r.created_at && new Date(r.created_at) < windowStart);

  const scoresOf = (rows: Row[]) =>
    rows.map((r) => r.risk_score).filter((s): s is number => typeof s === 'number');

  const healthScore = mean(scoresOf(current));

  // Trend: this week vs the week before. Reported as null rather than 0 when
  // either week is empty — "no change" and "no data" are different claims.
  const weekAgo = new Date(now - 7 * dayMs);
  const twoWeeksAgo = new Date(now - 14 * dayMs);
  const thisWeek = scoresOf(
    all.filter((r) => r.created_at && new Date(r.created_at) >= weekAgo),
  );
  const lastWeek = scoresOf(
    all.filter(
      (r) =>
        r.created_at &&
        new Date(r.created_at) >= twoWeeksAgo &&
        new Date(r.created_at) < weekAgo,
    ),
  );
  const trend = thisWeek.length && lastWeek.length ? mean(thisWeek) - mean(lastWeek) : null;

  // Daily averages across the window. Days with no validations are emitted with
  // avg_score null so the chart can break the line instead of drawing a
  // misleading drop to zero.
  const byDay = new Map<string, number[]>();
  for (const r of current) {
    if (!r.created_at || typeof r.risk_score !== 'number') continue;
    const k = dayKey(r.created_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(r.risk_score);
  }
  const dailyScores: { date: string; avg_score: number | null; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now - i * dayMs).toISOString().slice(0, 10);
    const xs = byDay.get(key);
    dailyScores.push({
      date: key,
      avg_score: xs?.length ? mean(xs) : null,
      count: xs?.length ?? 0,
    });
  }

  // Issue frequency, current window vs the one before it.
  const countIssues = (rows: Row[]) => {
    const m = new Map<string, number>();
    for (const r of rows) for (const id of issueIdsOf(r)) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const curIssues = countIssues(current);
  const prevIssues = countIssues(previous);

  const topIssues = [...curIssues.entries()]
    .map(([issue_type, count]) => {
      const before = prevIssues.get(issue_type) ?? 0;
      // Stable unless the change is material: ±1 on small numbers is noise.
      let trendDir: 'up' | 'down' | 'stable' = 'stable';
      if (previous.length > 0) {
        const delta = count - before;
        const threshold = Math.max(1, Math.round(before * 0.2));
        if (delta > threshold) trendDir = 'up';
        else if (delta < -threshold) trendDir = 'down';
      }
      return {
        issue_type,
        count,
        previous_count: before,
        trend: trendDir,
        pct: current.length ? Math.round((count / current.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count || a.issue_type.localeCompare(b.issue_type))
    .slice(0, TOP_ISSUES);

  // Member scores. validations.user_id is a users.id UUID, so attribution goes
  // through users -> team_members; there is no user_clerk_id on validations.
  const { data: memberRows } = await db
    .from('team_members')
    .select('clerk_user_id, email, display_name')
    .eq('team_id', team.id);
  const members = memberRows ?? [];

  const clerkIds = members.map((m) => m.clerk_user_id).filter(Boolean);
  const { data: userRows } = clerkIds.length
    ? await db.from('users').select('id, clerk_user_id').in('clerk_user_id', clerkIds)
    : { data: [] as { id: string; clerk_user_id: string }[] };

  const userIdToClerk = new Map<string, string>();
  for (const u of userRows ?? []) userIdToClerk.set(u.id, u.clerk_user_id);

  const byMember = new Map<string, number[]>();
  for (const r of current) {
    if (!r.user_id || typeof r.risk_score !== 'number') continue;
    const clerk = userIdToClerk.get(r.user_id);
    if (!clerk) continue;
    if (!byMember.has(clerk)) byMember.set(clerk, []);
    byMember.get(clerk)!.push(r.risk_score);
  }

  const memberScores = members
    .map((m) => {
      const xs = byMember.get(m.clerk_user_id) ?? [];
      return {
        clerk_user_id: m.clerk_user_id,
        name: m.display_name || m.email,
        avg_score: xs.length ? mean(xs) : null,
        count: xs.length,
        // The leaderboard needs a floor, or one lucky validation tops the board.
        qualifies: xs.length >= MIN_VALIDATIONS,
      };
    })
    .sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1) || b.count - a.count);

  const verdictCounts = { RISKY: 0, REVIEW: 0, SAFE: 0 };
  for (const s of scoresOf(current)) verdictCounts[verdictFor(s)] += 1;

  return jsonRes({
    window_days: days,
    health_score: healthScore,
    trend,
    validation_count: current.length,
    // The UI shows "Not enough data yet" rather than a headline built on 2 rows.
    has_enough_data: current.length >= MIN_VALIDATIONS,
    min_validations: MIN_VALIDATIONS,
    verdict_counts: verdictCounts,
    daily_scores: dailyScores,
    top_issues: topIssues,
    member_scores: memberScores,
    previous_window_count: previous.length,
  });
};
