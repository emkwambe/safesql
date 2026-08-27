import type { Env } from '../../_shared';
import { admin, callerId, jsonRes, membershipOf, preflight, seatUsage } from './_shared';

// Sprint 6B — GET /api/teams/dashboard.
//
// Team info, members, the last 20 team validations, and the top 5 issue types
// across the team. One round trip so #/team paints in a single fetch.

interface ReportShape {
  errors?: { id?: string }[];
  warnings?: { id?: string }[];
}

interface ValidationRow {
  id?: string;
  user_id?: string;
  risk_score?: number;
  error_count?: number;
  warning_count?: number;
  report?: ReportShape | null;
  created_at?: string;
}

const RECENT_LIMIT = 20;
const TOP_ISSUES = 5;

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
  const { team, role } = membership;

  const { data: memberRows } = await db
    .from('team_members')
    .select('clerk_user_id, role, email, display_name, joined_at')
    .eq('team_id', team.id)
    .order('joined_at', { ascending: true });
  const members = memberRows ?? [];

  // Pending invitations render as "Pending" rows beside seated members.
  const { data: inviteRows } = await db
    .from('team_invitations')
    .select('id, email, role, created_at, expires_at')
    .eq('team_id', team.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  const pendingInvites = inviteRows ?? [];

  // validations.user_id is a users.id UUID, not a Clerk id — map through users
  // so each validation can be attributed to a member for the "by member" filter.
  const clerkIds = members.map((m) => m.clerk_user_id).filter(Boolean);
  const { data: userRows } = clerkIds.length
    ? await db.from('users').select('id, email, clerk_user_id').in('clerk_user_id', clerkIds)
    : { data: [] as { id: string; email?: string; clerk_user_id: string }[] };

  const byUserId = new Map<string, { email: string; clerk_user_id: string }>();
  for (const u of userRows ?? []) {
    byUserId.set(u.id, { email: u.email ?? '', clerk_user_id: u.clerk_user_id });
  }

  // team_id is the authoritative link (added in the 6B migration). Rows written
  // before that column existed are attributed via the author map below.
  const { data: validationRows } = await db
    .from('validations')
    .select('id, user_id, risk_score, error_count, warning_count, report, dialect, created_at')
    .eq('team_id', team.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (validationRows ?? []) as ValidationRow[];

  const topIssueOf = (r: ValidationRow): string | null => {
    const errs = (r.report?.errors ?? []).map((i) => i?.id).filter(Boolean);
    if (errs.length) return errs[0] as string;
    const warns = (r.report?.warnings ?? []).map((i) => i?.id).filter(Boolean);
    return (warns[0] as string) ?? null;
  };

  const recent = rows.slice(0, RECENT_LIMIT).map((r) => {
    const author = r.user_id ? byUserId.get(r.user_id) : undefined;
    return {
      id: r.id ?? null,
      clerk_user_id: author?.clerk_user_id ?? null,
      member: author?.email ?? 'unknown',
      risk_score: r.risk_score ?? null,
      error_count: r.error_count ?? 0,
      warning_count: r.warning_count ?? 0,
      // The most severe finding, errors first. There is no SQL preview: only a
      // SHA-256 hash of the query is stored, which /compliance states publicly.
      topIssue: topIssueOf(r),
      dialect: (r as { dialect?: string }).dialect ?? null,
      created_at: r.created_at ?? null,
    };
  });

  // Top issue types across the whole window, not just the 20 shown — a "top
  // issues" figure computed from one page of results would be noise.
  const counts = new Map<string, number>();
  for (const r of rows) {
    const ids = [...(r.report?.errors ?? []), ...(r.report?.warnings ?? [])]
      .map((i) => i?.id)
      .filter((id): id is string => !!id);
    // Once per (validation, detector): a detector firing twice in one query is
    // one problem, matching benchmark/METHODOLOGY.md section 4.2.
    for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const total = rows.length || 1;
  const topIssues = [...counts.entries()]
    .map(([issueType, count]) => ({
      issueType,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.issueType.localeCompare(b.issueType))
    .slice(0, TOP_ISSUES);

  return jsonRes({
    team,
    role,
    seats: await seatUsage(db, team),
    members,
    pendingInvites,
    recent,
    topIssues,
    validationsAnalysed: rows.length,
  });
};
