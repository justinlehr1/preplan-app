@AGENTS.md

# Pre-Plan App — project guide

> Onboarding for a fresh session with zero prior context. Read this first.
> (The `@AGENTS.md` import above is a hard warning: this repo's Next.js version
> has breaking changes — check `node_modules/next/dist/docs/` before writing code.)

## What this is

A mobile web app for **firefighters**. It gives a crew fast, **offline** access to
critical pre-plan information about a building while they're en route to a call:
hazards, occupants on oxygen / medical needs, access & alarm codes, Knox box,
water & fire protection (FDC, hydrants, sprinklers, standpipe, alarm panel),
utility shutoffs, and layout notes.

The owner has **no coding background** — explain everything in plain language,
keep the stack simple, and never assume prior technical knowledge.

## Stack

- **Next.js 16** (App Router, JavaScript, no `src/` dir) + **Tailwind CSS v4**,
  built as an **installable PWA**.
- **Vercel** hosting. Deploy = commit + push to `main` on GitHub
  (`github.com/justinlehr1/preplan-app`) → Vercel auto-builds. Live at
  **preplan-app.vercel.app**.
- **Supabase** (Postgres): database, **Auth** (email/password, no public
  sign-up), **Row Level Security**, and **department scoping**.
- **Service worker** (`public/sw.js`) for offline app-shell caching, registered
  **in production only** via `app/ServiceWorkerRegister.js` (kept off in dev so
  code changes aren't masked by stale cache).

**Env vars** (`.env.local` locally, and set in Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Only the **publishable** (browser-safe)
key is ever used in the app — **never** the `service_role`/secret key.

### Key files
- `app/AuthProvider.js` — session, offline durability, verification, wipe logic.
- `app/AuthGate.js` — renders nothing but the login screen until signed in.
- `app/LoginForm.js` — login; shows the reason for any automatic sign-out.
- `app/AccountMenu.js` — "signed in as / sign out" menu in the list header.
- `app/page.js` — building list + instant search.
- `app/buildings/[id]/page.js` — the critical-info card (client component, uses `useParams`).
- `lib/supabase.js` — Supabase client.
- `public/sw.js` — service worker.
- `supabase/*.sql` — `schema.sql`, `auth-policies.sql`, `departments.sql`, `seed.sql`, `fire-protection.sql`.
- `scripts/check-*.mjs` — verification (`npm run check:db`, `check:security`, `check:buildings`).

## Security rules — MUST NEVER BREAK

These were built deliberately and tested on-device. Do not regress them.

1. **Sign-out wipes the device.** Clears localStorage, sessionStorage, IndexedDB,
   and all caches **except** the app-shell code cache (name starts with
   `preplan-cache`), so the login screen still loads offline but no data remains.
2. **7-day offline cap.** `MAX_OFFLINE_MS = 7 days`. If the login hasn't been
   server-confirmed in 7 days, the app force-wipes and requires a fresh online
   login. Backstop for a lost phone. The clock (`preplan-last-verified`) is reset
   **only** on genuine server contact.
3. **Revocation purge.** A genuinely revoked/deleted/banned account wipes the device.
4. **Only DEFINITIVE auth errors wipe.** Verify by calling `refreshSession()`
   first (with short backoff for a not-yet-ready connection), never `getUser()`
   on a possibly-expired token. Wipe **only** on codes `user_not_found`,
   `user_banned`, `session_not_found`, `refresh_token_not_found`. Expired tokens,
   refresh-token races (`refresh_token_already_used`), timeouts (408),
   rate-limits (429), 5xx, and offline are **transient** → keep the session, do
   **not** reset the 7-day clock, never wipe. `SIGNED_OUT` only wipes when we
   initiated it (user tap) or confirmed revocation.
5. **Shell cache never stores data.** `public/sw.js`: RULE 1 ignores all
   cross-origin requests (Supabase API/auth/photos can never be cached); RULE 2
   caches only same-origin app-code destinations. Any future **offline data
   cache must use a name that does NOT start with `preplan-cache`** (or use
   IndexedDB) so the sign-out wipe removes it.
6. **Department-scoped RLS.** Users see only their own department's buildings.
   `profiles` (one row per `auth.users`, holds `department_id`) + a
   `current_department_id()` SECURITY DEFINER helper drive the buildings
   policies. Public sign-ups are OFF. New users get a profile with no department
   (see nothing) until an admin assigns one.

## How we work

- **Small milestones, one at a time.** After each deploy, **stop and wait** for
  the owner to confirm on their phone before starting the next thing.
- **The owner runs ALL SQL themselves** in the Supabase SQL Editor, after
  reviewing it. Write SQL to `supabase/*.sql`, show it, and wait for a
  "SQL ran" confirmation. Do not run DDL (the app key can't, and it's the agreed
  workflow).
- **Accounts** are created by hand in Supabase (Auth → Users, "Auto Confirm" ON);
  department assigned via the `profiles` table.
- Verify everything verifiable **without** the owner (build passes; live check by
  grepping the served JS — note the card is a separate route `/buildings/[id]`
  with its own chunk; anon security checks). Be honest about what only the
  owner's phone can confirm (visual layout, long-elapsed-time tests).
- Explain every command and change in **plain language**.

## Milestones

**Done & live:**
- **1** — PWA scaffold + placeholder home screen.
- **2** — Supabase database + `buildings` table connected.
- **3** — Auth (email/password, login-only RLS, no public sign-up), offline
  session, 7-day cap, sign-out wipe, service-worker data-exclusion.
- **3.5 (bug fix)** — eliminated false auto sign-out on reopen: refresh-first
  verification, wipe only on definitive revocation, sign-out reason shown on the
  login screen.
- **4A** — department scoping (`departments`/`profiles`, `department_id` on
  buildings), searchable building list, critical-info card, 3 fake TEST buildings.
- **Card improvements** — tappable address (opens Apple/Google Maps), Water &
  Fire Protection section, extra-large bold code numbers, hide empty fields.
  (A hazard-summary strip was added then removed; the `hazard_summary` column
  still exists but is not displayed.)

**Current card section order** (`app/buildings/[id]/page.js`):
1. Name + address (tappable for directions)
2. O2 banner + Medical Needs
3. Hazards (full, red)
4. Access / Alarm Codes + Knox Box
5. Water & Fire Protection (FDC, hydrant, sprinklers, standpipe, alarm panel)
6. Type & Construction
7. Utility Shutoffs
8. Notes, then Emergency Contacts

**Next:**
- **4B** — add/edit form (create & update buildings from within the app).
- **4C** — photos (Supabase Storage; the `photo_urls` column).
- **4D** — offline building data (cache building records for no-signal access —
  MUST use a cache name not starting with `preplan-cache`, or IndexedDB, so
  sign-out still wipes it).

## Known issues / watch-outs

- **Project lives in OneDrive** (`c:\Users\smart\OneDrive\Documents\Preplan-app`).
  OneDrive syncs `node_modules` (tens of thousands of files), which can make
  installs/builds slow and occasionally cause file-lock popups.
- **Sign-out bug fix awaiting overnight confirmation.** The 3.5 fix passed quick
  tests; the definitive ~90-minute "leave it, reopen, still signed in" test on a
  real phone is still pending the owner's report.
- **No-department empty-list test** still queued (make a user with no department,
  confirm they see an empty list).
- The owner cannot edit `.claude/settings.local.json` via the agent (harness
  self-modification guard) — hand them the JSON to paste if it needs changing.
