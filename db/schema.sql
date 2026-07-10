-- ─────────────────────────────────────────────────────────────────────────────
-- Capno — Supabase/PostgreSQL schema (optional backend)
--
-- Capno runs fully offline without a database. This schema adds:
--   * accounts with roles (student / faculty / admin) via Supabase auth
--   * shared scenario storage with version history
--   * archived sessions for institution-wide debrief/analytics
--
-- Realtime vitals sync uses Supabase Realtime *broadcast* channels
-- (ephemeral pub/sub) — no rows are written per tick, so there is no
-- high-frequency table here by design.
--
-- Apply in the Supabase SQL editor or with:  psql "$DATABASE_URL" -f db/schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Roles ────────────────────────────────────────────────────────────────────

create type public.app_role as enum ('student', 'faculty', 'admin');

-- One profile row per auth user. Role changes are admin-only (see policies).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role public.app_role not null default 'student',
  institution text,
  created_at timestamptz not null default now()
);

-- Helper: current user's role (used by RLS policies).
create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'student');
$$;

-- Auto-create a profile on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Scenarios ────────────────────────────────────────────────────────────────

-- Current head of each scenario. `definition` is the full scenario JSON,
-- validated client-side against the zod schema (and versioned below).
create table public.scenarios (
  id text primary key,                       -- scenario id, e.g. 'anaphylaxis'
  title text not null,
  definition jsonb not null,
  is_published boolean not null default false, -- visible to all faculty
  owner_id uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Append-only version history (editor "Save version").
create table public.scenario_versions (
  id bigint generated always as identity primary key,
  scenario_id text not null references public.scenarios (id) on delete cascade,
  version text not null,
  definition jsonb not null,
  saved_by uuid references public.profiles (id) on delete set null,
  saved_at timestamptz not null default now()
);

create index scenario_versions_by_scenario
  on public.scenario_versions (scenario_id, saved_at desc);

-- ── Sessions (archived debriefs) ─────────────────────────────────────────────

create table public.sessions (
  id text primary key,                       -- '<4-char code>-<ended_at ISO>' (codes alone collide over time)
  scenario_id text references public.scenarios (id) on delete set null,
  scenario_snapshot jsonb not null,          -- frozen scenario as run
  sim_snapshot jsonb not null,               -- final SimSnapshot (log, actions, notes)
  score jsonb not null,                      -- ScoreReport
  history jsonb,                             -- VitalsHistorySample[] (debrief trend strip; kept out of sim_snapshot by design)
  faculty_id uuid references public.profiles (id) on delete set null,
  learner_names text[] not null default '{}',
  started_at timestamptz,
  ended_at timestamptz not null default now()
);

create index sessions_by_faculty on public.sessions (faculty_id, ended_at desc);
create index sessions_by_scenario on public.sessions (scenario_id, ended_at desc);

-- ── Row-level security ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_versions enable row level security;
alter table public.sessions enable row level security;

-- profiles: users read their own; admins read/update all; role is admin-managed.
create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'admin');
create policy "update own profile" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "admin manages profiles" on public.profiles
  for all using (public.current_role() = 'admin');

-- scenarios: faculty/admin author; published scenarios readable by any signed-in user.
create policy "read published or own scenarios" on public.scenarios
  for select using (
    is_published
    or owner_id = auth.uid()
    or public.current_role() in ('faculty', 'admin')
  );
create policy "faculty create scenarios" on public.scenarios
  for insert with check (public.current_role() in ('faculty', 'admin') and owner_id = auth.uid());
create policy "owner or admin update scenarios" on public.scenarios
  for update using (owner_id = auth.uid() or public.current_role() = 'admin');
create policy "owner or admin delete scenarios" on public.scenarios
  for delete using (owner_id = auth.uid() or public.current_role() = 'admin');

-- scenario_versions: readable wherever the head is readable; append by faculty.
create policy "read versions" on public.scenario_versions
  for select using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_id
        and (s.is_published or s.owner_id = auth.uid() or public.current_role() in ('faculty', 'admin'))
    )
  );
create policy "faculty append versions" on public.scenario_versions
  for insert with check (public.current_role() in ('faculty', 'admin'));

-- sessions: the running faculty owns the record; admins see all.
create policy "faculty read own sessions" on public.sessions
  for select using (faculty_id = auth.uid() or public.current_role() = 'admin');
create policy "faculty write own sessions" on public.sessions
  for insert with check (faculty_id = auth.uid() and public.current_role() in ('faculty', 'admin'));
-- Post-hoc debrief amendments (action re-marking, learner names) re-push.
create policy "faculty update own sessions" on public.sessions
  for update using (faculty_id = auth.uid())
  with check (faculty_id = auth.uid());
create policy "faculty delete own sessions" on public.sessions
  for delete using (faculty_id = auth.uid() or public.current_role() = 'admin');

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Nothing to create: Capno uses supabase.channel('capno:<CODE>') broadcast,
-- which requires no tables. To restrict channel access, configure Realtime
-- authorization (private channels) in the Supabase dashboard.

-- ── Seed data ────────────────────────────────────────────────────────────────
-- The 5 built-in scenarios ship in the app bundle (src/scenarios/*.json) and
-- do not need seeding. To make them editable institution-wide, import them
-- via the editor's Export → dashboard upload, or:
--
--   insert into public.scenarios (id, title, definition, is_published)
--   values ('anaphylaxis', 'Intraoperative Anaphylaxis', '<paste JSON>'::jsonb, true);
