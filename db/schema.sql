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
  -- Review state. `is_published` is kept for the hosted layer's RLS and is
  -- DERIVED from status by the scenarios_review_guard trigger — never write
  -- it directly in new code (migration 0004).
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  is_published boolean not null default false, -- visible to all faculty
  owner_id uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Append-only version history (editor "Save version"). No UPDATE policy
-- exists: once saved, a version's definition is immutable. The only writes
-- after insert are the trigger-owned approval stamps.
create table public.scenario_versions (
  id bigint generated always as identity primary key,
  scenario_id text not null references public.scenarios (id) on delete cascade,
  version text not null,
  definition jsonb not null,
  saved_by uuid references public.profiles (id) on delete set null,
  saved_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz
);

create index scenario_versions_by_scenario
  on public.scenario_versions (scenario_id, saved_at desc);

-- The version row an approval pinned: a published head always equals this
-- row's definition (enforced by scenarios_review_guard). Sessions pin to it.
alter table public.scenarios
  add column approved_version_id bigint references public.scenario_versions (id) on delete set null;

-- ── Sessions (archived debriefs) ─────────────────────────────────────────────

create table public.sessions (
  id text primary key,                       -- '<4-char code>-<ended_at ISO>' (codes alone collide over time)
  scenario_id text references public.scenarios (id) on delete set null,
  scenario_version_id bigint references public.scenario_versions (id) on delete set null, -- exact version run; null offline
  scenario_snapshot jsonb not null,          -- frozen scenario as run
  sim_snapshot jsonb not null,               -- final SimSnapshot (log, actions, notes)
  score jsonb not null,                      -- ScoreReport
  history jsonb,                             -- VitalsHistorySample[] (debrief trend strip; kept out of sim_snapshot by design)
  faculty_id uuid references public.profiles (id) on delete set null,
  learner_names text[] not null default '{}',
  session_code text,                         -- code students joined with; differs from id's code after "Run next student" reuse
  started_at timestamptz,
  ended_at timestamptz not null default now()
);

create index sessions_by_faculty on public.sessions (faculty_id, ended_at desc);
create index sessions_by_scenario on public.sessions (scenario_id, ended_at desc);
create index sessions_by_version on public.sessions (scenario_version_id);

-- ── Scenario review (approval state + version pinning) ───────────────────────
-- Mirrors db/migrations/0004_scenario_review.sql; the migration header has
-- the full rule list. Summary:
--   * client inserts are always drafts; trusted callers (no auth.uid()) may
--     insert published rows (seeds);
--   * publishing requires can_publish_scenario() and an approved_version_id
--     whose definition equals the head — else 42501;
--   * editing a published head's definition demotes it to 'draft'; the
--     approved version row is never modified (immutability);
--   * is_published is always (status = 'published').

-- CONTRACT: the signature `can_publish_scenario(org uuid) returns boolean` is
-- fixed — the hosted layer replaces the body with `create or replace`
-- (organization roles). Core: any faculty/admin; callers without a JWT are
-- trusted. `org` is unused here (core has no org_id column).
create or replace function public.can_publish_scenario(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.current_role() in ('faculty', 'admin');
$$;

-- org_id exists only in the hosted schema; `to_jsonb(new) ->> 'org_id'`
-- reads it when present and is null otherwise, so this body compiles in both.
create or replace function public.scenarios_review_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  trusted boolean := auth.uid() is null;
  org uuid := nullif(to_jsonb(new) ->> 'org_id', '')::uuid;
  publishing boolean := false;
  pin_ok boolean;
begin
  if tg_op = 'INSERT' then
    if trusted then
      if new.is_published or new.status = 'published' then
        new.status := 'published';
        publishing := true;
      end if;
    else
      new.status := 'draft';
      new.approved_version_id := null;
    end if;
  else
    -- Legacy writers: is_published flipped directly, status untouched.
    if new.status = old.status and new.is_published is distinct from old.is_published then
      new.status := case when new.is_published then 'published' else 'draft' end;
    end if;
    -- Immutability: a published head must equal its approved version.
    if old.status = 'published'
       and new.definition is distinct from old.definition
       and new.approved_version_id is not distinct from old.approved_version_id then
      new.status := 'draft';
    end if;
    if new.status = 'published' then
      publishing := old.status <> 'published'
        or new.approved_version_id is distinct from old.approved_version_id
        or new.definition is distinct from old.definition;
      if not publishing then
        -- Nothing to approve: the stamps stay exactly as they were.
        new.approved_version_id := old.approved_version_id;
        new.approved_by := old.approved_by;
        new.approved_at := old.approved_at;
      end if;
    end if;
  end if;

  if new.status <> 'published' then
    new.approved_version_id := null;
    new.approved_by := null;
    new.approved_at := null;
  elsif publishing then
    if not public.can_publish_scenario(org) then
      raise exception 'Not allowed to publish scenario "%" here.', new.id
        using errcode = '42501';
    end if;
    if new.approved_version_id is null then
      if not trusted then
        raise exception 'Publishing scenario "%" requires approved_version_id.', new.id
          using errcode = '42501';
      elsif tg_op = 'UPDATE' then
        -- Trusted publish without a pin: snapshot the head as the version.
        insert into public.scenario_versions (scenario_id, version, definition, saved_by)
        values (new.id, coalesce(new.definition ->> 'version', ''), new.definition, new.owner_id)
        returning id into new.approved_version_id;
      end if;
      -- Trusted INSERT: the head row does not exist yet, so no pin is possible.
    end if;
    if new.approved_version_id is not null then
      select exists (
        select 1 from public.scenario_versions v
        where v.id = new.approved_version_id
          and v.scenario_id = new.id
          and v.definition = new.definition
      ) into pin_ok;
      if not pin_ok then
        raise exception
          'approved_version_id % is not a version of scenario "%" equal to its definition.',
          new.approved_version_id, new.id
          using errcode = '42501';
      end if;
    end if;
    if trusted then
      new.approved_at := coalesce(new.approved_at, now());
    else
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;
    if new.approved_version_id is not null then
      update public.scenario_versions
      set approved_by = new.approved_by, approved_at = new.approved_at
      where id = new.approved_version_id;
    end if;
  end if;

  new.is_published := (new.status = 'published');
  return new;
end;
$$;

create trigger scenarios_review_guard
  before insert or update on public.scenarios
  for each row execute function public.scenarios_review_guard();

-- A session's version pin must belong to its scenario; a stale or foreign
-- pin is dropped, never rejected (archive pushes must always succeed).
create or replace function public.sessions_version_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.scenario_version_id is not null and (
    new.scenario_id is null
    or not exists (
      select 1 from public.scenario_versions v
      where v.id = new.scenario_version_id and v.scenario_id = new.scenario_id
    )
  ) then
    new.scenario_version_id := null;
  end if;
  return new;
end;
$$;

create trigger sessions_version_guard
  before insert or update on public.sessions
  for each row execute function public.sessions_version_guard();

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
--
-- Run from the SQL editor (no auth.uid()) this is a trusted insert: the
-- review trigger sets status = 'published'. The row has no pinned version
-- until the first approval or client save.
