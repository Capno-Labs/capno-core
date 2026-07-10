-- ─────────────────────────────────────────────────────────────────────────────
-- Capno migration 0002 — production layer
--
-- For installations that already ran an earlier db/schema.sql. Fresh installs
-- get all of this from db/schema.sql directly; this migration is idempotent
-- and safe to run either way.
--
--   1. sessions.history — the debrief trend-strip samples
--      (VitalsHistorySample[]). Deliberately a separate column: history is
--      never part of sim_snapshot.
--   2. UPDATE policy on sessions — post-hoc debrief amendments (action
--      re-marking, learner names) re-push as upserts and need it.
--
-- Apply in the Supabase SQL editor or with:
--   psql "$DATABASE_URL" -f db/migrations/0002_production_layer.sql
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.sessions add column if not exists history jsonb;

drop policy if exists "faculty update own sessions" on public.sessions;
create policy "faculty update own sessions" on public.sessions
  for update using (faculty_id = auth.uid())
  with check (faculty_id = auth.uid());

-- ── Faculty onboarding (run by hand, not part of the migration) ──────────────
-- New accounts default to the 'student' role, and RLS prevents users from
-- promoting themselves. An admin (or the SQL editor) promotes faculty:
--
--   update public.profiles set role = 'faculty' where id = '<user-uuid>';
--
-- Find the uuid in Auth → Users in the Supabase dashboard, or:
--
--   select u.id, u.email, p.role from auth.users u
--   join public.profiles p on p.id = u.id order by u.created_at;
