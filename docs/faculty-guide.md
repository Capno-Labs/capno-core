# Faculty guide — running a simulation session

> ⚠️ **For simulation and education only. Not a medical device. Never use for clinical care.**

This guide walks through a complete lab session: setting up the room, connecting
the student display, driving the scenario, assessing learners, and running the
debrief. It covers how the software works — clinical content (drug doses,
treatment sequences) comes from the scenarios themselves, which are reviewed
teaching material.

## 1. Lab setup at a glance

Capno has two live views:

- **Faculty controller** — your screen. Runs the simulation, shows the vitals
  sliders and the case flow (events with their learner actions). Students
  should not see it.
- **Student display** — the patient monitor, on a projector, wall display, or
  iPad. It only *shows* what you drive; students can't change anything from it.

Two ways to connect them:

| Setup | How | Requirements |
| --- | --- | --- |
| **One machine** (laptop + projector) | Open the controller in one window and the student display in a second window dragged to the projector. | Nothing — works fully offline. Both windows must be the **same browser** on the **same machine** (different browsers, profiles, or incognito windows will not sync). |
| **Separate devices** (iPad controller → projector PC) | Each device opens its own view; they sync over the network using the session code. | The installation must have Supabase configured — see [DEPLOYMENT.md](DEPLOYMENT.md). |

**Faculty PIN:** if your installation sets `NEXT_PUBLIC_FACULTY_PIN`, the
scenario library, controller, and debrief pages show a "Faculty access" screen
first. Enter the PIN once per browser session and press **Unlock**. This is an
advisory gate to keep students from casually opening the controller on a shared
lab machine — it is *not* security or authentication. If your installation has
institution accounts (below), signing in as faculty bypasses the PIN entirely —
the PIN screen offers an "or sign in with your institution account →" link.

## 1b. Institution accounts (optional)

Installations with a Supabase backend support real sign-in at **/account**
(email and password; accounts are created by your program administrator — see
[DEPLOYMENT.md](DEPLOYMENT.md)). Signing in with a **faculty** or **admin**
account:

- unlocks all faculty views (no PIN needed),
- syncs your saved scenarios to the institution-wide library (other faculty
  see them, and you see theirs), and
- pushes ended sessions to a shared **Institution archive** readable from any
  device you sign in on.

Everything still works offline: saves always land on the device first, and
cloud pushes queue up and send automatically when you're back online. An
account with the default *student* role can sign in but gets no faculty
permissions — the account page says so and everything stays device-local.

## 2. Before the session

1. From the home page, open **Case Library**.
2. Filter by topic or difficulty if the list is long. Each card shows the
   summary, difficulty, topics, and estimated duration.
3. Click **Objectives & setup ▼** on a card to review the learning objectives
   and the room-setup checklist (equipment, briefing notes) before learners
   arrive.
4. Press **▶ Run** to open the controller for that scenario.

The controller loads with the scenario at baseline, **not yet running** — you
have time to connect the student display and brief the room.

## 3. Connecting the student display

1. The controller shows a 4-character **Session code** in the top bar.
2. On the student device/window, open **Student Display** (`/student`), type
   the code, and press **Join session**. The code is case-insensitive; the
   alphabet avoids confusable characters (no O/0, I/1/L).
3. The monitor appears immediately, mirroring your controller's live preview.

Tips and pitfalls:

- If nothing answers the join within about 8 seconds, the student view changes
  from "Waiting for session" to a **"No controller responded"** screen with a
  **Retry** button. Check the code, and: on one machine, that both windows are
  the same browser profile; across devices, that Supabase is configured on
  both ends. The controller page must be open.
- **Leaving or reloading the controller page ends the session and generates a
  new code** — students will need to rejoin with the new one.
- Monitor sound on the student display is **off by default** (browsers block
  autoplay). Tap the 🔇 icon in the monitor's top bar once to enable the pulse
  tone and alarm sounds; the choice is remembered on that device.
- For a clean projector image, put the browser in fullscreen (F11, or ⌃⌘F on
  Mac) or install Capno as a PWA (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## 4. Running the session

Top-bar controls:

- The **Session code** chip includes small sync dots: **Local** (same-device
  windows) is effectively always green; a **Cloud** dot appears only on
  Supabase installations — green means other devices receive live vitals,
  amber is connecting, red means cross-device displays may be stale.
- **▶ Start** begins the clock; it becomes **⏸ Pause** / **▶ Resume**.
- **+1 min / +5 min** skip uneventful scenario time — vitals ramps, scheduled
  events, and the clock all jump forward together.
- **↺ Reset** (with a "Confirm reset" step) returns the scenario to baseline.
- **■ End session** (with a "Confirm end → debrief" step) archives the session
  and opens the debrief report.

Orientation on the controller:

- **Flow panel** (right column): every scenario event as a card in narrative
  order with its linked learner actions underneath, and the first unfired
  event highlighted as **Next up**. This is the case's driving surface — see
  §6.
- **Live monitor (what students see)**: an exact preview of the student
  display, with a **🔔 silence alarms** toggle that silences the alarm state on
  every connected display.
- **Phase** stepper: advance through the scenario's phases of care (e.g.
  induction → maintenance). Phases group the learner-action checklist and give
  the debrief timeline structure.

## 5. Driving vitals

The **Vitals** panel has a slider per parameter (HR, SBP/DBP, SpO₂, EtCO₂, RR,
Temp, anesthetic Depth, sevoflurane Fi/Et — shown as SEV on the monitor). A
slider commits when you release it, and
the value changes over the selected **ramp** speed — **Instant / 3 s / 10 s**
(default 3 s). A short ramp keeps the change readable on the monitor without
stalling a timed session; Instant is for corrections.

**Rhythm** buttons switch the ECG: Sinus Rhythm, Sinus Bradycardia, Sinus
Tachycardia, Sinus with PVCs, Sinus with PACs, Atrial Fibrillation, SVT,
Ventricular Tachycardia, Ventricular Fibrillation, PEA, Asystole. Pulseless
rhythms flatten the pleth and zero the pulse display automatically.

**NIBP behaves like a real cuff.** In the default cuff mode, the sliders set
the patient's *true* pressure, but the monitor shows the **last measured**
reading, which updates only when the cuff cycles — the panel shows "Cuff last
read S/D at M:SS", and the student's NIBP tile shows how old the reading is.
Press **Cycle NIBP now** to take a reading on demand (e.g. when a learner asks
to cycle the cuff). A stale BP during a fast deterioration is a deliberate
teaching point, not a bug. Scenarios with an arterial line show continuous
pressure instead (the tile reads **ART**).

## 6. The Flow panel

The **Flow** panel is the scenario's driving surface: every event —
deteriorations, treatment responses, complications — as a one-tap card in
narrative order, colour-coded by category. Hover (or long-press) a card for
its description; type **/** to jump to the filter.

- The first unfired event carries a **Next up** highlight, so the whole
  sequence is one press after another.
- Firing an event applies its vital effects over the event's built-in ramp and
  logs it to the timeline.
- **Auto events are off by default** — nothing fires on its own, and scripted
  deteriorations show their authored time as "suggested ~M:SS" so you keep the
  pace. Flip **Auto events** in the top bar to restore the authored timeline
  (cards then show a live "auto in M:SS" countdown, amber when imminent);
  firing an auto event early cancels its scheduled copy.
- Fired events show a ✓ but can be fired again if the scenario calls for it.

## 7. Assessing learners

Learner actions live in the Flow panel too. Actions linked to an event (the
treatments that event responds to) sit directly under that event's card;
everything else — vigilance, communication, planning — is in **Other learner
actions** below, grouped by phase. ● marks a critical action, and the
**Critical only** toggle (which arms itself when the scenario starts) trims
the action rows to the critical ones with bigger tap targets. As the team
works, tap a status on each action:

- **✓ done** — full credit
- **◐ delayed** — half credit
- **✗ incorrect** — no credit
- **— missed** — no credit

Tap the active status again to clear it. Marks are timestamped into the
timeline. **Don't stress about perfect live marking** — every status can be
amended on the debrief report afterwards and the score recalculates.

**Faculty notes**: type an observation and press **Add** — it's timestamped and
appears in the debrief report. The **Log** panel shows everything as it
happens, newest first.

## 8. Ending the session and debriefing

Press **■ End session → Confirm end → debrief**. The session is archived on
this device and the report opens. It contains: session header (add **Learners**
names via *edit* — comma-separated), vitals trend strip with event markers,
overall and per-category **Score**, **Critical actions** completed/not
completed, **Learner actions** by status (with amend dropdowns — changes
rescore and save immediately), the full **Timeline**, your **Faculty notes**,
the scenario's **Debrief guide** (discussion points and suggested questions),
and a **Reference** section (correct management, common errors).

**🖨 Export PDF** opens the browser's print dialog — choose "Save as PDF". The
amend controls are hidden in print.

Past sessions live under **Debrief** (or the **Past sessions** button
in the library). Scoring policy: done = full points, delayed = half,
incorrect/missed = zero; critical actions are surfaced separately and never
buried in the percentage.

> **Sessions are stored in the browser** (localStorage) on the faculty device
> — clearing browser data deletes them. The Debrief page has **⬇ Export all
> (JSON)** / per-session **Export** and **⬆ Import JSON** to back up session
> history or move it to another machine; each report also has its own
> **⬇ Export JSON** next to Export PDF. If the device's storage is full when a
> session ends, the report shows an amber "held in memory only" warning —
> export it before closing the tab. On installations with institution
> accounts, ended sessions also sync to the shared **Institution archive** on
> the Debrief page (read-only from other devices; amendments happen on the
> device that ran the session and re-sync automatically).

## 9. Authoring scenarios (brief)

The **Scenario Editor** (home page, or **✏️ New scenario** / **Edit** in the
library) edits scenarios as forms with a live JSON pane:

- Everything is editable as forms — basics, patient, teaching content, and
  collapsible **Phases**, **Events**, **Expected actions**, and **Rubric**
  sections. In an event's vital-effect grid, a **blank field means
  "unchanged"** — only type a number for vitals the event should move. Rubric
  membership is checkboxes over your expected actions, so broken references
  can't happen from the forms.
- **💾 Save version** stores the scenario on this device with version history.
  Signed-in faculty also see a cloud status after saving ("syncing… / synced
  to cloud / cloud sync pending"), and the library badges each custom
  scenario **cloud / sync pending / local only**.
- **⬇ Export JSON / ⬆ Import JSON** move scenario files between machines.
- **▶ Test run** opens the controller on your draft (enabled once it's valid
  and saved).
- The JSON pane only takes effect when you press **Apply JSON**; form edits
  regenerate the JSON text.

See [scenario.schema.md](scenario.schema.md) for the full field reference, or
export a built-in scenario as a working example. Clinical content in the five
built-ins is reviewed material — have new clinical content reviewed by faculty
before using it for assessment.

## 10. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Student sees "No controller responded" after joining | Wrong code; controller not open; different browser/profile on one machine; Supabase not configured across devices; or the code changed after a controller reload. Press **Retry** after fixing. |
| "Connection to controller lost — showing last received data" on the monitor | The controller tab was closed, reloaded, or lost network. Reopen it — students rejoin with the new code. |
| "Session ended by faculty" on the monitor | You pressed **■ End session** — this is normal; students can join the next session's code. |
| Cloud sync dot is red or amber | Cross-device sync is degraded — remote displays may be stale until it recovers (it reconnects on its own). Same-device windows are unaffected. |
| No monitor sound | Sound defaults off — tap the 🔇 icon on the student display. |
| BP "stuck" while sliders move | That's NIBP cuff mode working as intended — press **Cycle NIBP now** or wait for the next cuff cycle. |
| PIN screen on a machine that shouldn't have one | `NEXT_PUBLIC_FACULTY_PIN` is set for this installation; the PIN is advisory only. Signed-in faculty accounts bypass it. |
| "Device storage is full" when saving or ending a session | The browser's storage quota is exhausted — export scenarios/sessions as JSON, delete old ones, and save again. A memory-only debrief must be exported before the tab closes. |
| Past sessions missing | Archives are per-device browser storage — check the machine the session was run on, restore from a JSON export, or (with institution accounts) open the Institution archive. |
