import { DISPLAY_COPY } from '../displayCopy';

/**
 * Wording for the debrief walkthrough. The card order follows PEARLS —
 * Promoting Excellence and Reflective Learning in Simulation (Eppich W,
 * Cheng A. Simul Healthc 2015;10(2):106-115): setting the scene, reactions,
 * description, analysis, application/summary, with the analysis phase mixing
 * learner self-assessment, focused facilitation and direct teaching.
 *
 * Everything here is facilitation wording in our own words — no clinical
 * content (invariant 7). Clinical text on the cards comes only from the
 * scenario the faculty authored and the session log. Sources are listed in
 * docs/curriculum.md ("Debrief structure sources").
 */

export type DeckPhaseId = 'scene' | 'reactions' | 'description' | 'analysis' | 'summary';

/** The five phases, in order — the rail across the top of the walkthrough. */
export const DECK_PHASES: readonly { id: DeckPhaseId; label: string }[] = [
  { id: 'scene', label: 'Setting the scene' },
  { id: 'reactions', label: 'Reactions' },
  { id: 'description', label: 'Description' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'summary', label: 'Summary' },
];

export const DECK_COPY = {
  /** Invariant 8: the safety text stays on the debrief. */
  disclaimer: 'CAPNO Studio debrief · simulation only — not for clinical use, not a clinical record',
  attribution: 'Structure adapted from PEARLS (Eppich & Cheng, Simul Healthc 2015).',

  scene: {
    headline: DISPLAY_COPY.debriefScene,
    lines: [
      'A conversation about the case — for learning, not for grading.',
      'We assume everyone came to do good work and wants to get better.',
    ],
    steps: ['First reactions', 'What happened', 'What went well, what to change', 'Take-aways'],
    cue: 'Say how long you have and what the steps are. With a group you have debriefed before, keep this brief.',
  },
  reactions: {
    headline: DISPLAY_COPY.debriefReactions,
    prompts: ['Any other reactions?', 'What is at the top of your mind?'],
    cue: 'Let everyone speak. Note what the learners want to talk about and come back to it in Analysis. Hold the teaching for now.',
  },
  description: {
    headline: DISPLAY_COPY.debriefDescription,
    prompts: ['In a sentence or two, summarise the case.', 'What did you think was going on?'],
    cue: 'Aim for a shared picture of the main issues, not a replay. Correct facts only where it matters.',
  },
  timeline: {
    eyebrow: 'What the record shows',
    heading: 'Key moments',
    cue: 'Use this to settle the facts and their order, then move on.',
  },
  objectives: {
    eyebrow: 'The frame',
    heading: 'What this case set out to teach',
    cue: 'Use the objectives to choose where to spend the time.',
  },
  plusDelta: {
    plus: DISPLAY_COPY.debriefPlus,
    delta: DISPLAY_COPY.debriefDelta,
    why: '…and why?',
    cue: 'Start with the learners’ own view. Ask “why” after each answer to reach the reasoning behind it.',
  },
  doneWell: {
    eyebrow: 'Worth repeating',
    heading: 'Done well',
    cue: 'Name what made these work, so they happen again.',
  },
  gap: {
    eyebrow: 'Let’s look at',
    prompts: ['What were you seeing at this point?', 'What was going through your mind?'],
    cue: 'Say what you observed and why it matters to you, then ask with real curiosity. If the cause is a plain knowledge gap, teach it directly.',
  },
  otherGaps: {
    eyebrow: 'If time allows',
    heading: 'Also worth revisiting',
    cue: 'Pick the one or two that matter most for these learners.',
  },
  question: {
    eyebrow: 'Discuss',
    cue: 'Written for this case. Skip any the group has already covered.',
  },
  points: {
    eyebrow: 'Teaching points',
    heading: 'Key points',
    cue: 'Teach directly whatever the discussion has not already brought out.',
  },
  management: {
    eyebrow: 'Reference',
    heading: 'Correct management',
    cue: 'A reference to check the discussion against — not a list to read aloud.',
  },
  errors: {
    eyebrow: 'Reference',
    heading: 'Common errors',
    cue: 'Useful for normalising a mistake: others make it too.',
  },
  outstanding: {
    headline: DISPLAY_COPY.debriefOutstanding,
    prompts: ['Is there anything we have not talked about that you want to before we close?'],
    cue: 'Leave a real pause here before moving on.',
  },
  takeaways: {
    headline: DISPLAY_COPY.debriefTakeaways,
    prompts: ['One or two things you will use in practice.'],
    cue: 'Learners say them in their own words where time allows. Add your own only if something essential is missing.',
    notePrefix: 'Take-away: ',
  },
  end: {
    headline: DISPLAY_COPY.debriefEnd,
  },
} as const;
