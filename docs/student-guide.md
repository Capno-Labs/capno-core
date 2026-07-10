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
   Once joined, the monitor starts in **standby** until the instructor presses
   Start.

## Reading the monitor

- **Waveforms:** ECG lead II (with the current rhythm label), plethysmograph
  (pulse oximetry), and capnograph (CO₂), sweeping like a real monitor.
- **Numeric tiles:** HR, blood pressure, SpO₂, EtCO₂ (with respiratory rate),
  temperature, and end-tidal sevoflurane (SEV, with inspired fraction +
  depth). Small arrows
  show whether a value is trending up or down.
- **Elapsed clock:** scenario time since start. A **paused** badge means the
  instructor has frozen the scenario.

**About the blood pressure tile:** most scenarios use a non-invasive cuff
(**NIBP**), just like a real one — the number is the *last measurement*, and
the tile shows its age ("MAP 73 · 2:30 ago"). A reading from two minutes ago
may not reflect the patient *now*; if you want a fresh pressure, ask for the
cuff to be cycled. Scenarios with an arterial line show a continuous **ART**
pressure instead.

## Alarms and sound

- A yellow banner is a **warning** alarm; a flashing red banner is **critical**.
  🔕 means the instructor has silenced alarms.
- Sound is **off by default** — tap the 🔇 icon in the top bar to enable it.
  You'll hear a per-beat pulse tone whose pitch falls as SpO₂ falls (listen for
  the drop, like a real pulse oximeter) and an alarm tone for critical states.

## Display tips

- The view is **read-only** — refreshing or tapping can't change the patient.
- For a projector or wall display, use the browser's fullscreen mode (F11, or
  ⌃⌘F on Mac), or install Capno as an app (PWA) for a chrome-free screen.
- A red **"Connection to controller lost — showing last received data"** banner
  means the instructor's window closed or lost connection; the numbers on
  screen are no longer live. It recovers by itself if the connection returns —
  otherwise the instructor will give you a new code to rejoin.
- **"Session ended by faculty"** means the instructor ended the scenario —
  nothing is wrong.
- When you've joined from a different device than the instructor's, small
  **Local/Cloud** sync dots sit in the bottom corner; a red Cloud dot means
  the display may be behind until the connection recovers.
