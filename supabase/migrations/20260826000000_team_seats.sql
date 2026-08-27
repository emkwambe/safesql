-- Sprint 6B — make 5 seats real.
--
-- MANUAL APPLY: paste into the Supabase SQL Editor and run. Nothing here is run
-- automatically.
--
-- FULLY IDEMPOTENT AND SAFE TO RE-RUN. It is also safe to run whether or not
-- 20260609000000_teams_model.sql was ever applied: sections 1-3 recreate those
-- objects with IF NOT EXISTS, matching that file verbatim so no schema drift is
-- introduced. If Sprint 9 was already applied, sections 1-3 are no-ops.
--
-- RUN SECTION 0 FIRST and read the output before running the rest.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — PRE-FLIGHT. Run this alone first.
-- ═══════════════════════════════════════════════════════════════════════════
-- Tells you (a) whether the Sprint 9 tables exist, (b) whether validations
-- already has team_id, and (c) CRITICALLY whether RLS is currently enabled on
-- validations. Section 5 behaves differently depending on (c).
--
--   SELECT
--     to_regclass('public.teams')             AS teams_tbl,
--     to_regclass('public.team_members')      AS members_tbl,
--     to_regclass('public.team_invitations')  AS invites_tbl,
--     to_regclass('public.validations')       AS validations_tbl,
--     EXISTS (SELECT 1 FROM information_schema.columns
--              WHERE table_schema='public' AND table_name='validations'
--                AND column_name='team_id')   AS validations_has_team_id,
--     (SELECT relrowsecurity FROM pg_class
--       WHERE oid='public.validations'::regclass) AS validations_rls_enabled;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — teams  (no-op if Sprint 9 was applied)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'team',   -- 'team' | 'business' | 'enterprise'
  created_by TEXT NOT NULL,                  -- clerk_user_id of founder
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team members read team" ON public.teams;
CREATE POLICY "team members read team" ON public.teams FOR SELECT
  USING (id IN (SELECT team_id FROM public.team_members
                 WHERE clerk_user_id = current_setting('app.clerk_user_id', true)));

DROP POLICY IF EXISTS "founder creates team" ON public.teams;
CREATE POLICY "founder creates team" ON public.teams FOR INSERT
  WITH CHECK (created_by = current_setting('app.clerk_user_id', true));

DROP POLICY IF EXISTS "team managers update team" ON public.teams;
CREATE POLICY "team managers update team" ON public.teams FOR UPDATE
  USING (id IN (SELECT team_id FROM public.team_members
                 WHERE clerk_user_id = current_setting('app.clerk_user_id', true)
                   AND role IN ('owner', 'manager')));

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — team_members  (no-op if Sprint 9 was applied)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'manager' | 'member'
  email         TEXT NOT NULL,                   -- denormalized for display
  display_name  TEXT,
  invited_by    TEXT,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, clerk_user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members (clerk_user_id);
CREATE INDEX IF NOT EXISTS team_members_team_idx ON public.team_members (team_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team members read members" ON public.team_members;
CREATE POLICY "team members read members" ON public.team_members FOR SELECT
  USING (team_id IN (SELECT team_id FROM public.team_members m2
                      WHERE m2.clerk_user_id = current_setting('app.clerk_user_id', true)));

DROP POLICY IF EXISTS "user inserts own membership" ON public.team_members;
CREATE POLICY "user inserts own membership" ON public.team_members FOR INSERT
  WITH CHECK (clerk_user_id = current_setting('app.clerk_user_id', true));

DROP POLICY IF EXISTS "managers manage members" ON public.team_members;
CREATE POLICY "managers manage members" ON public.team_members FOR UPDATE
  USING (team_id IN (SELECT team_id FROM public.team_members
                      WHERE clerk_user_id = current_setting('app.clerk_user_id', true)
                        AND role IN ('owner', 'manager')));

DROP POLICY IF EXISTS "managers delete members" ON public.team_members;
CREATE POLICY "managers delete members" ON public.team_members FOR DELETE
  USING (team_id IN (SELECT team_id FROM public.team_members
                      WHERE clerk_user_id = current_setting('app.clerk_user_id', true)
                        AND role IN ('owner', 'manager')));

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — team_invitations  (needed for the email invite flow)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  token       TEXT UNIQUE NOT NULL,
  invited_by  TEXT NOT NULL,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_invitations_token_idx ON public.team_invitations (token);
-- New in 6B: the seat-cap trigger counts pending invites per team.
CREATE INDEX IF NOT EXISTS team_invitations_team_pending_idx
  ON public.team_invitations (team_id) WHERE accepted_at IS NULL;

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "managers create invitations" ON public.team_invitations;
CREATE POLICY "managers create invitations" ON public.team_invitations FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM public.team_members
                           WHERE clerk_user_id = current_setting('app.clerk_user_id', true)
                             AND role IN ('owner', 'manager')));

DROP POLICY IF EXISTS "invitees read own invitation" ON public.team_invitations;
CREATE POLICY "invitees read own invitation" ON public.team_invitations FOR SELECT
  USING (
    token = current_setting('app.invitation_token', true)
    OR team_id IN (SELECT team_id FROM public.team_members
                    WHERE clerk_user_id = current_setting('app.clerk_user_id', true)
                      AND role IN ('owner', 'manager'))
  );

DROP POLICY IF EXISTS "invitees accept own invitation" ON public.team_invitations;
CREATE POLICY "invitees accept own invitation" ON public.team_invitations FOR UPDATE
  USING (token = current_setting('app.invitation_token', true));

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — SEAT CAP
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: this is a trigger, not an RLS policy. RLS filters rows; it cannot
-- aggregate, so it cannot express "at most N rows per team". A BEFORE INSERT
-- trigger is enforced server-side for every client, which is the guarantee
-- an RLS policy was being asked for.

CREATE OR REPLACE FUNCTION public.seat_limit_for_plan(p TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
           WHEN 'team'     THEN 5
           WHEN 'business' THEN 20
           ELSE NULL                 -- enterprise / unknown: uncapped
         END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_seat_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cap  INT;
  used INT;
BEGIN
  SELECT public.seat_limit_for_plan(t.plan) INTO cap
    FROM public.teams t WHERE t.id = NEW.team_id;

  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  -- Seated members PLUS live pending invitations. Counting members alone lets
  -- an owner issue 4 invitations against 1 free seat and land at 9 members.
  SELECT (SELECT count(*) FROM public.team_members
           WHERE team_id = NEW.team_id)
       + (SELECT count(*) FROM public.team_invitations
           WHERE team_id = NEW.team_id
             AND accepted_at IS NULL
             AND expires_at > NOW())
    INTO used;

  IF used >= cap THEN
    RAISE EXCEPTION
      'Seat limit reached: % of % seats in use (members + pending invitations).', used, cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_seat_cap ON public.team_members;
CREATE TRIGGER team_members_seat_cap
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_cap();

DROP TRIGGER IF EXISTS team_invitations_seat_cap ON public.team_invitations;
CREATE TRIGGER team_invitations_seat_cap
  BEFORE INSERT ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_cap();

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — validations.team_id
-- ═══════════════════════════════════════════════════════════════════════════
-- src/services/persistValidation.ts already WRITES team_id. Nothing ever
-- created the column: `validations` predates the migration files in this repo.
ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS validations_team_idx
  ON public.validations (team_id, created_at DESC);

-- Backfill: attribute existing rows to the author's current team, if any.
UPDATE public.validations v
   SET team_id = tm.team_id
  FROM public.users u
  JOIN public.team_members tm ON tm.clerk_user_id = u.clerk_user_id
 WHERE v.user_id = u.id
   AND v.team_id IS NULL;

-- ── 5b. RLS on validations ──────────────────────────────────────────────────
-- ⚠️ READ THIS BEFORE RUNNING.
--
-- If SECTION 0 reported validations_rls_enabled = false, this block CHANGES the
-- security posture of an existing table. Both policies below are created
-- together so INSERT is never left without a policy — enabling RLS with only a
-- SELECT policy would silently break every write from the app.
--
-- If you would rather not touch RLS on validations yet, skip 5b entirely. The
-- team-history feature still works: the client filters on team_id, it is simply
-- not enforced at the database layer.

ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "validations_owner_or_team_read" ON public.validations;
CREATE POLICY "validations_owner_or_team_read" ON public.validations FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users
                 WHERE clerk_user_id = current_setting('app.clerk_user_id', true))
    OR team_id IN (SELECT team_id FROM public.team_members
                    WHERE clerk_user_id = current_setting('app.clerk_user_id', true))
  );

DROP POLICY IF EXISTS "validations_owner_insert" ON public.validations;
CREATE POLICY "validations_owner_insert" ON public.validations FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM public.users
                 WHERE clerk_user_id = current_setting('app.clerk_user_id', true))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6 — VERIFY. Run after the above.
-- ═══════════════════════════════════════════════════════════════════════════
--   -- Objects exist
--   SELECT to_regclass('public.teams'), to_regclass('public.team_members'),
--          to_regclass('public.team_invitations');
--
--   -- Seat helper returns 5 / 20 / NULL
--   SELECT public.seat_limit_for_plan('team')       AS should_be_5,
--          public.seat_limit_for_plan('business')   AS should_be_20,
--          public.seat_limit_for_plan('enterprise') AS should_be_null;
--
--   -- Both triggers are attached
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--    WHERE tgname IN ('team_members_seat_cap', 'team_invitations_seat_cap');
--
--   -- team_id landed and backfilled
--   SELECT count(*) FILTER (WHERE team_id IS NOT NULL) AS with_team,
--          count(*)                                    AS total
--     FROM public.validations;
