'use client';

import { useEffect } from 'react';
import type { ParsedDocument, SourceBlock } from '@/lib/import';

/**
 * Left column of the review: the parsed source, block by block, so every
 * draft field can be checked against the words it came from. The block a
 * field cites is ringed and scrolled into view when the field is selected.
 */
export function SourcePane({
  doc,
  activeBlockId,
  unmappedBlockIds,
  onSelectBlock,
}: {
  doc: ParsedDocument;
  activeBlockId: string | null;
  unmappedBlockIds: ReadonlySet<string>;
  onSelectBlock?: (id: string) => void;
}) {
  useEffect(() => {
    if (!activeBlockId) return;
    document
      .getElementById(`block-${activeBlockId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeBlockId]);

  return (
    <div className="space-y-1.5">
      {doc.blocks.map((b) => (
        <Block
          key={b.id}
          block={b}
          active={b.id === activeBlockId}
          unmapped={unmappedBlockIds.has(b.id)}
          onSelect={onSelectBlock}
        />
      ))}
    </div>
  );
}

function Block({
  block,
  active,
  unmapped,
  onSelect,
}: {
  block: SourceBlock;
  active: boolean;
  unmapped: boolean;
  onSelect?: (id: string) => void;
}) {
  const ring = active ? 'ring-2 ring-amber' : unmapped ? 'ring-1 ring-dashed ring-line-2' : '';
  const base = `rounded-ctl px-2 py-1 text-sm transition ${ring}`;
  const meta = (
    <span className="mr-2 inline-block w-8 shrink-0 font-mono text-[10px] text-faint" title={block.page ? `page ${block.page}` : undefined}>
      {block.id}
    </span>
  );
  const content =
    block.kind === 'table' && block.tableCells ? (
      <table className="w-full text-xs">
        <tbody>
          {block.tableCells.map((row, i) => (
            <tr key={i} className={i === 0 ? 'font-semibold text-ink' : 'border-t border-line text-ink-2'}>
              {row.map((cell, j) => (
                <td key={j} className="py-0.5 pr-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ) : block.kind === 'heading' ? (
      <span className={`font-bold text-ink ${block.level === 1 ? 'text-base' : ''}`}>{block.text}</span>
    ) : block.kind === 'listItem' ? (
      <span className="text-ink-2">• {block.text}</span>
    ) : (
      <span className="text-ink-2">{block.text}</span>
    );

  return (
    <div
      id={`block-${block.id}`}
      className={`${base} ${onSelect ? 'cursor-pointer hover:bg-panel-2' : ''}`}
      onClick={() => onSelect?.(block.id)}
      title={unmapped ? 'Not placed in the draft' : undefined}
    >
      <div className="flex items-start">
        {meta}
        <div className="min-w-0 flex-1">{content}</div>
      </div>
    </div>
  );
}
