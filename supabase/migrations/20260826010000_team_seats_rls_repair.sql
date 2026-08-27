-- Sprint 6B REPAIR — restore Clerk-JWT RLS after 20260826000000_team_seats.sql.
--
-- ⚠️ APPLY THIS IMMEDIATELY IF YOU APPLIED 20260826000000_team_seats.sql.
--
-- WHAT WENT WRONG
-- Sections 1-3 of that migration reproduced the teams / team_members /
-- team_invitations policies verbatim from the Sprint 9 file
-- (20260609000000_teams_model.sql), which gates on
--     current_setting('app.clerk_user_id', true)
--
-- That pattern was already known-broken and had been replaced by
-- 20260610010000_fix_rls_clerk_jwt.sql, whose header states plainly: the GUC
-- "only works if some server layer runs SET app.clerk_user_id before each
-- query. The browser talks to PostgREST directly with the Clerk session JWT
-- and never sets that GUC, so those policies matched nobody and the features
-- silently returned zero rows."
--
-- Because the 6B migration ran DROP POLICY IF EXISTS before each CREATE, it
-- silently reverted that fix. Symptom: teams, team members and invitations all
-- return zero rows in the browser, with no error.
--
-- This file re-applies the correct auth.jwt() ->> 'sub' policies (identical to
-- the 20260610010000 fix) and corrects the validations policies added in 6B
-- section 5b, which had the same defect.
--
-- Idempotent and safe to re-run. MANUAL APPLY: paste into the Supabase SQL
-- Editor and run.

-- ── teams ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "team members read team" ON public.teams;
CREATE POLICY "team members read team"
  ON public.teams FOR SELECT
  USING (id IN (
    SELECT team_id FROM public.team_members
    WHERE clerk_user_id = (auth.jwt() ->> 'sub')
  ));

DROP POLICY IF EXISTS "founder creates team" ON public.teams;
CREATE POLICY "founder creates team"
  ON public.teams FOR INSERT
  WITH CHECK (created_by = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "team managers update team" ON public.teams;
CREATE POLICY "team managers update team"
  ON public.teams FOR UPDATE
  USING (id IN (
    SELECT team_id FROM public.team_members
    WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      AND role IN ('owner', 'manager')
  ));

-- ── team_members ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "team members read members" ON public.team_members;
CREATE POLICY "team members read members"
  ON public.team_members FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.team_members m2
    WHERE m2.clerk_user_id = (auth.jwt() ->> 'sub')
  ));

DROP POLICY IF EXISTS "user inserts own membership" ON public.team_members;
CREATE POLICY "user inserts own membership"
  ON public.team_members FOR INSERT
  WITH CHECK (clerk_user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "managers manage members" ON public.team_members;
CREATE POLICY "managers manage members"
  ON public.team_members FOR UPDATE
  USING (team_id IN (
    SELECT team_id FROM public.team_members
    WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      AND role IN ('owner', 'manager')
  ));

DROP POLICY IF EXISTS "managers delete members" ON public.team_members;
CREATE POLICY "managers delete members"
  ON public.team_members FOR DELETE
  USING (team_id IN (
    SELECT team_id FROM public.team_members
    WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      AND role IN ('owner', 'manager')
  ));

-- ── team_invitations ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "managers create invitations" ON public.team_invitations;
CREATE POLICY "managers create invitations"
  ON public.team_invitations FOR INSERT
  WITH CHECK (team_id IN (
    SELECT team_id FROM public.team_members
    WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      AND role IN ('owner', 'manager')
  ));

-- Mixed policy: the invitation-token branch is a separate GUC and is correct
-- as-is (an invitee is not signed in yet). Only the member branch converts.
DROP POLICY IF EXISTS "invitees read own invitation" ON public.team_invitations;
CREATE POLICY "invitees read own invitation"
  ON public.team_invitations FOR SELECT
  USING (
    token = current_setting('app.invitation_token', true)
    OR team_id IN (
      SELECT team_id FROM public.team_members
      WHERE clerk_user_id = (auth.jwt() ->> 'sub')
        AND role IN ('owner', 'manager')
    )
  );

-- "invitees accept own invitation" uses only app.invitation_token and is
-- intentionally left unchanged.

-- ── validations (added in 6B section 5b with the same defect) ────────────────
DROP POLICY IF EXISTS "validations_owner_or_team_read" ON public.validations;
CREATE POLICY "validations_owner_or_team_read"
  ON public.validations FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE clerk_user_id = (auth.jwt() ->> 'sub')
    )
    OR team_id IN (
      SELECT team_id FROM public.team_members
      WHERE clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "validations_owner_insert" ON public.validations;
CREATE POLICY "validations_owner_insert"
  ON public.validations FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — every policy below should show `auth.jwt()`, and none should show
-- `app.clerk_user_id`. The only permitted GUC is app.invitation_token.
-- ═══════════════════════════════════════════════════════════════════════════
--   SELECT tablename, policyname,
--          qual  LIKE '%app.clerk_user_id%' AS still_broken_qual,
--          with_check LIKE '%app.clerk_user_id%' AS still_broken_check
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('teams','team_members','team_invitations','validations')
--    ORDER BY tablename, policyname;
--
-- Expect still_broken_qual / still_broken_check = false on every row.
