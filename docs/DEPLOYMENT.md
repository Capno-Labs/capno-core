# Deploying Capno

Capno is a standard Next.js 14 app. Any Node 18+ host works; no database is
required. The recommended institutional stack is **Vercel + Supabase**:
Vercel serves the app over HTTPS (required for the PWA), Supabase adds
cross-device realtime sync, faculty accounts, and institution-wide storage
for scenarios and session debriefs. Every cloud feature is optional — with
no env vars the app is a fully working offline simulator.

## Option 1 — Vercel (recommended)

1. Push this repository to GitHub. CI (`.github/workflows/ci.yml`) runs
   lint, typecheck, tests, and the production build on every push and PR;
   Vercel's preview deploys pair with it naturally.
2. In Vercel: **New Project** → import the repo. Framework preset: Next.js
   (auto-detected). No build settings needed.
3. Add environment variables (all optional):

   | Variable | Purpose |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — enables cross-device sync, sign-in, cloud storage |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe client-side; RLS enforces access) |
   | `NEXT_PUBLIC_FACULTY_PIN` | Advisory faculty PIN for installations without accounts |

4. Deploy, then assign your production domain (e.g.
   `capno.your-school.edu`) under Project → Domains. The service worker and
   manifest are served automatically; the app is installable immediately.

## Option 2 — Self-hosted Node (lab server / VM)

```bash
git clone <repo> && cd capno
npm ci
npm run build
npm start            # serves on :3000
```

Put it behind HTTPS (Caddy/nginx + certbot). **HTTPS is required** for
service workers and PWA installation on anything other than `localhost`.

```
# Caddyfile example
capno.your-school.edu {
    reverse_proxy localhost:3000
}
```

A `systemd` unit or `pm2 start npm -- start` keeps it running.

## Option 3 — Single lab machine (fully offline)

For a sim lab with no network at all:

```bash
npm ci && npm run build
npm start
# open http://localhost:3000 in the browser on that machine
```

Open the faculty controller in one window and the student display in a
second window dragged to the projector. Realtime sync uses BroadcastChannel
and needs no network. Bundled scenarios, the editor, and debrief archives
all work offline (localStorage).

## Supabase setup (cross-device sync + institutional persistence)

1. Create a project at supabase.com.
2. SQL editor → paste and run `db/schema.sql` (roles, scenarios, sessions,
   RLS policies). If the project already ran an older Capno schema, run
   `db/migrations/0002_production_layer.sql` instead (idempotent).
3. Authentication → Providers → make sure **Email** is enabled. Capno uses
   email/password sign-in (magic links behave badly in installed PWAs and on
   shared lab machines).
4. Project Settings → API: copy the URL and anon key into `.env.local` /
   your host's env vars:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
5. Redeploy. Faculty controller and student displays on **different
   devices** now sync through Supabase Realtime broadcast using the session
   code. The anon key is safe to expose client-side because RLS is enabled
   on all tables.

### Faculty accounts

New accounts default to the `student` role, and RLS prevents
self-promotion. To onboard faculty:

1. Create the user (Auth → Users → Add user, or let them sign up).
2. Promote them in the SQL editor:
   ```sql
   update public.profiles set role = 'faculty' where id = '<user-uuid>';
   ```
   (`admin` additionally sees all sessions and manages profiles.)
3. They sign in at `/account`. Faculty/admin accounts bypass the PIN gate,
   and their scenario saves and session debriefs sync to the institution
   archive automatically.

A `student`-role account can sign in but cannot push to cloud storage —
the app says so explicitly and keeps everything on the device.

### What syncs where

| Data | Transport | Persistence | Requires |
| --- | --- | --- | --- |
| Live vitals (controller → student displays) | Realtime broadcast, ephemeral | none | env vars only |
| Custom scenarios + version history | `scenarios` / `scenario_versions` tables | durable, shared across faculty | signed-in faculty |
| Session debriefs | `sessions` table (institution archive) | durable, per-faculty + admins | signed-in faculty |
| Everything above, always | — | localStorage on the device | nothing |

localStorage is always the local source of truth; cloud pushes queue in an
offline outbox and drain when connectivity and sign-in are available.
Faculty can additionally export/import scenarios and session archives as
JSON files from the library and debrief pages.

## Installing as a PWA

- **iPad (Safari):** open the deployed URL → Share → **Add to Home Screen**.
  Launches full-screen in landscape; ideal for the student monitor at the
  head of bed or the faculty iPad controller.
- **Windows/Mac/ChromeOS (Chrome/Edge):** the install icon appears in the
  address bar.
- After the first visit, previously opened views (student display,
  controller, library) load offline. Scenario data is inside the app bundle,
  so a cached app is a fully working simulator.

## Upgrades

The service worker is versioned (`capno-v4` in `public/sw.js`). Deploying a
new build refreshes hashed assets automatically; pages update on the next
online navigation (network-first strategy). Bump the `VERSION` constant when
you need to force-expire old caches.

## Health checklist after deploy

- [ ] `https://…/manifest.webmanifest` returns JSON
- [ ] DevTools → Application → Service Workers shows `sw.js` activated
- [ ] Faculty run page shows the session code; a second device/window joins with it
- [ ] Lighthouse PWA audit passes (installable, offline)
- [ ] CI is green on the deployed commit
- [ ] (With Supabase) `/account` sign-in works on the deployed URL; a saved
      scenario appears in `scenarios`; an ended session appears in `sessions`
