/**
 * Validate scenario JSON files against the canonical zod boundary — the
 * same `validateScenario` the editor and cloud pull use, so there is no
 * second schema to drift. Intended as the pre-upload gate for curated
 * library drops (and handy for any exported scenario file).
 *
 * Usage:  npm run validate-scenario -- path/to/scenario.json [more.json …]
 * Exit codes: 0 all valid · 1 any invalid/unreadable · 2 no files given.
 */
import { readFileSync } from 'node:fs';
import { validateScenario } from '../src/lib/engine/schema';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: npm run validate-scenario -- <scenario.json> [more.json …]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    failed = true;
    console.error(`✗ ${file}: ${(err as Error).message}`);
    continue;
  }
  const result = validateScenario(data);
  if (result.ok) {
    const { id, title } = data as { id?: string; title?: string };
    console.log(`✓ ${file} (${id ?? '?'} — ${title ?? '?'})`);
  } else {
    failed = true;
    console.error(`✗ ${file}:`);
    for (const message of result.errors) console.error(`    ${message}`);
  }
}

process.exit(failed ? 1 : 0);
