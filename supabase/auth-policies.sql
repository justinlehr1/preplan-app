-- Pre-Plan App — Authentication security policies
-- Replaces the temporary open development policy with login-only access.
-- Paste into the Supabase SQL Editor and click "Run".

-- 1. Remove the temporary wide-open development policy.
drop policy if exists "dev_anon_full_access" on public.buildings;

-- 2. Make sure Row Level Security is switched on (safe to re-run).
alter table public.buildings enable row level security;

-- 3. Allow logged-in users only. Signed-out visitors match no policy,
--    so they can read nothing and write nothing.
drop policy if exists "authenticated_select_buildings" on public.buildings;
create policy "authenticated_select_buildings"
  on public.buildings
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated_insert_buildings" on public.buildings;
create policy "authenticated_insert_buildings"
  on public.buildings
  for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated_update_buildings" on public.buildings;
create policy "authenticated_update_buildings"
  on public.buildings
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated_delete_buildings" on public.buildings;
create policy "authenticated_delete_buildings"
  on public.buildings
  for delete
  to authenticated
  using (true);
