# Faculty guide — running a simulation session

> ⚠️ **For simulation and education only. Not a medical device. Never use for clinical care.**

This guide walks through a complete lab session: setting up the room, connecting
the student display, driving the scenario, assessing learners, and running the
debrief. It covers how the software works — clinical content (drug doses,
treatment sequences) comes from the scenarios themselves, which are reviewed
teaching material.

> **First time here?** The home page's **Try the guided demo →** link opens
> the demo case with a short coach-mark walkthrough of the whole loop —
> connect, start, pace events, drive vitals, mark actions, end into the
> debrief. Skippable at any step (Esc works). To replay it, enter through
> the same **Try the guided demo** link — the controller's top bar then
> shows a **↻ Restart tour** button instead of reopening the tour.

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
- Monitor sound on the student display is **on by default**: joining with the
  code starts the pulse tone and alarm sounds. A display opened from a join
  link (or reloaded) shows **🔈 tap for sound** until someone taps or presses
  a key — browsers will not play audio before that. The speaker button cycles
  full → low → off, and the choice is remembered on that device.
- **Optional patient pre-brief.** Tick **Show the patient pre-brief until
  Start** in the *Before you start* panel and displays show the patient until
  you start: name, age, weight, ASA class, allergies, history, medications,
  airway exam and plan — never the scenario title, objectives or events. The
  monitor takes over the moment you start. It is **off by default**, because
  learners see the patient block exactly as the scenario author wrote it and
  some scenarios keep faculty notes there: read the patient card first. The
  choice carries over to your next session on that page.
- Sound on your own **live monitor preview** is off by default, so the room
  does not hear two monitors. Its speaker button works the same way and is
  remembered separately.
- **Alarm sounds follow priority.** A critical alarm is a repeating burst of
  ten quick, high pulses; a warning is three slower, lower pulses repeated
  less often. Warnings were silent before. The monitor's **🔕 Silence** key
  quiets the alarms sounding now; **pause all alarms** above the preview
  stops every alarm sound until you switch it back (§5).
- For a clean projector image, put the browser in fullscreen (F11, or ⌃⌘F on
  Mac) or install Capno as a PWA (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## 4. Running the session

Top-bar controls:

- The **Session code** chip includes small sync dots: **Local** (same-device
  windows) is effectively always green; a **Cloud** dot appears only on
  Supabase installations — green means other devices receive live vitals,
  orange is connecting, red means cross-device displays may be stale.
- **▶ Start** begins the clock; it becomes **⏸ Pause** / **▶ Resume**. Next to
  the clock, a countdown shows time remaining against the scenario's slot
  budget (orange in the final stretch, red once over).
- **+1 min / +5 min** skip uneventful scenario time — vitals ramps, scheduled
  events, and the clock all jump forward together. These buttons appear only
  while **Auto events** is on; in a fully manual session you pace every beat
  yourself.
- **Auto events: off/on** — off (the default) means nothing fires on its own;
  you press every event. On restores the scenario's authored auto-fire
  timeline. Flipping it mid-run is safe: past-due events never retro-fire.
- **↺ Reset** (with a "Confirm reset" step) returns the scenario to baseline.
- **■ End session** (with a "Confirm end → debrief" step) archives the session
  and opens the debrief report.

Keyboard: **Space** starts/pauses, **N** fires the next event, **/** jumps to
the Flow filter. Keys are ignored while you're typing in any field or a
confirmation dialog is open. N and / keep working after you click a button or
drag a slider; Space pressed on a focused button presses that button.

Orientation on the controller. On a laptop or desktop the controller fits the
window: nothing scrolls off screen, and each of the three zones scrolls on its
own. (On a short window or a smaller tablet the page scrolls instead.)

- **Flow panel** (left): the scenario's events in narrative order with their
  linked learner actions, and the first unfired event as the large **Next
  up** card. This is the case's driving surface — see §6.
- **Live monitor (what students see)** (centre): an exact preview of the
  student display, with a **pause all alarms** toggle that stops alarm sound
  and flashing on every connected display until you switch it back.
- **Notes, Log and Patient** (under the monitor): **Faculty notes** beside a
  card that switches between the live **Log** and the **Patient** background.
  The patient opens first; the card turns to the log when you start.
- **Vitals** (right): the sliders, then rhythm and CO₂ waveform, then the
  monitor setup (machine readings, agent, alarm limits, twitch monitor, V5
  lead) — see §5.
- **Phase of care**: the command bar lists the scenario's phases with
  the current one highlighted. Press **Next phase →** (or any phase, to jump
  or step back) when the case moves on — phases never advance on their own.
  The timer beside them is time in the current phase, shown against the
  phase's target when the scenario sets one. Each change is logged, which is
  what puts phase markers in the debrief timeline.
- **Pace**: beside the session clock, a badge counts down the time left in
  the lab slot (the scenario's time budget, or its estimated run time when no
  budget is set) and turns to "+m:ss over" once you pass it. It is a display
  only — nothing fires or stops because of it.

## 5. Driving vitals

The **Vitals** panel has a slider per parameter (HR, SBP/DBP, SpO₂, EtCO₂, RR,
Temp, and end-tidal agent — shown on the monitor under the agent's tag (SEV,
ISO or DES); the inspired concentration follows it, and anesthetic depth is
set by scenario events, not a slider). A slider commits when you release it, and
the value changes over the selected **ramp** speed — **Instant / 3 s / 10 s**
(default 3 s). A short ramp keeps the change readable on the monitor without
stalling a timed session; Instant is for corrections.

**Rhythm** buttons switch the ECG: Sinus Rhythm, Sinus Bradycardia, Sinus
Tachycardia, Sinus with PVCs, Sinus with PACs, Atrial Fibrillation, Atrial
Flutter, SVT, Junctional Rhythm, First-degree AV Block, AV Block Mobitz I and
Mobitz II, Complete Heart Block, Ventricular Paced, Idioventricular Rhythm,
Ventricular Tachycardia, Torsades de Pointes, Ventricular Fibrillation, PEA,
Asystole. Three of them are slow by definition, so selecting one above its
range brings the heart rate down once: Junctional to 50, Complete Heart Block
to 45, Idioventricular to 35. Re-dial the rate afterwards for an accelerated
variant. In complete block the escape beats are narrow (junctional) unless
you set **QRS** to Wide (ventricular escape). Mobitz II is always drawn wide,
as it usually is in life.

**Pulse** is separate from the rhythm. **Absent** keeps the rhythm on the ECG
and takes the pulse away: that is PEA with any organized rhythm, or pulseless
VT. The pleth and arterial trace go flat, SpO₂ shows dashes, the pulse tone
stops and the cuff fails to read — but the heart rate still counts and the
only alarm is the oximeter's "SpO₂ NO PULSE", which is exactly how PEA is
missed. It does not move the pressures: dial those yourself. Pulse stays
absent when you change rhythm, so switch it back to **Present** for return of
circulation. VF, torsades and asystole never have a pulse; the PEA button
remains as a ready-made wide-complex PEA.

**ECG complex** controls change how each beat is drawn, whatever the rhythm:
**ST II** steps the ST segment in half-millimetre steps (negative is
depression, positive is elevation) and follows the selected ramp, so a 10 s
ramp lets it develop gradually; **T** (normal, peaked, flattened, inverted),
**QRS** (narrow, wide) and **QT** (normal, prolonged) switch at once. The
monitor prints the level as "ST II −2.0" under the heart rate. These are
display only — they change no numbers and raise no alarm, so learners have to
see them. They apply to the sinus rhythms, AF, SVT and the normal beats
around ectopics; in VT, VF, PEA and asystole they are not drawn and the
readout shows dashes.

**V5 lead.** Press **Add V5 lead** to put a second ECG trace under lead II on
every display (a scenario can also start with it). It has its own **ST V5**
stepper and readout, independent of lead II — so you can show ischemia in V5
that lead II misses, which is the usual case: lead II alone picks up only
about a third of intraoperative ischemia, V5 about three-quarters, and the
two together four-fifths (London et al., *Anesthesiology* 1988). T-wave, QRS
and QT settings apply to both leads.

**Machine readings.** Press **Show machine readings** to add three tiles to
every display — airway pressure (peak, with plateau and PEEP beneath), tidal
volume (with minute volume) and inspired oxygen — and steppers for each: tap
− or +, or type a number. A scenario can also start with them. They start
from values sized to the patient (tidal volume from predicted body weight,
PEEP 5, peak 18, plateau 16, oxygen 50%) and follow the selected ramp. They
read only what you set: raising peak pressure does not lower the saturation,
so move the vitals that go with it. A guide to which numbers to move:

- **Peak up, plateau unchanged** — airway resistance: bronchospasm, a kinked
  or plugged tube.
- **Peak and plateau both up** — a stiffer chest or lung: mainstem
  intubation, pneumothorax, atelectasis, pulmonary edema, pneumoperitoneum.
- **Peak near zero, tidal volume zero** — a disconnection (set EtCO₂ to 0 as
  well: the capnogram is the best monitor of one).
- **Inspired oxygen falling** — a failed or crossed oxygen supply; the
  saturation follows later.

The machine alarms on airway pressure above 40 or below 8 cmH₂O, minute
volume under 3 or over 12 L/min, and inspired oxygen under 20%. Those are
the starting limits: select the Paw, VT or O₂ tile to change them or switch
that alarm off, as for any other number (see **Alarm setup, on the monitor**
below). They are the same in every patient category, so for a small child
lower the minute-volume limit — a neonate's sits well under 3 L/min.

**Twitch monitor.** Press **Attach twitch monitor** to add a TOF tile to every
display; a scenario can also start with one. You set the block — the
train-of-four **Count** (0–4), the **Ratio** when the count is 4, and the
post-tetanic count (**PTC**) when it is 0 — and the tile shows it the next
time the monitor stimulates, every 15 seconds, or at once with **Stimulate
now**. Like the cuff, it shows the last measurement, so a relaxant or a
reversal does not register the instant you set it. The selected ramp applies:
set Count 0 → 4 over 10 s and the tile steps through 1, 2 and 3 on the way.
Taking the count under 4 resets the ratio to 0, so set the ratio after the
fourth twitch returns. The tile shows the ratio as a percentage with four
twitches and the count alone with fewer; four bars show the twitches of the
last train, sloping when there is fade. The controller names the depth of
block beside the last reading (learners do not see this):

| Reading | Depth (ASA 2023) |
|---|---|
| Count 0, PTC 0 | Complete |
| Count 0, PTC 1 or more | Deep |
| Count 1–3 | Moderate |
| Count 4, ratio under 40% | Shallow |
| Ratio 40% to under 90% | Minimal |
| Ratio 90% or more | Acceptable recovery — the threshold to confirm before extubation |

For reversal, the sugammadex label gives 2 mg/kg once the second twitch has
returned, 4 mg/kg at a post-tetanic count of 1–2 with no twitches, and
16 mg/kg about 3 minutes after rocuronium 1.2 mg/kg; the ASA suggests
neostigmine as an alternative only at minimal block. The sim does not model
either drug: fire or set the reading the reversal produces. The bars are drawn
relative to the first twitch, so a depolarising block — four equal, smaller
twitches — cannot be shown. There are no alarms on the twitch monitor.

**Alarms** buttons (Adult, Pediatric, Neonatal) choose the monitor's patient
category, and with it the alarm limits for heart rate, blood pressure,
breathing rate and (neonates) saturation — so a child's heart rate of 130
does not alarm. The limits in force are printed small beside each number on
every display (for example `50–110` on the HR tile). A scenario can start in
a category and change single limits for its case (a parturient's heart rate);
switching category during a session uses that category's own limits, and
switching back to the scenario's category restores the scenario's changes.
The category is yours to choose, as on a real monitor: it does not follow the
patient's age.

**Alarm setup, on the monitor.** Select a number on the monitor preview — HR,
SpO₂, EtCO₂, blood pressure, temperature, or the machine's airway pressure,
tidal volume and inspired oxygen — to open its alarm setup, as on a real
monitor. (EtCO₂ opens with the breathing rate, which shares its tile; the VT
tile sets the minute-volume limits, printed on it as `MV 3–12`.) A machine
reading has one limit a side and no separate critical value, and inspired
oxygen has a low limit only.

- **High** and **Low** set that number's limits with − and +. A limit taken
  to the end of its range reads **off**.
- The red **crit** value beside each is the critical limit. You do not set
  it; it moves only if you take a limit past it.
- **🔔 Alarms on / 🔕 Alarms off** switches that number's limit alarms. While
  off, every display shows 🔕 beside the number in place of its limits, and
  it neither flashes nor sounds. The oximeter's "NO PULSE" and the rhythm
  alarms are not limit alarms and still sound.

Changes show on every display at once and are written to the log (the
debrief shows when an alarm was switched off). Switching category returns to
that category's limits; Reset returns to the scenario's. A scenario can also
start with an alarm switched off — the monitor someone left that way.

**🔕 Silence**, at the top of the monitor, is the monitor's own key. It
acknowledges the alarms active at that moment:

- They stop sounding and flashing. Each stays in the alarm bar with a ✓, and
  its tile keeps its colour, for as long as the number is out of range.
- A **new** alarm still sounds: another number, the same number going from
  warning to critical, or a different rhythm.
- When a silenced number comes back into range the alarm is reset, so if it
  goes out again it sounds again.
- A silenced **cuff** pressure alarm disappears altogether and returns with
  the next cuff reading if that is still out of range — a real monitor
  treats intermittent measurements this way.

The log records what was silenced ("Alarms silenced: HR HIGH 150, SpO₂ low
88"). **pause all alarms**, above the preview, is different and yours alone:
it stops all alarm sound and flashing until you switch it back, for a pause
to teach or a noisy room.

**Learners can operate the alarms too.** On a student display the Silence key
and the same selectable numbers are there, so learners silence alarms, set
limits and switch alarms off themselves, as they would on a real monitor.
Their changes apply to every display, and the log marks each one "on a
student display" — the debrief shows who silenced what, and when. That is
all a display can change: not vitals, not events, not the session, and not
your pause. Untick **Learners can do the same on their display** under the
Alarms buttons to keep the alarms to yourself; the choice carries over to
the next case.

**Agent** buttons (SEV, ISO, DES) say which volatile the end-tidal number
refers to. The agent tile shows it as a multiple of the patient's MAC,
adjusted for age: the same concentration is more MAC in an older patient.

**CO₂ waveform** buttons change the capnogram's shape: Normal, Bronchospasm
(shark fin), Curare cleft, Cardiogenic oscillations (ripples in time with the
heart as a slow breath tails off — clearest at low respiratory rates) and
Cuff / circuit leak (the trace peaks early and sags). Those change the picture
only. **Esophageal intubation** changes the reading too: the EtCO₂ number and
the trace start under 10 mmHg, shrink with each breath and are gone by the
seventh, and the low-CO₂ alarm follows — the point being that a few small
waves are not a tracheal tube: the trace has to be sustained for at least
seven breaths. Select Normal again when the tube is re-sited. **Inspired
CO₂** raises the baseline the trace returns to between breaths, for
rebreathing; it follows the selected ramp, shows as "Fi" beside the
respiratory rate, and alarms above 4 mmHg. It does not move EtCO₂ — in real
rebreathing that climbs too, so raise it yourself. The leak shape likewise
changes only the picture; lower EtCO₂ yourself for the low reading a leak
gives. The trace is drawn on a 0–50 mmHg scale, which becomes 0–75 once the
reading passes 50.

**NIBP behaves like a real cuff.** In the default cuff mode, the sliders set
the patient's *true* pressure, but the monitor shows the **last measured**
reading, which updates only when the cuff cycles — the panel shows "Cuff last
read S/D at M:SS", and the student's NIBP tile shows how old the reading is.
Press **Cycle NIBP now** to take a reading on demand (e.g. when a learner asks
to cycle the cuff). A stale BP during a fast deterioration is a deliberate
teaching point, not a bug. Scenarios with an arterial line show continuous
pressure instead (the tile reads **ART**).

**The monitor measures, as a real one does.** The sliders set the patient's
*true* values; the display shows what a monitor would make of them.

- **Heart rate is counted from the beats on screen**, so the HR tile can read
  a beat or so either side of your slider in sinus rhythm, and wanders several
  beats in atrial fibrillation. Alarms and the debrief still use your value.
- **No pulse, no saturation.** In VF, PEA and asystole the SpO₂ tile shows
  `--` and the banner reads **SpO₂ NO PULSE**, whatever saturation the
  scenario holds underneath. The number returns with a perfusing rhythm.
- **A cuff cannot read a very low pressure.** If the cuff cycles while
  systolic is under 30 mmHg — the bottom of an oscillometric cuff's range —
  the NIBP tile shows `--/--` and the banner reads **NIBP NO READING** until a
  later cycle finds a pressure.
- **Pulses breathe.** The pleth and arterial traces rise and fall slightly
  with each breath, in step with the capnogram. The swing is fixed and small —
  it does not change with volume status.
- **No two breaths are identical.** Each capnogram breath varies by a few
  percent in length, and its plateau peaks at or just under the EtCO₂ number.
  The RR and EtCO₂ tiles still show your values.

## 6. The Flow panel

The **Flow** panel is the scenario's driving surface: every event —
deteriorations, treatment responses, complications — in narrative order, with
a caption where the case moves into a new phase and a colour dot for the
event's category. It reads as done / now / later:

- **Next up** — the first unfired event is the large card, with its
  description and the actions to watch for. Tap it or press **N** to fire it,
  so the whole sequence is one press after another.
- **Later** — every other unfired event is a one-line row. A tap still fires
  it, so you can run the case out of order; **⤒** makes it the next event
  (the one N fires) instead, and the small arrow opens its description and
  actions without firing.
- **Done** — once a fired event's actions are marked it leaves the list for
  the **Done** line at the top, which counts the finished events and tallies
  their marks. (A fired event stays open, in place, while any of its actions
  are still waiting.) Because finished events collect there, the events in
  play and **Next up** stay at the top of the panel all session. Tap **Done**
  to list the finished events; tap one to reopen it and change a mark. Firing
  it again is the **Fire again** button inside, so a stray tap can't repeat a
  deterioration.
- The panel follows along: when an event fires — by tap, N, or its auto timer
  — the list scrolls to keep it and the new next event in view.
- **Show all** opens every event at once. It is on before you start, so you
  can read the case through, and switches off when the session first runs.
  Type **/** to jump to the filter; a filter opens whatever it matches.
- Firing an event applies its vital effects over the event's built-in ramp and
  logs it to the timeline.
- **Auto events are off by default** — nothing fires on its own, and scripted
  deteriorations show their authored time as "suggested ~M:SS" so you keep the
  pace. Flip **Auto events** in the top bar to restore the authored timeline
  (cards then show a live "auto M:SS" countdown, orange when imminent);
  firing an auto event early cancels its scheduled copy.

## 7. Assessing learners

Learner actions live in the Flow panel too. Actions linked to an event (the
treatments that event responds to) sit directly under that event;
everything else — vigilance, communication, planning — is in **Also watch
for** at the end of the list, grouped by phase. A group opens once the case
has reached its phase (from the phase you've selected or the events you've
fired), and you can open any group yourself. ● marks a critical action, and
the **Critical only** toggle (which arms itself when the scenario starts)
trims the action rows to the critical ones with bigger, labelled tap targets.
As the team works, tap a status on each action:

- **✓ observed**
- **◐ delayed** — done, but later than it should have been
- **✗ incorrect** — attempted, but not correctly
- **— missed**

A marked action folds to one line showing its status and time; tap the line
to bring the buttons back, and tap the active status again to clear it. Marks
are timestamped into the timeline. **Don't stress about perfect live marking** — every status can be
amended on the session record afterwards, before you start the debrief.

**Faculty notes** (under the monitor): type an observation and press **Add** —
it's timestamped and appears in the debrief report. The **Log** beside it
shows everything as it happens, newest first.

## 8. Ending the session and debriefing

Press **■ End session → Confirm end → debrief**. The session is archived on
this device and the session record opens. Take a minute here before the
learners look at the screen: fix any marks you could not make live, then
press **Start debrief**.

**The walkthrough.** **Start debrief** opens the debrief as full-screen cards,
one at a time, for you to click through with the room. The order is the
PEARLS debriefing framework (Eppich & Cheng, 2015):

1. **Setting the scene** — what the debrief is for and how it will run.
2. **Reactions** — "How are you feeling?" Let everyone speak before any
   teaching.
3. **Description** — the learners summarise the case, then a **Key moments**
   card lists the fired events, rhythm changes, alarms and recoveries from
   the log to settle the facts (in cuff mode BP points follow the NIBP
   readings the monitor actually showed).
4. **Analysis** — the case's learning objectives; "What went well? What would
   you change?"; the critical actions that were done; **one card for each
   critical action that was missed, delayed or incorrect**, showing when the
   event that called for it fired and when it was marked, with the question
   "What were you seeing at this point? What was going through your mind?";
   the scenario's own discussion questions, one per card; its key teaching
   points; correct management and common errors for reference.
5. **Summary** — take-aways. Type them as the learners say them: each is
   saved to the record under faculty notes.

Move with **→ / ←** (Space, Enter and a presenter clicker's Page keys also
work), jump with the phase names along the top, **F** for full screen, **Esc**
to close. **N** shows a short **facilitator cue** for the current card — it
stays hidden otherwise, since the room is reading the same screen. Skip
freely: the cards are a guide, not a script. Everything on them comes from
the case you authored and what you marked; the app writes no clinical
content of its own and shows no score — the debrief is a conversation about
the case, not a grade.

**The record.** Under the walkthrough is the written record, organized as a
narrative: session header (add **Learners** names via *edit* —
comma-separated), learning objectives, **What happened** (the full
timeline), **Key clinical turning points**, **What the learner did** (actions
by status, with amend dropdowns — changes save immediately and carry into
the walkthrough), **Missed or delayed critical actions**, your **Faculty
notes** (editable here: fix or remove a note, or **+ Add note** — additions
are chipped "added at debrief" so the record stays honest), the scenario's
**Debrief guide** (discussion points and suggested questions), and a
**Reference** section (correct management, common errors).

**🖨 Export PDF** opens the browser's print dialog — choose "Save as PDF". The
amend controls are hidden in print.

**▶ Run next student** relaunches the same scenario fresh **on the same
session code**: connected student displays flip from "Session ended" back to
the live monitor by themselves — nobody re-types a code between back-to-back
lab slots. Each run still archives as its own debrief. Open it in the same
tab (a normal click): running two controller tabs on one code would have both
drive the student displays at once.

Past sessions live under **Debrief** (or the **Past sessions** button
in the library).

The studio does not show a score. Actions still carry point values, and a
score is still calculated and saved with each session (done = full points,
delayed = half, incorrect/missed = zero) so that JSON exports and the
institution archive keep the same shape; it is simply not part of the
debrief.

> **Sessions are stored in the browser** (localStorage) on the faculty device
> — clearing browser data deletes them. The Debrief page has **⬇ Export all
> (JSON)** / per-session **Export** and **⬆ Import JSON** to back up session
> history or move it to another machine; each report also has its own
> **⬇ Export JSON** next to Export PDF. If the device's storage is full when a
> session ends, the report shows an orange "held in memory only" warning —
> export it before closing the tab. On installations with institution
> accounts, ended sessions also sync to the shared **Institution archive** on
> the Debrief page (read-only from other devices; amendments happen on the
> device that ran the session and re-sync automatically).

## 9. Authoring scenarios (brief)

The **Scenario Editor** (home page, or **✏️ New scenario** / **Edit** in the
library) edits scenarios as forms with a live JSON pane:

- The editor is six steps, in the order a case is written: **Basics** (title,
  who it is for, objectives, room setup), **Patient**, **Starting state**
  (the vitals at time zero, with a preview of the monitor), **Progression**
  (phases, what happens, what learners should do, faculty notes), **Debrief**
  and **Review & publish** (saved versions, publishing, scoring, case ID).
  Each step shows a count of things to fix or worth a look.
- In **Starting state** the numbers every case sets come first; depth and
  agent, the CO₂ waveform, the anesthesia machine, the twitch monitor, ECG
  detail and alarm limits are in closed groups that say whether anything in
  them is set. A number outside its range is reported under the field and is
  not stored.
- **Progression** is one page. Each phase is a card: what happens in it on
  the left, what learners should do about it on the right. An event reads as
  a sentence when closed ("Automatically at 4:00 · BP 92/52 · HR 104, over
  1:30") and opens into its form. Add a **timed change**, a **faculty-fired
  change**, or from the **…** menu a template, a return to the starting
  vitals, or a log note. Type an expected action and press Enter to add it;
  mark it **Critical**, or open **Details** for a note, its phase and points.
- In an event's changes, a **blank field means "no change"** — only fill in
  what the event should move. Times are typed as minutes:seconds. Less common
  changes (temperature, depth, agent, CO₂ waveform, machine, twitch monitor,
  ECG detail) are under **More changes**.
- You never type ids. Phases, events and actions get one from their name;
  renaming something that is already saved keeps its id, and removing an
  action also removes its event links and rubric membership. Rubric
  categories are under **Review & publish → Scoring**.
- **Your edits are kept as you work.** Every change is stored as a draft on
  this device a moment later, and the editor picks it up again if you reload,
  close the tab or come back another day (with a **Discard them** button). A
  draft is not in the library, a session or the cloud until you save a
  version; the library marks such cases **unsaved edits**. **Undo / Redo**
  (toolbar, or Ctrl/⌘ Z and Ctrl/⌘ Shift Z) step back through this visit's
  changes, including an import, a restored version or a loaded AI draft.
- **New cases get their own ID.** The ID is created from the title the first
  time you save, so two new cases never overwrite each other. **New case** in
  the library starts blank or from a copy of any case; **Duplicate** in a
  case's menu makes a copy with its own ID and history. Typing an ID that
  already belongs to another case asks before saving over it.
- **💾 Save version** (or Ctrl/⌘ S) stores the scenario on this device with
  version history.
  Signed-in faculty also see a cloud status after saving ("syncing… / synced
  to cloud / cloud sync pending"), and the library badges each custom
  scenario **cloud / sync pending / local only**. **Review & publish**
  shows the institution copy's review state (**draft / review / published**)
  and, for faculty who may approve, an **Approve & publish** button: it
  publishes the saved version as the approved one, and sessions run from then
  on are recorded against that exact version. Saving an edit over a
  published scenario returns it to draft until it is approved again.
- **Review & publish** opens with a **Readiness** checklist: everything that
  must be fixed before the case can be saved or run (**Must fix**) and
  anything that is probably unintended (**Worth a look**, which never stops
  you saving), each in plain words with a **Show me** button that opens the
  field. The same items are listed at the top of the page they belong to,
  and the count in the toolbar opens the checklist.
- **Scoring** on that page is optional: points for each action (a new action
  starts at 0) and, if you report scores by category, the rubric categories.
- **▶ Test run** saves a version if you have unsaved changes, then opens the
  controller on it (enabled once nothing is marked Must fix).
- **Review & publish → Advanced** holds the case ID, the version label and
  the case as a file: **Export JSON / Import JSON** move scenario files
  between machines, and **Edit JSON** shows the whole case as text in place
  of the form. JSON edits only take effect when you press **Apply JSON**.

See [scenario.schema.md](scenario.schema.md) for the full field reference, or
export a built-in scenario as a working example. Clinical content in the five
built-ins is reviewed material — have new clinical content reviewed by faculty
before using it for assessment.

## 9b. Importing an existing run sheet

**📄 Import run sheet** in the library turns an instructor guide you already
teach from into a scenario draft — without rewriting it.

1. **Paste** the run sheet text (Word: select all, copy, paste), or upload a
   `.txt`/`.md` file. When your institution runs the hosted import service
   and you are signed in, you can upload the `.docx`/`.pdf` directly.
2. Capno finds the scenarios the sheet describes (one draft per
   "Scenario N"), and lifts objectives, equipment/setup, phase headings,
   instructor cue lines (as events), the assessment table (as expected
   actions and rubric categories) and the debrief prompts — each shown
   next to the source text it came from.
3. **Review**: every field carries a status — *from source* (quoted
   verbatim), *suggested* (an inference such as patient sex from a
   pronoun), *not in source*, or *confirmed*. Accept what is right, edit
   what is not, enter what the sheet leaves out. Vital signs, doses,
   patient demographics and event effects are **never** filled in for you.
4. **Save to library** is enabled only when the review queue is empty. The
   scenario lands in the library tagged `imported`, opens in the editor,
   and follows the normal save / version / approval path.

Imported rubric rows keep their wording and carry no point values; the
session record shows your marks beside each row's descriptors.

## 10. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Student sees "No controller responded" after joining | Wrong code; controller not open; different browser/profile on one machine; Supabase not configured across devices; or the code changed after a controller reload. Press **Retry** after fixing. |
| "Connection to controller lost — showing last received data" on the monitor | The controller tab was closed, reloaded, or lost network. Reopen it — students rejoin with the new code. |
| "Session ended by faculty" on the monitor | You pressed **■ End session** — this is normal; students can join the next session's code. |
| Cloud sync dot is red or orange | Cross-device sync is degraded — remote displays may be stale until it recovers (it reconnects on its own). Same-device windows are unaffected. |
| No monitor sound | Check the device volume, then the speaker button on the monitor: **🔈 tap for sound** means the browser is waiting for a tap; 🔇 means it was turned off there. Your own preview is off by default. |
| Alarm tone on a mild abnormality | Warnings now sound (three low pulses). Press **🔕 Silence** on the monitor, use **pause all alarms**, or correct the vital. |
| BP "stuck" while sliders move | That's NIBP cuff mode working as intended — press **Cycle NIBP now** or wait for the next cuff cycle. |
| HR tile is a beat off the slider, or bounces in AF | The monitor counts rate from the beats it draws (§5). Alarms and the debrief use the slider value. |
| SpO₂ or NIBP shows dashes | No pulse to measure (VF, PEA, asystole), or the cuff cycled at a systolic under 30 mmHg (§5). |
| PIN screen on a machine that shouldn't have one | `NEXT_PUBLIC_FACULTY_PIN` is set for this installation; the PIN is advisory only. Signed-in faculty accounts bypass it. |
| "Device storage is full" when saving or ending a session | The browser's storage quota is exhausted — export scenarios/sessions as JSON, delete old ones, and save again. A memory-only debrief must be exported before the tab closes. |
| Past sessions missing | Archives are per-device browser storage — check the machine the session was run on, restore from a JSON export, or (with institution accounts) open the Institution archive. |
