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
vocabulary, and **`topics[1]` names the crisis** from the catalog below
when the scenario instantiates a catalog entry; the remaining entries are
free-form specifics (mechanism, key drug or skill, cross-cutting themes
like `crisis management`). The `/scenarios` library page groups scenarios
by domain (via `domainOf()` in `src/lib/engine/lint.ts`, which matches the
first domain tag wherever it appears), so keeping a canonical domain tag
keeps the library organized — scenarios without one land under
"Custom & drafts".

| Domain | Meaning | Scenarios |
| --- | --- | --- |
| `airway` | Obstruction, failed airway, front-of-neck access, airway fire | laryngospasm-lma, difficult-airway-cico |
| `respiratory` | Gas-exchange and ventilation crises | intraop-bronchospasm, hypoxemia |
| `cardiac` | Rhythm disturbances, ischemia, and arrest | bradycardia-asystole, myocardial-ischemia |
| `hemodynamics` | Pressure/perfusion management short of hemorrhage | induction-hypotension |
| `hemorrhage` | Major bleeding and transfusion (incl. obstetric, transfusion reactions) | postpartum-hemorrhage |
| `embolic` | Air, thrombus, amniotic fluid, cement embolism | venous-air-embolism |
| `hypersensitivity` | Anaphylaxis and allergic reactions | anaphylaxis |
| `toxicity` | Drug toxicity (LAST, overdose, reversal failure) | last-nerve-block |
| `temperature/metabolic` | MH, hypermetabolic, electrolyte and metabolic crises | malignant-hyperthermia |
| `neuro` | High spinal, delayed emergence, seizure, awareness | — |
| `equipment` | Machine/pipeline/power failure, OR fire, infusion error | — |

## Difficulty tiers and training levels

Difficulty maps to a standard `trainingLevels` set, mirroring
training-year progression:

| Tier | trainingLevels | Intent |
| --- | --- | --- |
| `beginner` | medical_student, srna, saa, resident_junior | Foundational management, single-system, forgiving tempo |
| `intermediate` | srna, saa, resident_junior, resident_senior, crna, caa | Common crises with escalation decisions |
| `advanced` | resident_junior, resident_senior, crna, caa, attending | Rare/lethal events, procedural rescue, team leadership |

## The library at a glance

| Scenario | Domain | Tier | Core lesson |
| --- | --- | --- | --- |
| induction-hypotension | hemodynamics | beginner | Recognize and treat post-induction hypotension |
| laryngospasm-lma | airway | intermediate | CPAP → deepen → succinylcholine escalation |
| bradycardia-asystole | cardiac | intermediate | Remove the vagal stimulus; ACLS bradycardia → asystole |
| myocardial-ischemia | cardiac | advanced | Supply-vs-demand; rate control and perfusion pressure before nitrates |
| intraop-bronchospasm | respiratory | intermediate | Shark-fin capnograph; deepen, bronchodilate, avoid auto-PEEP |
| hypoxemia | respiratory | intermediate | Systematic hypoxemia drill; find and correct the mainstem migration |
| anaphylaxis | hypersensitivity | advanced | Early epinephrine, aggressive volume, tryptase follow-up |
| malignant-hyperthermia | temperature/metabolic | advanced | Trigger removal, dantrolene, hypermetabolic supportive care |
| last-nerve-block | toxicity | advanced | Lipid emulsion, modified ACLS for LAST |
| difficult-airway-cico | airway | advanced | Attempt discipline, declared CICO, scalpel cricothyroidotomy |
| postpartum-hemorrhage | hemorrhage | advanced | QBL over the cuff; uterotonics, TXA, massive transfusion |
| venous-air-embolism | embolic | advanced | The unexplained EtCO2 fall; stop entrainment, support the RV |

## The full catalog and coverage map

The master list of intraoperative crises the library aims to cover,
anchored to the Stanford *Emergency Manual* (~25 perioperative crises) and
the ABA MOCA scenario domains, with recognized extensions. **Tier A** =
Emergency Manual / MOCA core; **Tier B** = recognized extensions.

Catalog entries are names only. Per the source-verification rule
(`CLAUDE.md` invariant 7), a scenario authored from this list must be
verified against published guidelines or standard texts at authoring time,
with citations added to this file and the PR.

Conventions: scenario id = `<crisis-slug>[-<variant-qualifier>]`
(e.g. `pneumothorax-tension`, `anaphylaxis-rocuronium`); variants of one
crisis are separate whole scenarios sharing the slug prefix and
`topics[1]`. The ten shipped ids predate this convention and are
grandfathered unchanged.

| Domain | Crisis (slug) | Tier | Suggested difficulty | Status |
| --- | --- | --- | --- | --- |
| `airway` | laryngospasm | A | intermediate | ✓ shipped (`laryngospasm-lma`) |
| `airway` | cannot intubate, cannot oxygenate (`cico`) | A | advanced | ✓ shipped (`difficult-airway-cico`) |
| `airway` | difficult intubation, non-CICO (`difficult-intubation`) | A | intermediate | open |
| `airway` | aspiration of gastric contents (`aspiration`) | A | intermediate | open |
| `airway` | airway fire (`airway-fire`) | A | advanced | open |
| `airway` | ETT failure — obstruction/migration/cuff leak (`ett-failure`) | B | intermediate | open |
| `respiratory` | bronchospasm | A | intermediate | ✓ shipped (`intraop-bronchospasm`) |
| `respiratory` | unexplained hypoxemia (`hypoxemia`) | A | intermediate | ✓ shipped (`hypoxemia`) |
| `respiratory` | pneumothorax, incl. tension variant (`pneumothorax`) | A | advanced | open |
| `respiratory` | mainstem intubation (`mainstem-intubation`) | B | beginner | open |
| `respiratory` | hypoventilation / hypercapnia (`hypoventilation`) | B | beginner | open |
| `cardiac` | unstable bradycardia → asystole (`bradycardia`) | A | intermediate | ✓ shipped (`bradycardia-asystole`) |
| `cardiac` | myocardial ischemia (`myocardial-ischemia`) | A | advanced | ✓ shipped (`myocardial-ischemia`) |
| `cardiac` | VF / pulseless VT arrest (`vf-arrest`) | A | advanced | open |
| `cardiac` | PEA arrest (`pea-arrest`) | A | advanced | open |
| `cardiac` | unstable SVT (`unstable-svt`) | A | intermediate | open |
| `cardiac` | acute right-heart failure (`rv-failure`) | A | advanced | open |
| `cardiac` | oculocardiac reflex (`oculocardiac-reflex`) | B | beginner | open |
| `hemodynamics` | post-induction hypotension (`induction-hypotension`) | A | beginner | ✓ shipped |
| `hemodynamics` | refractory / undifferentiated hypotension (`refractory-hypotension`) | A | advanced | open |
| `hemodynamics` | hypertensive emergency (`hypertensive-emergency`) | B | intermediate | open |
| `hemodynamics` | autonomic hyperreflexia (`autonomic-hyperreflexia`) | B | intermediate | open |
| `hemodynamics` | vasoplegia / septic shock (`septic-shock`) | B | advanced | open |
| `hemorrhage` | postpartum hemorrhage | A | advanced | ✓ shipped (`postpartum-hemorrhage`) |
| `hemorrhage` | massive surgical/trauma hemorrhage + MTP (`massive-hemorrhage`) | A | advanced | open |
| `hemorrhage` | acute hemolytic transfusion reaction (`hemolytic-transfusion-reaction`) | A | advanced | open |
| `hemorrhage` | TRALI / TACO (`trali-taco`) | B | advanced | open |
| `embolic` | venous air embolism | A | advanced | ✓ shipped (`venous-air-embolism`) |
| `embolic` | intraoperative pulmonary thromboembolism (`pulmonary-embolism`) | A | advanced | open |
| `embolic` | amniotic fluid embolism (`amniotic-fluid-embolism`) | B | advanced | open |
| `embolic` | bone cement implantation syndrome (`bone-cement-syndrome`) | B | advanced | open |
| `hypersensitivity` | anaphylaxis | A | advanced | ✓ shipped (`anaphylaxis`; agent variants open) |
| `toxicity` | local anesthetic systemic toxicity (`last`) | A | advanced | ✓ shipped (`last-nerve-block`) |
| `toxicity` | opioid-induced ventilatory impairment (`oivi`) | B | intermediate | open |
| `toxicity` | residual neuromuscular blockade (`residual-nmb`) | B | intermediate | open |
| `toxicity` | methemoglobinemia | B | advanced | open |
| `temperature/metabolic` | malignant hyperthermia | A | advanced | ✓ shipped (`malignant-hyperthermia`) |
| `temperature/metabolic` | hyperkalemia | A | advanced | open |
| `temperature/metabolic` | hypoglycemia | B | intermediate | open |
| `temperature/metabolic` | TURP syndrome / acute hyponatremia (`turp-syndrome`) | B | advanced | open |
| `temperature/metabolic` | thyroid storm (`thyroid-storm`) | B | advanced | open |
| `temperature/metabolic` | severe hypothermia (`hypothermia`) | B | intermediate | open |
| `neuro` | high / total spinal (`high-spinal`) | A | advanced | open |
| `neuro` | delayed emergence (`delayed-emergence`) | A | intermediate | open |
| `neuro` | intraoperative seizure (`seizure`) | B | intermediate | open |
| `neuro` | intraoperative awareness (`awareness`) | B | intermediate | open |
| `equipment` | O₂ pipeline failure / crossover (`o2-pipeline-failure`) | A | advanced | open |
| `equipment` | ventilator failure / circuit disconnect (`ventilator-failure`) | A | intermediate | open |
| `equipment` | OR power failure (`power-failure`) | A | intermediate | open |
| `equipment` | OR fire — patient/drapes (`or-fire`) | A | advanced | open |
| `equipment` | infusion pump / line-swap error (`infusion-error`) | B | intermediate | open |

Coverage: 51 catalog entries — 12 shipped free (all Tier A), 19 open Tier A
gaps, 20 Tier B extensions. The maintainer's placement decision: these 12
ship free in this repo; the remaining open entries are delivered through
the hosted curated library (see `CLAUDE.md`, "Where features belong").

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
  *Machine readings (1.0.1).* Peak pressures 38, 44 and 50 cmH₂O are the
  scenario's own numbers, now drawn instead of reported. The plateau stays at
  16 through the spasm: a high peak with a normal plateau is the sign of
  airway resistance (StatPearls
  [NBK448186](https://www.ncbi.nlm.nih.gov/sites/books/NBK448186/)). Delivered
  tidal volume falls when the spasm is severe (Hodder et al., *CMAJ*
  2010;182:265, [PMC2826468](https://pmc.ncbi.nlm.nih.gov/articles/PMC2826468/);
  Garcia et al., *Cureus* 2022;14:e21521,
  [PMC8863117](https://pmc.ncbi.nlm.nih.gov/articles/PMC8863117/), where 400 mL
  set delivered 18 mL). Breath stacking raises the plateau to 28 — the value
  at the worst point in Leatherman & Ravenscraft, *Crit Care Med*
  1996;24:541 (PMID 8625647; 28 ± 2 with a peak of 76 ± 7) and under the limit
  of 30 in Gayen et al., *J Clin Med* 2024;13:859
  ([PMC10856115](https://pmc.ncbi.nlm.nih.gov/articles/PMC10856115/)), which
  also gives the disconnection (a 30–60 s apnoea trial) for the hypotension.
  Chosen, not sourced: the size of the tidal-volume fall (510 → 200 mL, enough
  to trip the low-minute-volume alarm) and the steps back down with treatment
  (peak 44, 38, 30, 24, then 18; volume 300, 400, then 510). No source gave
  peak pressures for intraoperative bronchospasm; Leatherman's intensive-care
  series (53 ± 6 after improvement, from 76) shows only that the peak falls
  while staying raised. The disconnection itself (pressure and volume at
  zero) is not scripted — an effect cannot restore "whatever the readings
  were" — so faculty zero the readings by hand if they want it shown.
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
- **myocardial-ischemia** — Stanford Anesthesia Cognitive Aid Group,
  *Emergency Manual* (Myocardial Ischemia event: oxygen, rate control,
  coronary perfusion pressure, nitroglycerin); ACC/AHA perioperative
  cardiovascular management guidance and ACC/AHA ACS guidelines
  (nitroglycerin start 5–10 mcg/min, avoid if hypotensive; aspirin
  162–325 mg); esmolol 0.5 mg/kg IV over 1 min then 50–300 mcg/kg/min
  (StatPearls; intraoperative bolus-esmolol studies); AHA 2020 ACLS for the
  ventricular-fibrillation arm (defibrillate 120–200 J biphasic,
  epinephrine 1 mg q3–5 min, amiodarone 300 mg then 150 mg). ST levels
  drawn on the monitor, the same in leads II and V5 as the scenario's
  narration has it ("lead II and V5 now show 2 mm"): 2 mm then 3 mm of horizontal depression and a
  return to baseline are the scenario's own authored values, above the
  ≥1 mm horizontal-depression criterion of London et al. (*Anesthesiology*
  1988;69:232–41). No published definition was found for *improvement* of
  demand-ischemia ST depression, so the two "improving" events use chosen
  values: 1.5 mm after return of circulation (half the peak — inside the
  30–70% "partial resolution" band Schröder et al., *J Am Coll Cardiol*
  1994;24:384–91, defined for ST elevation after thrombolysis) and 1 mm
  after nitroglycerin (London's threshold: improved, not resolved).
- **hypoxemia** — Stanford *Emergency Manual* (Hypoxemia event: 100% O2 at
  10–15 L/min, hand-ventilate, exclude gas analyzer/circuit/probe,
  auscultate and suction the ETT, differential of mainstem intubation /
  plug / aspiration / pneumothorax); BJA Education / ATOTW reviews of
  intraoperative hypoxemia; literature on endotracheal tube migration in
  Trendelenburg with pneumoperitoneum (cephalad carinal shift of ~1–2 cm,
  tube tip should sit 2.5–4 cm above the carina).
  *Machine readings (1.0.1).* Insufflation raises peak pressure by 6 and
  plateau by 7 cmH₂O (to 24 and 23): Suh et al., *Korean J Anesthesiol*
  2010;59:329 ([PMC2998653](https://pmc.ncbi.nlm.nih.gov/articles/PMC2998653/)),
  12 mmHg, where head-down tilt added nothing further. The scenario says
  pressures "rise a little"; at 15 mmHg with 30° tilt Park et al., *J Clin
  Med* 2019;8:2032
  ([PMC6947332](https://pmc.ncbi.nlm.nih.gov/articles/PMC6947332/)) measured
  far more (peak 13.6 → 32.8), returning to 18.4 and 15.8 after desufflation —
  the basis for the readings going back to 18 and 16 when the surgeon
  desufflates. Peak 34 with the tube in the right main bronchus is the
  scenario's own number. The plateau rises with it because ventilating one
  lung lowers compliance: Szegedi et al., *Anesth Analg* 1997;84:1034 (PMID
  9141927) found peak up 55% and plateau up 42% on going from two lungs to
  one. Peak 24 → 34 is a 42% rise, so the plateau is set to rise in the same
  proportion to Szegedi's (about three quarters as much): 23 → 30. No source
  measured a mainstem intubation directly. Inspired oxygen reads 100% once
  the team turns it up (the scenario's own step) and returns to the starting
  50% at the end ("a reduced FiO₂").
- **anaphylaxis, malignant-hyperthermia, last-nerve-block,
  laryngospasm-lma, induction-hypotension** — see the original scenario
  PRs; management follows the corresponding society guidance (e.g. ASRA
  LAST checklist, MHAUS protocol).

## Clinical sources for the monitor display

The monitor's drawing and sound constants are held to published values. The
tests in `src/components/monitor/` assert the ranges below, so a change that
leaves a range fails the build. Where no source was found, that is said.

**ECG**

| What the monitor does | Source |
| --- | --- |
| 1 mm = 0.1 mV; the R wave is drawn 10 mm tall | Hegde & Ahmed, *Electrocardiogram*, StatPearls ([NBK549803](https://www.ncbi.nlm.nih.gov/books/NBK549803/)); Thygesen et al., Fourth Universal Definition of MI, *Eur Heart J* 2019;40:237–69 |
| PR about 150 ms (normal 120–200); QRS about 95 ms (normal 60–100) | StatPearls NBK549803 |
| "Wide" QRS about 150 ms (wide is ≥120 ms) | Surawicz et al., AHA/ACCF/HRS recommendations Part III, 2009, as tabulated in Blondeel et al., *Rev Cardiovasc Med* 2025 (PMC11759958) |
| QT follows √RR (Bazett); normal QTc about 380 ms; "prolonged" about 515 ms (>500 ms is highly abnormal; 99th percentile 470 ms men, 480 ms women) | Drew et al., AHA/ACCF statement on torsade de pointes, *Circulation* 2010 ([PMC3056123](https://pmc.ncbi.nlm.nih.gov/articles/PMC3056123/)) |
| ST level is a level (horizontal) offset from the J point; ischemic depression is ≥0.5 mm at the J point, ≥1 mm 60–80 ms after it for monitoring | Fourth Universal Definition of MI; London et al., *Anesthesiology* 1988;69:232–41 (PMID 3407971); Vaidya, *Indian Heart J* 2017 (PMC5560878) |
| Peaked T: tall, narrow, symmetrical, 6.6 mm (normal limb-lead T is under 5 mm; the normal T here is 3 mm) | McMahon & Ahmed, *ECG T Wave*, StatPearls ([NBK538264](https://www.ncbi.nlm.nih.gov/books/NBK538264/)); Simon & Rout, *Hyperkalemia*, StatPearls ([NBK470284](https://www.ncbi.nlm.nih.gov/books/NBK470284/)) |
| Flat T 0.6 mm; inverted T −2.4 mm | **No source.** The AHA/ACCF/HRS Part IV amplitude definitions could not be obtained; these two are drawing choices |
| PVC: wide (>120 ms), no P wave, full compensatory pause (the interval spanning it is twice the sinus cycle); bigeminy and trigeminy | Sattar & Hashmi, *Premature Ventricular Complex*, StatPearls ([NBK547713](https://www.ncbi.nlm.nih.gov/books/NBK547713/)) |
| PVC coupling at 0.6 of the cycle; PVC pulse about 0.4 of normal; the beat after the pause about 10% stronger | Voss et al., *J Physiol* 2002;538:271 ([PMC2290033](https://pmc.ncbi.nlm.nih.gov/articles/PMC2290033)): coupling 0.52 s and pause 1.13 s, ectopic systolic about −20%, post-ectopic pulse amplitude +9.8% |
| PAC: early P of different shape, normal QRS, incomplete pause | Heaton & Yandrapalli, *Premature Atrial Contractions*, StatPearls ([NBK559204](https://www.ncbi.nlm.nih.gov/books/NBK559204/)) |
| AF: irregular R-R, no P waves, fibrillatory waves at 365–487/min (published 350–500/min); pulse size follows the preceding interval | January et al., 2014 AHA/ACC/HRS AF guideline ([PMC4676081](https://pmc.ncbi.nlm.nih.gov/articles/PMC4676081/)); Kwon & Kim, *Korean J Anesthesiol* 2017 (PMC5370296); Greenfield et al., *J Clin Invest* 1968;47:2411; Muntinga et al., *Heart* 1999;82:575. The 0.6–1.4 range of AF intervals is a drawing choice |
| First-degree AV block: every P conducted, PR about 260 ms (over 200 ms) | Varghese & Makaryus, *First-Degree Heart Block*, StatPearls ([NBK448164](https://www.ncbi.nlm.nih.gov/sites/books/NBK448164/)) |
| Mobitz I, 4:3: PR lengthens by less each beat, shortest after the dropped beat; R-R shortens; pause under two P-P intervals | Hansom et al., *Curr Cardiol Rev* 2021;17:10 ([PMC8142363](https://pmc.ncbi.nlm.nih.gov/articles/PMC8142363/)); Barold, *Clin Cardiol* 2018;41:282 (PMC6489887) |
| Mobitz II, 3:2: constant PR, a single dropped beat, wide QRS | Barold & Herweg, *Front Cardiovasc Med* 2024;11:1450705 ([PMC11390567](https://pmc.ncbi.nlm.nih.gov/articles/PMC11390567/)): infranodal, bundle branch block in 70–80%, needs two conducted beats in a row. The 3:2 ratio itself is a choice |
| Complete block: regular P waves unrelated to the QRS and faster than it; junctional escape narrow at 40–60/min (selected at 45), ventricular escape wide | Knabben et al., *Third-Degree Atrioventricular Block*, StatPearls ([NBK545199](https://www.ncbi.nlm.nih.gov/sites/books/NBK545199/)) |
| Junctional rhythm: regular, narrow, no P wave; escape rate 40–60/min (selected at 50) | Hafeez et al., *Junctional Rhythm*, StatPearls ([NBK507715](https://www.ncbi.nlm.nih.gov/sites/books/NBK507715/)) |
| Atrial flutter: sawtooth waves, negative-going in lead II, no flat baseline; atrial rate kept in 250–350/min, conducted 2:1 near 150/min or 4:1 near 75 | Goodacre & Irons, *BMJ* 2002;324:594 ([PMC1122515](https://pmc.ncbi.nlm.nih.gov/articles/PMC1122515/)); Rodriguez Ziccardi et al., *Atrial Flutter*, StatPearls ([NBK540985](https://www.ncbi.nlm.nih.gov/sites/books/NBK540985/)) |
| Torsades: polymorphic VT twisting about the baseline at 220/min (published 160–240) | Drew et al., *Circulation* 2010 (PMC3056123); Cohagan & Brandis, *Torsade de Pointes*, StatPearls ([NBK459388](https://www.ncbi.nlm.nih.gov/sites/books/NBK459388/)). Drawn without a pulse; torsades with a pulse is not modelled |
| Ventricular paced: a spike, then a wide QRS that is mainly negative in lead II, with a T wave the other way | Ebrille et al., *Indian Pacing Electrophysiol J* 2016;16:19 ([PMC4936653](https://pmc.ncbi.nlm.nih.gov/articles/PMC4936653/)): left-bundle-like pattern, left superior axis; Du & Zhang, *BMC Cardiovasc Disord* 2022;22:12 (secondary repolarization changes). That the spike sits just ahead of the QRS is inferred from the definition of non-capture |
| Idioventricular: regular wide complexes, no P waves, under 40/min (selected at 35) | Gangwani & Nagalli, *Idioventricular Rhythm*, StatPearls ([NBK554520](https://www.ncbi.nlm.nih.gov/sites/books/NBK554520/)). Sources disagree on where "accelerated" begins (40, 50 or 100/min) |
| PEA is any organized rhythm without a pulse; pulseless VT is VT without one. The ECG and heart rate carry on, and only the oximeter alarms | Oliver et al., *Pulseless Electrical Activity*, StatPearls ([NBK513349](https://www.ncbi.nlm.nih.gov/sites/books/NBK513349/)); Fulton & Nordquist, *Advanced Cardiac Life Support*, StatPearls (NBK613285). A narrow QRS suggests a mechanical cause and a wide one a metabolic or ischemic cause (Littmann et al., *Med Princ Pract* 2014;23:1 — a teaching tool) |
| Optional V5 lead with its own ST level | London et al., *Anesthesiology* 1988;69:232–41 (PMID 3407971): single-lead sensitivity for intraoperative ischemia II 33%, V5 75%, V4 61%; II + V5 80%; II + V4 + V5 96%. A later study in vascular patients found V3 (87%) and V4 (79%) ahead of V5 (66%): Landesberg et al., *Anesthesiology* 2002;96:264–70 (PMID 11818754). The site of demand-ischemia ST depression does not identify the artery and is most often V4–V6: Dunn et al., *Am J Cardiol* 1981;48:837; Fox et al., *Am J Cardiol* 1984;53:1529 |
| V5's normal complex: a small septal q (under 2 mm deep, 40 ms wide and a quarter of the R wave), a dominant R, a small or absent s, an upright T | Meek & Morris, *BMJ* 2002;324:470–3 ([PMC1122394](https://pmc.ncbi.nlm.nih.gov/articles/PMC1122394/)); StatPearls NBK549803 and NBK538264. P-wave polarity in V5 specifically was not found; it is drawn upright |
| Ectopic, paced and ventricular complexes are drawn alike in II and V5 | **A simplification, not sourced.** Their polarity differs by lead in life; sources on a paced complex in V5–V6 were inconsistent |

**Pulse, pressure and breathing**

| What the monitor does | Source |
| --- | --- |
| Arterial upstroke 185 ms after the R wave (radial line: means 174–200 ms, range 140–232) | Escobar-Restrepo et al., *Front Physiol* 2018;9:1848 ([PMC6308183](https://pmc.ncbi.nlm.nih.gov/articles/PMC6308183)) |
| Pleth upstroke 270 ms after the R wave (finger: means 267–284 ms, range 230–330) | Kortekaas et al., *PLoS One* 2018;13:e0204105 ([PMC6179208](https://pmc.ncbi.nlm.nih.gov/articles/PMC6179208)) |
| Pulse wave shortens with rate by the ejection-time regression LVET = 244 − 0.926·HR + 1.08·SV ms (taken at SV 70 mL) | Charlton et al., *Am J Physiol Heart Circ Physiol* 2019 ([PMC6879924](https://pmc.ncbi.nlm.nih.gov/articles/PMC6879924)), fitted to Weissler's data |
| Sinus intervals vary ±3.5% beat to beat: successive differences of about 24 ms RMS at 72 bpm | Lan et al., *Sensors* 2022;22:9258 ([PMC9740393](https://pmc.ncbi.nlm.nih.gov/articles/PMC9740393)): RMSSD 24–31 ms under propofol; Shaffer & Ginsberg, *Front Public Health* 2017;5:258: resting norm 42 ± 15 ms |
| Heart rate counted from the 12 most recent R-R intervals, or the last 4 once three in a row exceed 1200 ms | Philips IntelliVue MP20–MP90 Instructions for Use, Rel. G.0 (M8000-9001K), Performance Specifications. One manufacturer |
| Pulses 8% smaller in expiration than at end-inspiration (a pulse pressure variation of about 8%: below the 9–13% grey zone and the 13% threshold) | Michard & Teboul, *Crit Care* 2000;4:282–9 ([PMC137257](https://pmc.ncbi.nlm.nih.gov/articles/PMC137257)); Cannesson et al., *Br J Anaesth* 2008;101:200–6; Biais et al., *Crit Care* 2014;18:587 |
| SpO₂ shows `--` with no pulse; the pulse tone's pitch falls with SpO₂ | Jubran, *Crit Care* 1999;3:R11; ASA Standards for Basic Anesthetic Monitoring (variable-pitch pulse tone audible); Philips manual above |
| NIBP shows `--/--` below 30 mmHg systolic (the lower limit of the adult oscillometric range), and whenever the cuff cycles with no pulse | Philips manual above (measurement "may be inaccurate or impossible" without a regular pulse). One manufacturer |
| Capnogram plateau up to 4% under the EtCO₂ number | Consistent with a 2.4% median variation of repeated EtCO₂ readings in stable ventilated patients: Hess & Agarwal, *J Clin Monit* 1992;8:111 |
| Breath length varies ±4% | **No source.** No breath-to-breath figure was found for ventilated patients; kept small by choice |

**Capnography**

| What the monitor does | Source |
| --- | --- |
| Normal trace: baseline at zero (inspired gas is CO₂-free), upstroke, plateau ending at the end-tidal value | Kodali & Urman, *J Emerg Trauma Shock* 2014;7:332–40 ([PMC4231274](https://pmc.ncbi.nlm.nih.gov/articles/PMC4231274/)); Anderson & Breen, *Crit Care* 2000;4:207–15 ([PMC150038](https://pmc.ncbi.nlm.nih.gov/articles/PMC150038/)); Goldin et al., *Capnography*, StatPearls ([NBK482169](https://www.ncbi.nlm.nih.gov/sites/books/NBK482169/)) |
| Esophageal intubation: a first reading of at most 7 mmHg, shrinking each breath, nothing from the seventh breath on | Chrimes et al., *Anaesthesia* 2022;77:1395–415 ([PMC9804892](https://pmc.ncbi.nlm.nih.gov/articles/PMC9804892/)): usually no trace, but CO₂ can appear after mask ventilation; a tracheal trace must hold consistent or rising amplitude for at least seven breaths and peak more than 7.5 mmHg above baseline. Anderson & Breen 2000: the first reading is usually under 10 mmHg and falls each breath. The 0.7 step per breath is a choice |
| Rebreathing: the baseline rises to the inspired CO₂ (0–30 mmHg), shown as "Fi" | StatPearls NBK482169 (baseline fails to return to zero; causes); case reports with inspired CO₂ of 4 to 30 mmHg, EtCO₂ rising too: Lee et al., *Korean J Anesthesiol* 2013;65:337 (PMC3822027); Vasudevan et al., *J Anaesthesiol Clin Pharmacol* 2013;29:108 (PMC3590513). The sim does not raise EtCO₂ by itself |
| Inspired CO₂ alarm above 4 mmHg | Philips IntelliVue MX750/MX850 Instructions for Use and IntelliVue Configuration Guide Rel. G.0: "imCO2 High" factory default 4 mmHg. Whether that alarm is switched on by default was not clear from the manual. One manufacturer |
| Cardiogenic oscillations: ripples at the heart rate | Suarez-Sipmann et al., *J Clin Monit Comput* 2013;27:47 (PMID 22911273); *Indian J Anaesth* 2023;67:760 (PMC10488579). That they sit on the tail of a long expiration is from a vendor guide only (GE, *CO₂ Monitoring and Capnometry*) — a drawing choice |
| Leak: an early peak that sags | StatPearls NBK482169: a leak dilutes the sample, giving low values and a distorted trace. **No source describes one shape**; this one is a drawing choice, and the number is not lowered automatically |
| Bronchospasm "shark fin"; curare cleft | StatPearls NBK482169 (prolonged sloping upstroke and upsloping plateau); *Turk J Anaesthesiol Reanim* 2020;48:84 (PMC7001811) |
| Scale 0–50 mmHg, or 0–75 above 50 | Dräger Vamos operating instructions (0–50 default, 0–75); Philips IntelliVue (50 mmHg default). Switching between them automatically is a choice |

**Anesthesia machine**

| What the monitor does | Source |
| --- | --- |
| Default tidal volume 7 mL/kg predicted body weight; default PEEP 5 cmH₂O | Young et al., *Br J Anaesth* 2019;123:898–913 (PMID 31587835, abstract): initial tidal volume 6–8 mL/kg predicted body weight, PEEP 5. Hol et al., *Anesth Analg* 2020;131:1721 gives PEEP 0–5 |
| Predicted body weight: 50 (men) or 45.5 (women) + 0.91 × (height cm − 152.4) | ARDS Network, *NEJM* 2000;342:1301, as given in Sasko et al., *PLoS One* 2018;13:e0199917 ([PMC6025863](https://pmc.ncbi.nlm.nih.gov/articles/PMC6025863)) |
| Default peak 18 and plateau 16 cmH₂O; default FiO₂ 50% | LAS VEGAS investigators, *Eur J Anaesthesiol* 2017;34:492–507 ([PMC5502122](https://pmc.ncbi.nlm.nih.gov/articles/PMC5502122/)): medians in 9,864 surgical patients — peak 17.5, plateau 15.5, FiO₂ 0.52. FiO₂ guidance conflicts: WHO 2018 recommends 0.8; Hol 2020 recommends 0.21–0.4; 0.5 is common practice (Morkane et al., *Perioper Med* 2018;7:17). The default follows practice and is not advice |
| Peak with a normal plateau means resistance; both raised means reduced compliance | Mora Carpio & Mora, *Ventilator Management*, StatPearls ([NBK448186](https://www.ncbi.nlm.nih.gov/sites/books/NBK448186/)); Gertler, *Anesthesiol Clin* 2021;39:415 (PMC8360707). The sim does not compute either — these are the faculty guide's hints for which reading to move |
| Alarms: airway pressure above 40 or below 8 cmH₂O; minute volume under 3 or over 12 L/min; oxygen under 20% | Dräger Fabius GS premium Instructions for Use, SW 3.n (9038906, ed. 7) factory defaults. A Mindray A7 ships with 50/10, minute volume low 1 and oxygen low 18%. The real machine waits 15–30 s below the pressure threshold; the sim alarms at once |
| MAC at 40: sevoflurane 1.8%, isoflurane 1.17%, desflurane 6.6%; adjusted by 10^(−0.00269 × (age − 40)) | Mapleson, *Br J Anaesth* 1996;76:179–85 (PMID 8777094); Nickalls & Mapleson, *Br J Anaesth* 2003;91:170–4. For teaching: awareness trials alerted below 0.7 age-adjusted MAC (Avidan et al., *NEJM* 2008;358:1097 and 2011;365:591). The sim shows MAC and raises no alarm on it |
| Disconnection: no pressure, no tidal volume, no capnogram | Russell et al., *Anaesth Intensive Care* 1993;21:617 (the low-pressure alarm caught 37% of disconnections); Peng, Paulus & Gravenstein in *Capnography*, Cambridge University Press 2011 (capnography is the best monitor of a complete disconnection). The sim does not link these: set each |
| Oxygen supply failure: inspired oxygen falls, the low-oxygen alarm sounds, saturation follows | Mudumbai et al., *Anesth Analg* 2010;110:1292; Bohringer et al., AHRQ PSNet WebM&M 2024 |

**Alarm sounds**

| What the monitor does | Source |
| --- | --- |
| Critical: ten pulses of 120 ms as 3 + 2, 3 + 2 (spacing x = 80 ms, 2x + pulse before the fourth and ninth, 0.7 s between the fifth and sixth), repeating after 3 s. Warning: three pulses of 220 ms spaced 180 ms, repeating after 9 s. Fundamental under 1000 Hz with three further harmonics; rise 15% of the pulse | IEC 60601-1-8:2006 + Amd 1:2012, Tables 3–4, as reproduced in Texas Instruments application report [SLOA273](https://www.ti.com/lit/pdf/sloa273) (2019), with the x and y values from the IEC Amendment 1 text. The standard itself is paywalled; the table is a manufacturer's reproduction |
| Critical is pitched higher than warning | A choice. The standard separates priorities by rhythm and speed, not pitch (Edworthy, Forum Acusticum 2023) |

Only burst timing and spectrum follow the standard. Sound level, the rest of
the standard, and Amendment 2's auditory icons are not addressed: this is a
teaching simulator, not an alarm system.

## Adding scenarios to the curriculum

Pick the crisis from the catalog above first (it fixes the domain for
`topics[0]`, the crisis slug for `topics[1]`, and the id convention),
match the tier table, follow the authoring recipe in `CLAUDE.md`, keep the
field reference (`docs/scenario.schema.md`) at hand, and cite your
clinical sources in the PR description and — ideally — in this file.
