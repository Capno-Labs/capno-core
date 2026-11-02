-- ─────────────────────────────────────────────────────────────────────────────
-- Capno migration 0004 — scenario review state + version pinning
--
-- Apply order: db/schema.sql (fresh installs) OR 0002 → 0003 → 0004 for
-- installations that already ran an earlier schema. Idempotent: every step
-- is `if not exists` / `create or replace`, so re-running is safe. Fresh
-- installs get the final state from db/schema.sql directly.
--
-- Compatibility: the app now selects `scenarios.status` and
-- `scenarios.approved_version_id` on pull and writes
-- `sessions.scenario_version_id` on push. A self-hosted database that has not
-- run this migration fails those statements (the pull returns nothing; the
-- session push stays queued in the outbox) — the same precedent as 0003's
-- `session_code`. Run this file before deploying an app build at or after it.
--
--   1. scenarios.status ('draft' | 'review' | 'published') plus
--      approved_version_id / approved_by / approved_at. `is_published` stays
--      (the hosted layer's RLS reads it) and is now derived by trigger from
--      status — never write it directly in new code.
--   2. scenario_versions.approved_by / approved_at — the version row an
--      approval pinned, stamped by the trigger. Version rows are append-only
--      (no UPDATE policy exists); approval stamps are the only writes.
--   3. sessions.scenario_version_id — the exact version a session ran
--      against. Nullable: offline runs and pre-0004 archives have none.
--   4. can_publish_scenario(org) — the approval permission hook.
--   5. Triggers scenarios_review_guard and sessions_version_guard.
--   6. Backfill: published heads become status 'published' pinned to a
--      version row equal to the head (created from the head when missing).
--
-- Apply in the Supabase SQL editor or with:
--   psql "$DATABASE_URL" -f db/migrations/0004_scenario_review.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1–3. Columns ─────────────────────────────────────────────────────────────

alter table public.scenarios
  add column if not exists status text not null default 'draft';
alter table public.scenarios
  drop constraint if exists scenarios_status_check;
alter table public.scenarios
  add constraint scenarios_status_check check (status in ('draft', 'review', 'published'));
alter table public.scenarios
  add column if not exists approved_version_id bigint
    references public.scenario_versions (id) on delete set null;
alter table public.scenarios
  add column if not exists approved_by uuid references public.profiles (id) on delete set null;
alter table public.scenarios
  add column if not exists approved_at timestamptz;

alter table public.scenario_versions
  add column if not exists approved_by uuid references public.profiles (id) on delete set null;
alter table public.scenario_versions
  add column if not exists approved_at timestamptz;

alter table public.sessions
  add column if not exists scenario_version_id bigint
    references public.scenario_versions (id) on delete set null;
create index if not exists sessions_by_version on public.sessions (scenario_version_id);

-- ── 4. Approval permission hook ──────────────────────────────────────────────
-- CONTRACT: the signature `can_publish_scenario(org uuid) returns boolean` is
-- fixed. The hosted layer replaces the body with `create or replace function`
-- (organization roles, per-member approval rights); the triggers below only
-- ever call it by this name and signature. Core semantics: any faculty or
-- admin account may publish. Callers without a JWT (service role, the SQL
-- editor, seeds, this migration's backfill) have no auth.uid() and are
-- trusted. `org` is unused here — core's `scenarios` has no org_id column.
create or replace function public.can_publish_scenario(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.current_role() in ('faculty', 'admin');
$$;

-- ── 6. Backfill (before the trigger exists on first run; a no-op after) ──────
-- Published heads with no version row equal to the head get one, so the
-- invariant "a published head equals its approved version" holds from the
-- start. Then every published head is pinned to the newest matching version.
insert into public.scenario_versions (scenario_id, version, definition, saved_by, saved_at)
select s.id, coalesce(s.definition ->> 'version', ''), s.definition, s.owner_id, s.updated_at
from public.scenarios s
where s.is_published
  and s.status <> 'published'
  and not exists (
    select 1 from public.scenario_versions v
    where v.scenario_id = s.id and v.definition = s.definition
  );

update public.scenarios s
set status = 'published',
    approved_version_id = (
      select v.id from public.scenario_versions v
      where v.scenario_id = s.id and v.definition = s.definition
      order by v.saved_at desc, v.id desc
      limit 1
    ),
    approved_by = s.owner_id,
    approved_at = s.updated_at
where s.is_published
  and s.status <> 'published';

update public.scenario_versions v
set approved_by = s.approved_by,
    approved_at = s.approved_at
from public.scenarios s
where s.approved_version_id = v.id
  and v.approved_at is null;

-- ── 5. Triggers ──────────────────────────────────────────────────────────────

-- Review-state guard for scenario heads.
--
--   * Client INSERT (auth.uid() present): always a draft, approvals cleared —
--     a client cannot create a published scenario in one write.
--   * Trusted INSERT (no auth.uid(): service role, SQL editor, seeds) with
--     is_published or status 'published' → published. No version pin exists
--     yet (the head row is not visible to the FK until the statement ends),
--     so seeds stay unpinned until the first approval or client save.
--   * Legacy writers that flip is_published directly (status untouched) are
--     translated to the matching status, so `update … set is_published = true`
--     in the SQL editor still works.
--   * Immutability: editing `definition` on a published head without
--     re-pinning demotes it to 'draft' and clears approvals. The approved
--     scenario_versions row is never touched; sessions keep pointing at it.
--   * Publishing (status becomes 'published', or the pin / definition of a
--     published head changes) requires can_publish_scenario(org) and an
--     approved_version_id that is a version of this scenario whose definition
--     equals the head. Trusted callers may publish without a pin; a version
--     row is created from the head for them. Failures raise 42501, which the
--     app classifies as permanent (no retry).
--   * approved_by / approved_at on the head and the pinned version row are
--     trigger-owned: clients cannot set or alter them.
--   * is_published is always derived: (status = 'published').
--
-- org_id: core's `scenarios` has no such column; the hosted layer adds one in
-- its own migration. `to_jsonb(new) ->> 'org_id'` reads it when present and
-- yields null otherwise, so one function body serves both schemas without a
-- compile-time column reference.
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

drop trigger if exists scenarios_review_guard on public.scenarios;
create trigger scenarios_review_guard
  before insert or update on public.scenarios
  for each row execute function public.scenarios_review_guard();

-- A session's version pin must belong to its scenario. A stale or foreign
-- pin is dropped, never rejected: an archive push must always succeed (the
-- frozen scenario_snapshot preserves the definition either way).
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

drop trigger if exists sessions_version_guard on public.sessions;
create trigger sessions_version_guard
  before insert or update on public.sessions
  for each row execute function public.sessions_version_guard();
