import type { z } from 'zod';

/** Zod issues → user-facing `path: message` strings, capped for toasts/repair prompts. */
export function formatZodIssues(error: z.ZodError, limit = 10): string[] {
  return error.issues
    .slice(0, limit)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}
