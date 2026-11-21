# Student guide — the student patient monitor

> ⚠️ **For simulation and education only. Not a medical device. Never use for clinical care.**

The student display is a simulated OR patient monitor. It mirrors what the
instructor drives from the faculty controller — you watch and respond as a
team; nothing on this screen is interactive except joining and the sound
toggle.

## Joining a session

1. Open **Student Display** from the home page (or go to `/student`).
2. Type the **4-character session code** shown on the instructor's controller
   and press **Join session** (capitalisation doesn't matter).
3. If it says "Waiting for session", the controller isn't reachable yet. After
   about 8 seconds with no answer it changes to **"No controller responded"**
   with a **Retry** button — check the code with your instructor, then retry.
   Once joined, you'll see the monitor in **standby**, or — if your
   instructor has turned it on — the **patient pre-brief** (history,
   allergies, airway exam and plan; read it while you wait). The live monitor
   starts when the instructor presses Start.

## Reading the monitor

- **Waveforms:** ECG lead II, plethysmograph (pulse oximetry), and capnograph
  (CO₂), sweeping like a real monitor, plus an arterial trace when the patient
  has an arterial line. The rhythm is not labelled — read it from the trace.
- **Capnogram:** drawn on a 0–50 mmHg scale (0–75 when the reading is above
  50). Between breaths it should fall back to zero; "Fi" beside the respiratory rate is the inspired CO₂, and a
  baseline that sits above zero means the patient is rebreathing. Watch the
  shape as well as the number.
- **ST level:** under the heart rate, "ST II" shows the ST-segment level in
  lead II in millimetres — negative is depression, positive is elevation. No
  alarm sounds for it; watch the number and the trace. When a second trace,
  **ECG V5**, is on screen it has its own "ST V5" — check both: ischemia
  often shows in one lead and not the other.
- **Numeric tiles:** HR, blood pressure, SpO₂, EtCO₂ (with respiratory rate),
  temperature, and end-tidal volatile agent (SEV, ISO or DES, with inspired
  fraction, MAC and depth). When the anesthesia machine is connected there
  are three more: airway pressure (peak, with plateau and PEEP), tidal volume
  (with minute volume) and inspired oxygen. When a twitch monitor is
  attached there is a **TOF** tile: the train-of-four ratio as a percentage
  when all four twitches are present, the count (for example 2/4) when fewer
  are, and the post-tetanic count (PTC) when there are none. Its four bars
  are the twitches of the last train; it re-measures every 15 seconds, so it
  shows the last measurement, not a live value. Small arrows
  show whether a value is trending up or down.
- **Elapsed clock:** scenario time since start. A **paused** badge means the
  instructor has frozen the scenario.

**About the blood pressure tile:** most scenarios use a non-invasive cuff
(**NIBP**), just like a real one — the number is the *last measurement*, and
the tile shows its age ("MAP 73 · 2:30 ago"). A reading from two minutes ago
may not reflect the patient *now*; if you want a fresh pressure, ask for the
cuff to be cycled. Scenarios with an arterial line show a continuous **ART**
pressure instead.

**A rhythm on the screen is not a pulse.** The ECG shows electrical activity
only. If the pleth is flat and SpO₂ shows dashes while the ECG still looks
organized, check for a pulse.

**Dashes mean no signal, not zero.** If SpO₂ shows `--`, the oximeter has no
pulse to read; if NIBP shows `--/--`, the cuff found no pressure. Look at the
patient and the rhythm, not for a number.

## Alarms and sound

- The small numbers beside a reading (for example `50–110` next to the heart
  rate) are its alarm limits. They depend on the patient: a monitor set for a
  child has different limits from one set for an adult.
- A yellow banner is a **warning** alarm; a flashing red banner is **critical**.
  🔕 means the instructor has silenced alarms.
- Sound is **on by default**. If the top bar shows **🔈 tap for sound**, tap
  anywhere once — the browser needs that before it will play. The speaker
  button cycles full → low → off.
- You'll hear a per-beat pulse tone whose pitch falls as SpO₂ falls (listen
  for the drop, like a real pulse oximeter).
- Alarm sounds follow priority: **critical** is a repeating burst of ten
  quick, high pulses; a **warning** is three slower, lower pulses repeated
  less often.

## Display tips

- The view is **read-only** — refreshing or tapping can't change the patient.
- For a projector or wall display, tap the fullscreen button in the top-right
  corner (or F11, ⌃⌘F on Mac), or install Capno as an app (PWA) for a
  chrome-free screen.
- A red **"Connection to controller lost — showing last received data"** banner
  means the instructor's window closed or lost connection; the numbers on
  screen are no longer live. It recovers by itself if the connection returns —
  otherwise the instructor will give you a new code to rejoin.
- **"Session ended by faculty"** means the instructor ended the scenario —
  nothing is wrong.
- When you've joined from a different device than the instructor's, small
  **Local/Cloud** sync dots sit in the bottom corner; a red Cloud dot means
  the display may be behind until the connection recovers.
