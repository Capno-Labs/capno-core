'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  UPLOAD_ACCEPT,
  extractDrafts,
  importServiceEligible,
  parseText,
  saveImport,
  uploadRunSheet,
  type ParsedDocument,
} from '@/lib/import';
import { useAuthStore } from '@/lib/cloud/authStore';
import { toast } from '@/lib/store/toastStore';

/**
 * Entry point of the import: paste a run sheet (parsed on this device) or,
 * when the hosted import service is configured and the user is signed in,
 * upload the DOCX/PDF. Either way the next screen is the same review.
 */
export function ImportStart() {
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [orgChoices, setOrgChoices] = useState<{ id: string; name: string }[] | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [canUpload, setCanUpload] = useState(false);

  useEffect(() => setCanUpload(importServiceEligible()), [authStatus]);

  const start = (doc: ParsedDocument, sourceId: string, jobId?: string) => {
    const { drafts, profile } = extractDrafts(doc, { sourceId });
    const withJob = jobId ? drafts.map((d) => ({ ...d, jobId })) : drafts;
    const saved = saveImport({ sourceId, source: doc, drafts: withJob });
    if (!saved.ok) {
      toast(saved.error, 'error');
      return;
    }
    toast(
      `Found ${drafts.length} scenario${drafts.length === 1 ? '' : 's'} (${profile}) — review before use with learners`,
      'success',
    );
    router.push(`/scenarios/import?source=${encodeURIComponent(sourceId)}`);
  };

  const parsePaste = (raw: string, title?: string) => {
    const doc = parseText(raw, title);
    if (doc.blocks.length === 0) {
      toast('Nothing to import — paste the run sheet text first.', 'error');
      return;
    }
    start(doc, `paste-${Date.now().toString(36)}`);
  };

  const upload = async (file: File, orgId?: string) => {
    setBusy(true);
    const result = await uploadRunSheet(file, orgId);
    setBusy(false);
    if (!result.ok) {
      if (result.chooseOrg && result.chooseOrg.length > 0) {
        setOrgChoices(result.chooseOrg);
        setPendingFile(file);
        return;
      }
      toast(result.error, 'error');
      return;
    }
    setOrgChoices(null);
    setPendingFile(null);
    if (!result.parsed) {
      toast(result.needsManual, 'error');
      return;
    }
    start({ ...result.parsed, title: result.parsed.title ?? file.name }, result.jobId, result.jobId);
  };

  const onFile = (file: File) => {
    if (/\.(txt|md)$/i.test(file.name) || file.type.startsWith('text/')) {
      const reader = new FileReader();
      reader.onload = () => parsePaste(String(reader.result), file.name);
      reader.readAsText(file);
      return;
    }
    if (!canUpload) {
      toast('Sign in to your institution account to upload Word or PDF files, or paste the text.', 'error');
      return;
    }
    void upload(file);
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Bring your existing lab</h2>
      <p className="text-sm text-muted">
        Paste an instructor run sheet, or upload the file. Capno lifts the objectives, setup, phases,
        cues, rubric rows and debrief prompts it finds, shows each one next to the source text, and
        leaves anything the sheet does not say for you to fill in.
      </p>
      <textarea
        className="input"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the run sheet text here (Word: select all, copy, paste)…"
        aria-label="Run sheet text"
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => parsePaste(text)} disabled={busy || !text.trim()}>
          Review pasted text
        </button>
        <button className="btn-secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          ⬆ Upload {canUpload ? '.docx / .pdf / .txt' : '.txt / .md'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={canUpload ? UPLOAD_ACCEPT : '.txt,.md,text/plain,text/markdown'}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        {busy && <span className="text-xs text-muted">Uploading and parsing…</span>}
        {!canUpload && (
          <span className="text-xs text-faint">Word or PDF? Sign in to upload, or paste the text.</span>
        )}
      </div>
      {orgChoices && pendingFile && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Which program is this run sheet for?</span>
          {orgChoices.map((o) => (
            <button key={o.id} className="btn-secondary" onClick={() => void upload(pendingFile, o.id)}>
              {o.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
