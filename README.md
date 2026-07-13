# CAPNO Studio — Anesthesia Simulation Lab Platform

[![CI](https://github.com/Capno-Labs/capno-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Capno-Labs/capno-core/actions/workflows/ci.yml)

CAPNO Studio is an open, installable web app for running realistic anesthesia scenarios in a simulation lab. Faculty drive a simulated patient monitor in real time — vitals, rhythms, and prebuilt clinical events — while students follow on a full-screen OR-style **student monitor** on a projector, wall display, or iPad. Scenarios come from the built-in **case library and editor**, and every session ends in a structured, printable **debrief report** with a timeline, action assessment, scoring rubric, and suggested debrief questions.

> ⚠️ **For simulation and education only. Not a medical device. Never use for clinical care.**

## Highlights

- 🎛️ **Faculty controller** — start/pause/reset, live sliders for HR, BP, SpO₂, EtCO₂, RR, temperature, anesthetic depth and agent, rhythm selection, one-tap scenario events, phase-of-care stepper, timestamped notes, and a learner-action checklist (done / delayed / missed / incorrect). A glanceable **script rail** shows what's next — automatic events with live countdowns (flashing when imminent) and upcoming manual events in narrative order; tap any chip to fire it early (which cancels its scheduled copy).
- 🫀 **Student monitor** — sweep-style ECG, plethysmograph and capnograph waveforms rendered on canvas, numeric tiles with trend arrows, and conventional alarm limits with warning/critical states. Optional monitor audio (Web Audio, no deps): per-beat pulse tone whose pitch falls with SpO₂, plus a critical-alarm tone that respects faculty silencing. NIBP behaves like a real cuff — readings update on a cycle interval (with on-demand "cycle now"), and BP alarms judge the last *measured* value; scenarios can opt into an arterial line for continuous pressure.
- 🧠 **Scenario engine** — a framework-free, tick-driven state machine with linear vital ramps, delayed/automatic events, phases, expected actions, and scoring. Fully unit-tested.
- 📚 **Starter library** — twelve polished scenarios organized as a curriculum modeled on how leading programs structure simulation training (see [docs/curriculum.md](docs/curriculum.md)): post-induction hypotension (hemodynamics), laryngospasm after LMA and cannot-intubate-cannot-oxygenate (airway), severe bronchospasm and unexplained hypoxemia (respiratory), unstable bradycardia→asystole and myocardial ischemia (cardiac), postpartum hemorrhage (hemorrhage/obstetric), venous air embolism (embolic), intraoperative anaphylaxis (hypersensitivity), LAST after a peripheral nerve block (toxicity), and malignant hyperthermia (temperature/metabolic). Each includes objectives, setup, patient background, progression, triggers, correct management, common errors, a debrief guide, and a rubric.
- ✏️ **Scenario editor** — form-based editing of everything including phases, events with vital effects, expected actions, and the grading rubric, plus a live JSON pane for power users, zod validation, import/export of scenario files, version history, and tags by topic/difficulty/training level.
- 📋 **Debrief & assessment** — timeline of everything that happened, a vitals trend strip (10-second samples with event markers — "SpO₂ began falling here, the team responded here"), actions taken vs. missed critical actions, category scores, faculty notes, suggested questions, and one-click PDF export. Action statuses can be amended post-hoc with automatic rescoring — marking reliably mid-crisis is unrealistic — and learner names can be added to the printed report. Faculty can also skip uneventful scenario time (+1/+5 min). Session archives export/import as JSON for backup or moving between machines.
- 📱 **PWA** — installable on iPad/laptop, offline-capable: bundled scenarios and previously-visited views work with no connectivity.
- 🔌 **Realtime sync** — works with zero configuration on one device (controller window + student window/projector), with a join timeout, a stale-connection watchdog on the student display, and a Local/Cloud sync-health indicator. Add Supabase for cross-device sync (iPad controller → projector PC).
- 🏫 **Institutional layer (optional)** — with Supabase configured, faculty sign in at `/account` (email/password); custom scenarios and session debriefs then sync to institution-wide storage through an offline-first outbox (local saves always succeed; pushes queue and drain when online). The debrief page gains a read-only institution archive across devices.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Typical lab flow:

1. Open **Faculty Controller** → pick a scenario → **Run**. Note the 4-character session code.
2. On the projector/student device, open **Student Display** and enter the code.
3. **Start** the scenario. Drive vitals with the sliders, fire events, mark learner actions, add notes.
4. **End session** → the debrief report opens. **Export PDF** uses the browser print dialog.

With no backend configured, the student display must be a second window/tab of the same browser on the same machine (BroadcastChannel transport) — which covers the common "laptop + projector" lab setup. For separate devices, configure Supabase (below).

## Documentation

| Guide | For |
| --- | --- |
| [docs/faculty-guide.md](docs/faculty-guide.md) | Instructors — room setup, connecting the student display, driving vitals/events, assessing learners, debrief and PDF export, scenario authoring basics, troubleshooting. |
| [docs/student-guide.md](docs/student-guide.md) | Learners / projector operators — joining with the session code, reading the monitor, NIBP vs arterial line, alarms and sound. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Admins — Vercel, self-hosted Node, offline lab machines, Supabase setup, PWA installation. |
| [docs/scenario.schema.md](docs/scenario.schema.md) | Scenario authors — the full scenario JSON field reference. |
| [docs/curriculum.md](docs/curriculum.md) | Educators & scenario authors — how the library is organized: topic taxonomy, difficulty/training-level tiers, and the clinical sources behind each scenario. |

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enables cross-device realtime sync (Supabase Realtime broadcast), institution sign-in at `/account`, and cloud persistence of custom scenarios and session debriefs for faculty accounts. Run `db/schema.sql` in your Supabase project and enable the Email auth provider (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). |
| `NEXT_PUBLIC_FACULTY_PIN` | Advisory PIN gate on faculty views for shared lab machines. Not a security boundary (it is a public client value) — use Supabase auth + RLS for real access control. Signed-in faculty/admin accounts bypass the PIN. |
| `NEXT_PUBLIC_SITE_URL` | Public origin of this deployment (e.g. `https://capno.your-school.edu`). Enables absolute URLs in Open Graph share metadata, robots.txt, and sitemap.xml. Purely cosmetic for discoverability — offline labs can ignore it. |

### Optional AI assistance (bring your own key)

Capno can optionally use an LLM for two faculty-side features, configured at
runtime under **Settings** (no env vars, no rebuild):

- **Sim co-pilot** — on the faculty controller, type e.g. *"SBP to 60s over
  2 min, HR 135 sinus tach, fire the anaphylaxis event"*. The model proposes
  structured commands rendered as chips; nothing touches the sim until you
  apply them, and every applied command runs through the same controller
  actions as the buttons and sliders.
- **Scenario drafting** — in the editor, generate a complete scenario draft
  from a prompt. Drafts are validated against the scenario schema (with an
  automatic repair loop), land in the JSON pane for review, and carry an
  `ai-generated` topic tag plus an editor banner until faculty review them.

You supply an [OpenRouter](https://openrouter.ai) API key and model id; both
are stored only in that browser's localStorage. With nothing configured, no
AI affordance renders and the app makes no network calls — offline-first is
unchanged. Scenario data and your typed prompts are sent to OpenRouter only
when you use these features. AI output is authoring assistance, not clinical
guidance: faculty must review all generated clinical content before use with
learners.

## Architecture

```
src/
  lib/
    engine/          # Apache-2.0 core: pure TS, no framework imports
      types.ts       #   scenario + runtime types (single source of truth)
      schema.ts      #   zod validation for scenario JSON (editor, import, registry)
      engine.ts      #   SimulationEngine: tick-driven state machine, vital ramps
      vitals.ts      #   display metadata, clamping, alarm evaluation
      scoring.ts     #   rubric scoring from marked actions
    sync/            # realtime transports behind one SyncChannel interface
      broadcast.ts   #   BroadcastChannel (default: same-device, offline)
      supabase.ts    #   Supabase Realtime broadcast (cross-device, optional)
    store/           # zustand stores
      controllerStore.ts  # faculty side: owns the engine, ticks, broadcasts snapshots
      studentStore.ts     # student side: read-only snapshot mirror + liveness watchdog
      sessionArchive.ts   # completed sessions in localStorage (debrief input)
      sessionExport.ts    # JSON export/import of session archives
    cloud/           # optional Supabase layer (auth, offline-first outbox,
                     # scenario + session cloud sync) — no-ops when unconfigured
    scenarios/       # built-in registry + custom scenarios (localStorage, versioned)
  scenarios/*.json   # the starter scenario library (validated at load)
  components/
    monitor/         # waveform canvas, vital tiles, alarms, full monitor
    controller/      # session, vitals, events, actions, phases, notes, log panels
    debrief/         # printable report
    editor/          # scenario editor
  app/               # Next.js routes: /, /student, /scenarios, /faculty/run/[id],
                     # /debrief, /debrief/[id], /debrief/cloud/[id], /editor, /account
db/schema.sql        # optional Supabase schema: roles, scenarios, sessions, RLS
public/sw.js         # offline service worker
```

### Key design decisions

- **The faculty controller is authoritative.** The engine runs only on the faculty device; student displays are dumb mirrors of broadcast snapshots. Full-state replication (a few KB, twice a second) makes late joins, refreshes, and dropped messages self-healing — a display is always correct within one tick.
- **Realtime is an adapter, not a dependency.** `SyncChannel` has two implementations: BroadcastChannel (free, offline, same device) and Supabase Realtime broadcast (cross-device). A WebSocket server adapter can be added without touching UI code.
- **Scenarios are data.** Plain JSON validated by one zod schema shared by the registry, the editor, and file import. Built-ins are statically bundled — which is what makes them available offline with zero fetches.
- **PDF export is the browser's print engine.** The debrief report has dedicated print CSS; "Export PDF" opens the native dialog. Zero heavy dependencies, works offline, and produces clean, paginated documents.
- **Open-core split.** Everything under `src/lib/engine` is deliberately framework-free and Apache-2.0. Premium institutional features (hosted accounts, cross-session analytics, LMS export) layer on via the database schema and live in separate packages/services, not in the engine. The dividing line: anything valuable within a single session on one lab setup belongs in this repo, free; value that emerges across sessions, learners, or an organization — or that requires an operated service — belongs in the hosted product. Nothing shipped in this repo will ever move behind a paid tier.

## Scenario file format

See `docs/scenario.schema.md` for the full field reference, or export any built-in scenario from the library as a working example. Minimal shape:

```jsonc
{
  "id": "my-scenario", "version": "1.0.0",
  "title": "…", "summary": "…",
  "tags": { "topics": ["airway"], "difficulty": "beginner", "trainingLevels": ["srna"] },
  "learningObjectives": ["…"], "setup": ["…"],
  "patient": { "name": "…", "age": 55, "sex": "male", "weightKg": 80, "heightCm": 175,
               "asa": 2, "allergies": [], "medications": [], "pmh": [],
               "airway": { "mallampati": 2 } },
  "baselineVitals": { "hr": 72, "sbp": 120, "dbp": 75, "spo2": 98, "etco2": 36,
                      "rr": 14, "temp": 36.6, "depth": 95, "agentEt": 0, "agentFi": 0,
                      "rhythm": "sinus" },
  "phases": [{ "id": "induction", "label": "Induction" }],
  "events": [{ "id": "hypotension", "label": "Hypotension", "category": "circulation",
               "effects": [{ "vitals": { "sbp": 72, "dbp": 40 }, "overSec": 90 }] }],
  "expectedActions": [{ "id": "give-pressor", "label": "Administer vasopressor",
                        "phase": "induction", "critical": true, "points": 20 }],
  "expectedProgression": ["…"], "correctManagement": ["…"], "commonErrors": ["…"],
  "debrief": { "points": ["…"], "questions": ["…"] },
  "rubric": [{ "id": "management", "label": "Management", "actionIds": ["give-pressor"] }],
  "estimatedMinutes": 15
}
```

## Development

```bash
npm run dev        # dev server
npm test           # vitest unit tests (engine, scoring, schema + scenario validation)
npm run typecheck  # tsc --noEmit
npm run lint       # next lint (ESLint)
npm run build      # production build
npm run icons      # regenerate PWA icons (scripts/gen-icons.mjs, no deps)
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — covers Vercel, self-hosted Node, static lab machines, Supabase setup, and PWA installation on iPad.

## Security posture

- No PHI: Capno stores simulated patients only. Learner names on debriefs are optional free text entered by faculty — treat them per your institution's policy.
- All scenario input is schema-validated; imported files and cloud-fetched definitions never execute code and pass the same zod boundary.
- Realtime messages are ephemeral broadcast state; nothing per-tick is persisted.
- The faculty PIN is an advisory gate for shared machines, not authentication. Real role-based access (student/faculty/admin) is Supabase auth (email/password sign-in at `/account`) + the RLS policies in `db/schema.sql`; new accounts default to `student` and only admins can promote.
- No analytics, tracking, or third-party requests in the core app; the only external endpoint is your own Supabase project, when configured.

## Roadmap ideas

- Server-authoritative session host (WebSocket adapter) for multi-room installations
- Learner self-service session review
- Vital-sign *physiology models* (drug PK/PD, baroreflex) layered on the ramp engine
- Waveform artifact library (motion, electrocautery, disconnects) and audible alarms/beep tones
- Multi-monitor layouts (anesthesia machine screen, ventilator loops, agent analyzer)
- Scenario branching graphs with guarded transitions (currently: phases + faculty judgment)

## License

Core: [Apache-2.0](LICENSE). The twelve starter scenarios are provided under the same license — no additional restrictions. Institutional/hosted features are intended to live outside this repository.

© 2026 Capno Labs LLC · Apache-2.0
