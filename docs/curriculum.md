# The case library curriculum

How the built-in scenario library is organized, and the published curricula it
mirrors. This is the reference for the **topic taxonomy** used in
`tags.topics`, the **difficulty → training-level tiers**, and the clinical
sources behind each scenario.

> ⚠️ **Simulation and education only. Not a medical device. Never use for
> clinical care.** Scenario numbers and drug doses are teaching
> approximations drawn from the cited guidelines; always defer to current
> local protocols in real practice.

## How top programs organize simulation topics

The library's shape follows how leading anesthesiology programs structure
simulation training:

- **Crisis resource management (Stanford ACRM/CISL).** Stanford's Anesthesia
  Crisis Resource Management courses — the model adapted from aviation by
  Gaba and Howard — run scenarios chosen to mix *common* and
  *rare-but-lethal* critical events, each followed by structured debriefing,
  with team behaviors (declaring the emergency, calling for help, role
  assignment, closed-loop communication) assessed alongside medical
  management. Every CAPNO scenario therefore carries explicit
  communication actions and a communication rubric category.
- **A shared taxonomy of critical events (Stanford Emergency Manual).** The
  Stanford Anesthesia Cognitive Aid Group's *Emergency Manual* organizes
  ~25 perioperative crises (cardiac arrest rhythms, bradycardia, myocardial
  ischemia, anaphylaxis, bronchospasm, difficult airway/CICO, hemorrhage,
  hypoxemia, embolism, pneumothorax, MH, LAST, high spinal, fires, equipment
  failures…). The library's domain tags mirror that organization.
- **Tiered progression by training year.** Published residency simulation
  curricula (e.g. Johns Hopkins; Ramaiah et al., *Cureus* 2021 —
  PMC8263316) give junior residents foundational crises (anaphylaxis,
  malignant hyperthermia, myocardial ischemia) and reserve rarer,
  procedure-heavy events (venous air embolism, LAST, obstetric hemorrhage,
  CICO/cricothyroidotomy) for senior years. The library's difficulty tiers
  map to that progression.
- **ASA/ABA MOCA scenario domains.** Simulation courses satisfying ABA
  MOCA requirements center on significant perioperative hypoxemia,
  significant hemodynamic perturbation, difficult airway, adverse
  respiratory events, and rare/equipment events — all represented below.

## Topic taxonomy

Convention: **`tags.topics[0]` is exactly one domain** from this closed
vocabulary; the remaining entries are free-form specifics (mechanism, key
drug or skill, cross-cutting themes like `crisis management`). The
`/scenarios` library page builds its topic filter from these tags, so
keeping the first tag canonical keeps the filter clean.

| Domain | Meaning | Scenarios |
| --- | --- | --- |
| `airway` | Obstruction, failed airway, front-of-neck access | laryngospasm-lma, difficult-airway-cico |
| `respiratory` | Gas-exchange and ventilation crises | intraop-bronchospasm |
| `cardiac` | Rhythm disturbances and arrest | bradycardia-asystole |
| `hemodynamics` | Pressure/perfusion management short of hemorrhage | induction-hypotension |
| `hemorrhage` | Major bleeding and transfusion (incl. obstetric) | postpartum-hemorrhage |
| `embolic` | Air, thrombus, amniotic fluid embolism | venous-air-embolism |
| `hypersensitivity` | Anaphylaxis and allergic reactions | anaphylaxis |
| `toxicity` | Drug toxicity (LAST, overdose) | last-nerve-block |
| `temperature/metabolic` | MH, hypermetabolic and metabolic crises | malignant-hyperthermia |

## Difficulty tiers and training levels

Difficulty maps to a standard `trainingLevels` set, mirroring
training-year progression:

| Tier | trainingLevels | Intent |
| --- | --- | --- |
| `beginner` | medical_student, srna, resident_junior | Foundational management, single-system, forgiving tempo |
| `intermediate` | srna, resident_junior, resident_senior, crna | Common crises with escalation decisions |
| `advanced` | resident_junior, resident_senior, crna, attending | Rare/lethal events, procedural rescue, team leadership |

## The library at a glance

| Scenario | Domain | Tier | Core lesson |
| --- | --- | --- | --- |
| induction-hypotension | hemodynamics | beginner | Recognize and treat post-induction hypotension |
| laryngospasm-lma | airway | intermediate | CPAP → deepen → succinylcholine escalation |
| bradycardia-asystole | cardiac | intermediate | Remove the vagal stimulus; ACLS bradycardia → asystole |
| intraop-bronchospasm | respiratory | intermediate | Shark-fin capnograph; deepen, bronchodilate, avoid auto-PEEP |
| anaphylaxis | hypersensitivity | advanced | Early epinephrine, aggressive volume, tryptase follow-up |
| malignant-hyperthermia | temperature/metabolic | advanced | Trigger removal, dantrolene, hypermetabolic supportive care |
| last-nerve-block | toxicity | advanced | Lipid emulsion, modified ACLS for LAST |
| difficult-airway-cico | airway | advanced | Attempt discipline, declared CICO, scalpel cricothyroidotomy |
| postpartum-hemorrhage | hemorrhage | advanced | QBL over the cuff; uterotonics, TXA, massive transfusion |
| venous-air-embolism | embolic | advanced | The unexplained EtCO2 fall; stop entrainment, support the RV |

## Clinical sources by scenario

Per the project's source-verification rule (see `CLAUDE.md`), scenario
clinical content is authored against published guidance:

- **bradycardia-asystole** — AHA 2020 ACLS guidelines: adult bradycardia
  algorithm (atropine 1 mg IV q3–5 min, max 3 mg; pacing and/or
  epinephrine 2–10 mcg/min or dopamine 5–20 mcg/kg/min) and the
  non-shockable arrest pathway; Miller's Anesthesia on pneumoperitoneum
  vagal physiology.
- **intraop-bronchospasm** — Looseley, *Management of bronchospasm during
  general anaesthesia* (Anaesthesia Tutorial of the Week/e-SAFE, 2011);
  PMC3057257; BJA Education perioperative asthma reviews; GINA report
  (control criteria).
- **difficult-airway-cico** — Difficult Airway Society 2025 guidelines for
  management of unanticipated difficult tracheal intubation in adults
  (*Br J Anaesth* 2026;136:283–307); 2022 ASA Practice Guidelines for
  Management of the Difficult Airway; DAS 2015 (Frerk et al.).
- **postpartum-hemorrhage** — ACOG Practice Bulletin No. 183 (uterotonic
  sequence and doses); WOMAN trial (*Lancet* 2017, TXA within 3 h);
  SOAP consensus statement and CMQCC obstetric hemorrhage toolkit (QBL,
  fibrinogen >200 mg/dL, massive transfusion practice).
- **venous-air-embolism** — Mirski et al., *Diagnosis and treatment of
  vascular air embolism*, Anesthesiology 2007;106:164–77; OpenAnesthesia
  and StatPearls VAE summaries; AHA 2020 ACLS for the PEA arm.
- **anaphylaxis, malignant-hyperthermia, last-nerve-block,
  laryngospasm-lma, induction-hypotension** — see the original scenario
  PRs; management follows the corresponding society guidance (e.g. ASRA
  LAST checklist, MHAUS protocol).

## Adding scenarios to the curriculum

Pick the domain first (`topics[0]`), match the tier table above, follow the
authoring recipe in `CLAUDE.md`, keep the field reference
(`docs/scenario.schema.md`) at hand, and cite your clinical sources in the
PR description and — ideally — in this file.
