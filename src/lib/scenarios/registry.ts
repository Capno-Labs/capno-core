import { parseScenario } from '../engine/schema';
import type { Scenario } from '../engine/types';

import inductionHypotension from '@/scenarios/induction-hypotension.json';
import laryngospasmLma from '@/scenarios/laryngospasm-lma.json';
import anaphylaxis from '@/scenarios/anaphylaxis.json';
import malignantHyperthermia from '@/scenarios/malignant-hyperthermia.json';
import lastNerveBlock from '@/scenarios/last-nerve-block.json';
import bradycardiaAsystole from '@/scenarios/bradycardia-asystole.json';
import intraopBronchospasm from '@/scenarios/intraop-bronchospasm.json';
import difficultAirwayCico from '@/scenarios/difficult-airway-cico.json';
import postpartumHemorrhage from '@/scenarios/postpartum-hemorrhage.json';
import venousAirEmbolism from '@/scenarios/venous-air-embolism.json';

/**
 * Built-in scenario library. Files are statically imported so they ship in
 * the JS bundle — which is what makes scenarios available offline with zero
 * fetches. They are validated once at module load; a malformed bundled
 * scenario is a build-time authoring bug and should fail loudly.
 */
const RAW: unknown[] = [
  inductionHypotension,
  laryngospasmLma,
  anaphylaxis,
  malignantHyperthermia,
  lastNerveBlock,
  bradycardiaAsystole,
  intraopBronchospasm,
  difficultAirwayCico,
  postpartumHemorrhage,
  venousAirEmbolism,
];

export const BUILT_IN_SCENARIOS: Scenario[] = RAW.map((raw) => parseScenario(raw));

export function getBuiltInScenario(id: string): Scenario | undefined {
  return BUILT_IN_SCENARIOS.find((s) => s.id === id);
}
