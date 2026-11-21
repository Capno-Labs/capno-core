import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { THEME_COLORS } from './theme';

/**
 * Design-system guards. Tailwind compiles an unknown class to nothing, so a
 * stray `bg-amber` or a hard-coded hex fails silently in the browser — these
 * tests are the compiler for the palette rules in src/app/globals.css.
 */

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const rel = (path: string) => relative(SRC, path).split(sep).join('/');

function offenders(pattern: RegExp, skip: (file: string) => boolean = () => false): string[] {
  const hits: string[] = [];
  for (const path of sourceFiles(SRC)) {
    const file = rel(path);
    if (skip(file)) continue;
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${file}:${i + 1}`);
      });
  }
  return hits;
}

describe('palette rules', () => {
  it('uses no amber or blue utility classes (amber is the mark + EtCO2 only; UI accent is brand, caution is warn)', () => {
    // `amber` / `blue` carry no DEFAULT in tailwind.config.ts, so these
    // classes would render as nothing. vital-etco2 is the sanctioned amber.
    const retired =
      /(?:^|[\s"'`:])(?:bg|text|ring|border|accent|fill|stroke|outline|decoration|divide|from|via|to|shadow|caret)-(?:amber|blue)(?:-(?:strong|soft))?(?![\w-])/;
    expect(offenders(retired)).toEqual([]);
  });

  it('keeps arbitrary hex colours out of class names', () => {
    // The always-dark patient monitor owns its literal palette. The other
    // entries are known debt that the cleanup pass removes — this list only
    // ever shrinks.
    const allowed = new Set([
      'app/student/page.tsx',
      'components/eventCategories.ts',
      'components/controller/ActionMarkRow.tsx',
    ]);
    const hex = /-\[#[0-9a-fA-F]{3,8}\]/;
    expect(
      offenders(hex, (file) => file.startsWith('components/monitor/') || allowed.has(file)),
    ).toEqual([]);
  });
});

describe('theme-color', () => {
  const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');

  function surfaceHex(block: string): string {
    const triple = /--surface:\s*(\d+)\s+(\d+)\s+(\d+)/.exec(block);
    if (!triple) throw new Error('--surface not found');
    return `#${triple
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`;
  }

  it('matches --surface in both themes, so the browser chrome blends with the page', () => {
    // Match the rule openings, not the mentions in the header comment.
    const darkAt = css.indexOf('\n:root {');
    const lightAt = css.indexOf("\n[data-theme='light'] {");
    expect(darkAt).toBeGreaterThan(0);
    expect(lightAt).toBeGreaterThan(darkAt);
    expect(surfaceHex(css.slice(darkAt, lightAt))).toBe(THEME_COLORS.dark);
    expect(surfaceHex(css.slice(lightAt))).toBe(THEME_COLORS.light);
  });
});
