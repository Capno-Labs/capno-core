'use client';

import { useRef } from 'react';
import { DOCUMENT_CHAR_LIMIT } from '@/lib/llm/generator';

/**
 * Paste-or-upload input for grounding documents (syllabus pages, lab
 * handouts). Plain text only — .txt/.md via FileReader, no parser deps;
 * PDF/Word users paste the text. The caller owns normalization/truncation
 * (prepareDocument) and passes the resulting text + truncated flag back in.
 */
export function DocumentInput({
  value,
  truncated,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  rows = 6,
  onFileName,
}: {
  value: string;
  truncated: boolean;
  onChange: (text: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  rows?: number;
  /** Called with the uploaded file's name (e.g. to default a title from it). */
  onFileName?: (name: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result));
      onFileName?.(file.name);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-1">
      <textarea
        className="input"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <button
          className="hover:text-slate-300"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
        >
          ⬆ Upload .txt / .md
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
            e.target.value = '';
          }}
        />
        <span>PDF or Word? Copy and paste the text instead.</span>
        {value.length > 0 && (
          <span>
            {value.length.toLocaleString()} / {DOCUMENT_CHAR_LIMIT.toLocaleString()} chars
          </span>
        )}
        {truncated && (
          <span className="text-amber-400/90">Document was truncated to fit the limit.</span>
        )}
      </div>
    </div>
  );
}
