import { z } from 'zod';
import type { Scenario } from './types';

/**
 * Zod schema mirroring the Scenario type. This is the single source of truth
 * for validating scenario files (bundled library, editor output, and imports).
 * A machine-readable JSON Schema for external tooling lives in
 * docs/scenario.schema.json and is generated from the same shape.
 */

const rhythmSchema = z.enum([
  'sinus',
  'sinus_brady',
  'sinus_tach',
  'pvc',
  'pac',
  'afib',
  'svt',
  'vtach',
  'vfib',
  'pea',
  'asystole',
]);

const capnoShapeSchema = z.enum(['normal', 'bronchospasm']);

const numericVitalsPartial = z
  .object({
    hr: z.number().min(0).max(300),
    sbp: z.number().min(0).max(300),
    dbp: z.number().min(0).max(200),
    spo2: z.number().min(0).max(100),
    etco2: z.number().min(0).max(150),
    rr: z.number().min(0).max(80),
    temp: z.number().min(25).max(45),
    depth: z.number().min(0).max(100),
    agentEt: z.number().min(0).max(10),
    agentFi: z.number().min(0).max(10),
  })
  .partial();

const vitalsSchema = numericVitalsPartial.required().extend({
  rhythm: rhythmSchema,
  capnoShape: capnoShapeSchema.optional(),
});

// Exported for standalone effect validation (event templates); shape is
// unchanged — the full document boundary remains scenarioSchema.
export const vitalEffectSchema = z.object({
  vitals: numericVitalsPartial.optional(),
  rhythm: rhythmSchema.optional(),
  capnoShape: capnoShapeSchema.optional(),
  overSec: z.number().min(0).optional(),
  afterSec: z.number().min(0).optional(),
});

const airwaySchema = z.object({
  mallampati: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  mouthOpeningCm: z.number().positive().optional(),
  thyromentalCm: z.number().positive().optional(),
  neckMobility: z.enum(['normal', 'limited', 'immobile']).optional(),
  dentition: z.string().optional(),
  notes: z.string().optional(),
});

const patientSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0).max(120),
  sex: z.enum(['male', 'female']),
  weightKg: z.number().positive(),
  heightCm: z.number().positive(),
  asa: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  allergies: z.array(z.string()),
  medications: z.array(z.string()),
  pmh: z.array(z.string()),
  airway: airwaySchema,
  plan: z.string().optional(),
});

const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'ids must be lowercase alphanumeric with - or _');

const eventSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  category: z.enum([
    'physiology',
    'airway',
    'circulation',
    'drug',
    'equipment',
    'surgical',
    'resolution',
    'other',
  ]),
  effects: z.array(vitalEffectSchema),
  autoAtSec: z.number().min(0).optional(),
  phaseHint: z.string().optional(),
  actionIds: z.array(z.string()).optional(),
});

const expectedActionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  phase: z.string().optional(),
  critical: z.boolean(),
  points: z.number().int().min(0),
});

export const scenarioSchema = z
  .object({
    id: idSchema,
    version: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    tags: z.object({
      topics: z.array(z.string()).min(1),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      trainingLevels: z
        .array(
          z.enum([
            'medical_student',
            'srna',
            'resident_junior',
            'resident_senior',
            'crna',
            'attending',
          ]),
        )
        .min(1),
    }),
    learningObjectives: z.array(z.string()).min(1),
    setup: z.array(z.string()),
    patient: patientSchema,
    baselineVitals: vitalsSchema,
    phases: z.array(z.object({ id: idSchema, label: z.string().min(1), description: z.string().optional() })).min(1),
    events: z.array(eventSchema),
    expectedActions: z.array(expectedActionSchema).min(1),
    expectedProgression: z.array(z.string()),
    correctManagement: z.array(z.string()),
    commonErrors: z.array(z.string()),
    debrief: z.object({
      points: z.array(z.string()),
      questions: z.array(z.string()),
    }),
    rubric: z.array(
      z.object({ id: idSchema, label: z.string().min(1), actionIds: z.array(z.string()) }),
    ),
    estimatedMinutes: z.number().positive(),
    monitoring: z
      .object({
        artLine: z.boolean().optional(),
        nibpIntervalSec: z.number().min(15).max(1800).optional(),
      })
      .optional(),
  })
  .superRefine((s, ctx) => {
    // Referential integrity: rubric action ids and action phases must exist.
    const actionIds = new Set(s.expectedActions.map((a) => a.id));
    const phaseIds = new Set(s.phases.map((p) => p.id));
    s.rubric.forEach((cat, ci) =>
      cat.actionIds.forEach((aid, ai) => {
        if (!actionIds.has(aid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rubric', ci, 'actionIds', ai],
            message: `rubric references unknown action "${aid}"`,
          });
        }
      }),
    );
    s.expectedActions.forEach((a, i) => {
      if (a.phase && !phaseIds.has(a.phase)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expectedActions', i, 'phase'],
          message: `action references unknown phase "${a.phase}"`,
        });
      }
    });
    const eventIds = new Set<string>();
    s.events.forEach((e, i) => {
      if (eventIds.has(e.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', i, 'id'],
          message: `duplicate event id "${e.id}"`,
        });
      }
      eventIds.add(e.id);
      (e.actionIds ?? []).forEach((aid, ai) => {
        if (!actionIds.has(aid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['events', i, 'actionIds', ai],
            message: `event references unknown action "${aid}"`,
          });
        }
      });
    });
  });

export type ScenarioInput = z.input<typeof scenarioSchema>;

/** Parse and validate an untrusted scenario object. Throws ZodError. */
export function parseScenario(data: unknown): Scenario {
  return scenarioSchema.parse(data) as Scenario;
}

/** Validate without throwing; returns a list of human-readable problems. */
export function validateScenario(data: unknown): { ok: boolean; errors: string[] } {
  const result = scenarioSchema.safeParse(data);
  if (result.success) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}
