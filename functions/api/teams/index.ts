import type { Env } from '../../_shared';
import { admin, callerId, jsonRes, membershipOf, preflight, slugify } from './_shared';

// Sprint 6B — POST /api/teams. Creates a team and seats the caller as owner.

export const onRequestOptions = preflight;

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  const clerkUserId = await callerId(request, env);
  if (!clerkUserId) return jsonRes({ error: 'Authentication required' }, 401);

  let body: { name?: unknown; email?: unknown; display_name?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonRes({ error: 'Invalid JSON body' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return jsonRes({ error: 'name is required' }, 400);
  if (name.length > 80) return jsonRes({ error: 'name must be 80 characters or fewer' }, 400);

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return jsonRes({ error: 'email is required' }, 400);

  const db = admin(env);

  // One team per user. Without this, creating a second team would orphan the
  // first — membershipOf() reads a single row.
  const existing = await membershipOf(db, clerkUserId);
  if (existing) {
    return jsonRes(
      { error: `You already belong to team "${existing.team.name}".`, team: existing.team },
      409,
    );
  }

  // Unique slug: try the base, then -2, -3, … Bounded so a pathological name
  // cannot spin.
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i <= 50; i++) {
    const { data: clash } = await db.from('teams').select('id').eq('slug', slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
    if (i === 50) return jsonRes({ error: 'Could not generate a unique slug' }, 409);
  }

  const { data: team, error: teamErr } = await db
    .from('teams')
    .insert({ name, slug, plan: 'team', created_by: clerkUserId })
    .select('id, name, slug, plan, created_by, created_at')
    .single();

  if (teamErr || !team) {
    return jsonRes({ error: `Could not create team: ${teamErr?.message ?? 'unknown error'}` }, 500);
  }

  const { error: memberErr } = await db.from('team_members').insert({
    team_id: team.id,
    clerk_user_id: clerkUserId,
    role: 'owner',
    email,
    display_name: typeof body.display_name === 'string' ? body.display_name.trim() : null,
    invited_by: null,
  });

  if (memberErr) {
    // Roll back rather than leave an ownerless team that nobody can read or
    // delete — RLS gates team access on team_members.
    await db.from('teams').delete().eq('id', team.id);
    return jsonRes({ error: `Could not seat owner: ${memberErr.message}` }, 500);
  }

  return jsonRes({ team, role: 'owner' }, 201);
};
