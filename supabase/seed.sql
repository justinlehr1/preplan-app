-- Pre-Plan App — Milestone 4A: three CLEARLY FAKE seed buildings.
-- Safe to run once after departments.sql. Re-running skips rows already present.
-- Paste into the Supabase SQL Editor and click "Run".

insert into public.buildings
  (department_id, name, address, building_type, construction_type, stories,
   has_oxygen, medical_notes, access_codes, knox_box, hazards,
   utility_shutoffs, emergency_contacts, layout_notes)
select d.id, v.*
from public.departments d
cross join (values
  (
    'TEST — Maple Street Apartments', '142 Maple St',
    'Multi-family residential', 'Wood frame (Type V)', 3,
    true,
    'Unit 2B: elderly resident on home oxygen. Unit 3A: bariatric patient, may need lift assist.',
    'Front gate #4721; lobby alarm panel 8890',
    'Right of main entrance, under mailboxes',
    'Propane grills on rear balconies. Rooftop solar panels — electrical hazard when cutting.',
    'Gas: SE corner basement. Electric: 1st-floor utility room. Water: curb stop at street.',
    'Property mgr Jane Doe (555) 0100; after-hours (555) 0111',
    'U-shaped around center courtyard. Standpipe in north stairwell. Units 1-4 ground, 5-8 second, 9-12 third.'
  ),
  (
    'TEST — Riverside Chemical Warehouse', '88 Industrial Pkwy',
    'Commercial warehouse', 'Steel frame, metal deck (Type II)', 1,
    false,
    null,
    'Rear dock keypad 3355; office alarm 0042',
    'Left of loading dock door 2',
    'Stores pool chemicals (chlorine + acids). DO NOT apply water to Aisle 7 (water-reactive). Placarded.',
    'Gas: none. Electric: exterior disconnect NW wall. Sprinkler PIV: front parking island.',
    'Site safety mgr (555) 0122; CHEMTREC 1-800-424-9300',
    'Single open floor, 24 ft ceilings. Hazmat Aisles 6-8 back right. Offices front left.'
  ),
  (
    'TEST — Downtown Medical Clinic', '500 Center Ave, Suite 100',
    'Business / medical office', 'Masonry / concrete (Type I)', 2,
    true,
    'Portable O2 cylinders in exam rooms 1-6. Backup diesel generator at rear.',
    'Main entrance Knox-connected; suite door 1290',
    'Beside main entrance, north side',
    'Compressed medical oxygen storage 2nd floor east. Radiology X-ray in room 210.',
    'Gas: rear meter bank. Electric: main room B1. Medical gas shutoff: labeled valve 2nd floor east corridor.',
    'Facilities (555) 0133; clinic director (555) 0144',
    'Two floors. Reception + exam rooms ground. Admin, medical gas, radiology upstairs. Elevator center.'
  )
) as v(name, address, building_type, construction_type, stories,
       has_oxygen, medical_notes, access_codes, knox_box, hazards,
       utility_shutoffs, emergency_contacts, layout_notes)
where d.name = 'TEST Fire Department'
  and not exists (select 1 from public.buildings b where b.name = v.name);
