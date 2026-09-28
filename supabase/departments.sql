-- Pre-Plan App — Milestone 4A: department scoping
-- Scopes buildings so a signed-in user sees ONLY their own department's rows.
-- Paste into the Supabase SQL Editor and click "Run".

-- 1. Departments -------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.departments enable row level security;

-- 2. Profiles: exactly one row per auth user, linking them to a department ----
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 3. Auto-create a profile whenever a new user is added. Department starts
--    empty (NULL) — an admin assigns it, and until then the user sees nothing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Helper: the current user's department id. SECURITY DEFINER so it reads
--    profiles without tripping over Row Level Security (avoids recursion).
create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

-- 5. Link buildings to a department, and add a Knox box location field -------
alter table public.buildings
  add column if not exists department_id uuid references public.departments(id) on delete cascade;
alter table public.buildings
  add column if not exists knox_box text;

-- 6. Row Level Security policies ---------------------------------------------
-- profiles: a user may read only their own profile row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());

-- departments: a user may read only their own department.
drop policy if exists "departments_select_own" on public.departments;
create policy "departments_select_own" on public.departments
  for select to authenticated using (id = public.current_department_id());

-- buildings: replace the old "any authenticated user" policies with
-- department-scoped ones. A user with no department matches none of these.
drop policy if exists "authenticated_select_buildings" on public.buildings;
drop policy if exists "authenticated_insert_buildings" on public.buildings;
drop policy if exists "authenticated_update_buildings" on public.buildings;
drop policy if exists "authenticated_delete_buildings" on public.buildings;

create policy "dept_select_buildings" on public.buildings
  for select to authenticated
  using (department_id = public.current_department_id());

create policy "dept_insert_buildings" on public.buildings
  for insert to authenticated
  with check (department_id = public.current_department_id());

create policy "dept_update_buildings" on public.buildings
  for update to authenticated
  using (department_id = public.current_department_id())
  with check (department_id = public.current_department_id());

create policy "dept_delete_buildings" on public.buildings
  for delete to authenticated
  using (department_id = public.current_department_id());

-- 7. One-time setup: create a department and put existing users in it --------
--    (Fine while there is a single department. For more departments later,
--     set each profile's department_id individually instead.)
insert into public.departments (name)
  select 'TEST Fire Department'
  where not exists (select 1 from public.departments where name = 'TEST Fire Department');

insert into public.profiles (id)
  select id from auth.users
  on conflict (id) do nothing;

update public.profiles
  set department_id = (select id from public.departments where name = 'TEST Fire Department')
  where department_id is null;
