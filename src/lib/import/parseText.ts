import type { ParsedDocument, SourceBlock } from './types';
import { EXTRACTION_SCHEMA_VERSION } from './types';

/**
 * Pasted-text / Markdown → `ParsedDocument`. This is the offline parser:
 * it needs no dependencies and emits the same block shape as the hosted
 * DOCX/PDF service, so the section heuristics and the review UI never
 * know which path produced the blocks.
 *
 * Recognized structure:
 *   - `# Heading` … `###### Heading`          → heading (level = #-count)
 *   - a short ALL-CAPS line                   → heading level 2
 *     (playbooks exported from Word lose their heading styles when pasted)
 *   - `- item`, `* item`, `• item`, `1. item` → listItem
 *   - `| a | b |` rows (Markdown table)       → one table block per table
 *   - anything else, split on blank lines     → paragraph
 */

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const LIST_RE = /^(?:[-*•▪◦]|\d+[.)])\s+(.*)$/;
const TABLE_ROW_RE = /^\|(.*)\|\s*$/;
const TABLE_SEPARATOR_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const CHECKBOX_RE = /^[☐☑☒]\s+(.*)$/;

function isAllCapsHeading(line: string): boolean {
  if (line.length > 80) return false;
  const letters = line.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4) return false;
  if (/[a-z]/.test(line)) return false;
  // Table-ish or bullet lines are not headings.
  return !line.includes('|') && !LIST_RE.test(line);
}

function splitRow(row: string): string[] {
  return row.split('|').map((c) => c.trim());
}

/**
 * Text pasted from Word puts every paragraph on its own line with no blank
 * lines between them; Markdown/plain text separates paragraphs with blank
 * lines. Detect the former so consecutive lines are not glued together.
 */
function usesLinePerParagraph(lines: string[]): boolean {
  if (lines.length < 10) return false;
  const blank = lines.filter((l) => l.trim() === '').length;
  return blank / lines.length < 0.1;
}

export function parseText(text: string, title?: string): ParsedDocument {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const linePerParagraph = usesLinePerParagraph(lines);
  const blocks: SourceBlock[] = [];
  let paragraphBuf: string[] = [];
  let tableBuf: string[][] = [];

  const push = (block: Omit<SourceBlock, 'id' | 'paragraph'>) => {
    const n = blocks.length + 1;
    blocks.push({ id: `b${n}`, paragraph: n, ...block });
  };
  const flushParagraph = () => {
    if (paragraphBuf.length === 0) return;
    push({ kind: 'paragraph', text: paragraphBuf.join(' ').trim() });
    paragraphBuf = [];
  };
  const flushTable = () => {
    if (tableBuf.length === 0) return;
    const rows = tableBuf;
    push({
      kind: 'table',
      text: rows.map((r) => r.join(' | ')).join('\n'),
      tableCells: rows,
    });
    tableBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flushParagraph();
      flushTable();
      continue;
    }
    const tableRow = TABLE_ROW_RE.exec(line);
    if (tableRow) {
      flushParagraph();
      if (TABLE_SEPARATOR_RE.test(line)) continue;
      tableBuf.push(splitRow(tableRow[1]));
      continue;
    }
    flushTable();
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushParagraph();
      push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }
    const list = LIST_RE.exec(line) ?? CHECKBOX_RE.exec(line);
    if (list) {
      flushParagraph();
      push({ kind: 'listItem', text: list[1].trim() });
      continue;
    }
    if (isAllCapsHeading(line)) {
      flushParagraph();
      push({ kind: 'heading', level: 2, text: line });
      continue;
    }
    paragraphBuf.push(line);
    if (linePerParagraph) flushParagraph();
  }
  flushParagraph();
  flushTable();

  return {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    ...(title ? { title } : {}),
    blocks,
  };
}
