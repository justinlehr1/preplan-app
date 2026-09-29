-- Pre-Plan App — Card improvements: hazard summary + water/fire protection.
-- Adds new columns and fills fake values for the 3 TEST buildings.
-- Paste into the Supabase SQL Editor and click "Run". Safe to re-run.

-- === Item 1: compact hazard summary strip (shown at the top of the card) =====
-- Short, scannable tags for the top strip. Full detail stays in `hazards`.
alter table public.buildings add column if not exists hazard_summary text;

-- === Item 3: WATER & FIRE PROTECTION section =================================
alter table public.buildings add column if not exists fdc_location text;
alter table public.buildings add column if not exists nearest_hydrant text;
-- Status columns hold 'yes' / 'no' / 'partial'; the *_notes columns hold detail.
-- (Kept as plain text so a later edit form can offer a simple dropdown.)
alter table public.buildings add column if not exists sprinklers_status text;
alter table public.buildings add column if not exists sprinklers_notes text;
alter table public.buildings add column if not exists standpipe_status text;
alter table public.buildings add column if not exists standpipe_notes text;
alter table public.buildings add column if not exists fire_alarm_panel text;

-- === Fake values for the 3 TEST buildings ===================================
update public.buildings set
  hazard_summary   = 'Rooftop solar · Propane on balconies',
  fdc_location     = 'North (Maple St) face, left of main entrance',
  nearest_hydrant  = 'NW corner Maple St & 2nd Ave (~150 ft)',
  sprinklers_status= 'partial',
  sprinklers_notes = 'Common areas and corridors only; units not sprinklered',
  standpipe_status = 'yes',
  standpipe_notes  = 'Class I standpipe in north stairwell',
  fire_alarm_panel = 'Main lobby, right of the mailboxes'
where name = 'TEST — Maple Street Apartments';

update public.buildings set
  hazard_summary   = 'Chemical storage · Water-reactive Aisle 7',
  fdc_location     = 'SW corner near the main gate',
  nearest_hydrant  = 'Front parking island (~80 ft from dock 2)',
  sprinklers_status= 'yes',
  sprinklers_notes = 'Wet system; deluge over hazmat Aisles 6-8',
  standpipe_status = 'no',
  standpipe_notes  = null,
  fire_alarm_panel = 'Office suite entry, front left'
where name = 'TEST — Riverside Chemical Warehouse';

update public.buildings set
  hazard_summary   = 'Medical oxygen storage · Diesel generator',
  fdc_location     = 'Center Ave frontage, east of the main doors',
  nearest_hydrant  = 'Corner Center Ave & 5th (~120 ft)',
  sprinklers_status= 'yes',
  sprinklers_notes = 'Full wet system, both floors',
  standpipe_status = 'yes',
  standpipe_notes  = 'Class I in the central stairwell',
  fire_alarm_panel = '2nd floor east corridor, near medical gas shutoff'
where name = 'TEST — Downtown Medical Clinic';
