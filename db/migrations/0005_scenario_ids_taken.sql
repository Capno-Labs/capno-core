-- Which of a handful of candidate scenario ids are already in use.
--
-- `scenarios.id` is the primary key, so an id is unique across the whole
-- database, but row-level security only shows a caller the rows they may
-- read. A new case whose id someone else already owns therefore looks free
-- to the app and is then refused on insert. The app calls this before it
-- saves an imported case and picks an id that is not taken.
--
-- What it reveals: only whether each id the caller already guessed exists.
-- No titles, owners or definitions. Signed-in callers only, and at most 20
-- candidates per call (a longer list returns nothing).
--
-- Idempotent. App builds that call it work without it: the lookup fails,
-- the app saves as before, and a refused push is reported to the user.

create or replace function public.scenario_ids_taken(candidates text[])
returns setof text
language sql stable security definer set search_path = public as $$
  select s.id
  from public.scenarios s
  where auth.uid() is not null
    and coalesce(array_length(candidates, 1), 0) <= 20
    and s.id = any (candidates);
$$;

revoke all on function public.scenario_ids_taken(text[]) from public, anon;
grant execute on function public.scenario_ids_taken(text[]) to authenticated;
