-- Pre-Plan App — Milestone 2 database schema
-- Paste this whole file into the Supabase SQL Editor and click "Run".

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),

  -- Identification
  address text not null,
  name text,
  building_type text,
  construction_type text,
  stories integer,

  -- Life safety
  has_oxygen boolean not null default false,
  medical_notes text,
  hazards text,

  -- Access and utilities
  access_codes text,
  utility_shutoffs text,
  emergency_contacts text,

  -- Layout and media
  layout_notes text,
  photo_urls text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at accurate automatically on every edit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists buildings_set_updated_at on public.buildings;
create trigger buildings_set_updated_at
  before update on public.buildings
  for each row execute function public.set_updated_at();

-- Row Level Security: locks the table by default so the door is shut
-- unless a policy below explicitly opens it.
alter table public.buildings enable row level security;

-- Access policies live in auth-policies.sql (login-only access).
-- With RLS enabled and no policies defined, the table is closed to everyone,
-- which is the safe default until auth-policies.sql is applied.
