'use client';

import { useAuthStore } from '../cloud/authStore';
import { getSupabase, supabaseConfigured } from '../sync/supabase';
import { parseParsedDocument } from './schema';
import type { ImportDraft, ParsedDocument } from './types';

/**
 * Hosted import service — the counterpart of the managed LLM gateway for
 * run-sheet files. Pasted text is parsed in the app with no network; a
 * build that ships NEXT_PUBLIC_IMPORT_SERVICE_URL and Supabase sign-in lets
 * signed-in faculty upload DOCX/PDF files, which the service parses into
 * the same `ParsedDocument` shape and keeps as the audit trail of the
 * import. Unset ⇒ no file upload affordance, zero network calls.
 */

export function importServiceConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_IMPORT_SERVICE_URL && supabaseConfigured());
}

export function importServiceEligible(): boolean {
  return importServiceConfigured() && useAuthStore.getState().status === 'signed_in';
}

export const UPLOAD_ACCEPT =
  '.docx,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

export type UploadResult =
  | { ok: true; jobId: string; parsed: ParsedDocument }
  | { ok: true; jobId: string; parsed: null; needsManual: string }
  | { ok: false; error: string; chooseOrg?: { id: string; name: string }[] };

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_IMPORT_SERVICE_URL ?? '').replace(/\/+$/, '');
}

async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function authed(path: string, init: RequestInit): Promise<Response> {
  const token = await accessToken();
  if (!token) throw new Error('Sign in to your institution account to upload run sheets.');
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

export async function uploadRunSheet(file: File, orgId?: string): Promise<UploadResult> {
  const body = new FormData();
  body.append('file', file);
  if (orgId) body.append('org_id', orgId);
  let res: Response;
  try {
    res = await authed('/api/import/upload', { method: 'POST', body });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Upload failed.' };
  }
  const json = (await res.json().catch(() => ({}))) as {
    jobId?: string;
    parsed?: unknown;
    needsManual?: string;
    error?: string;
    orgs?: { id: string; name: string }[];
  };
  if (res.status === 409 && json.error === 'choose_org') {
    return { ok: false, error: 'Choose which program this run sheet belongs to.', chooseOrg: json.orgs ?? [] };
  }
  if (!res.ok || !json.jobId) {
    return { ok: false, error: json.error ?? `Upload failed (${res.status}).` };
  }
  if (!json.parsed) {
    return { ok: true, jobId: json.jobId, parsed: null, needsManual: json.needsManual ?? 'The file could not be parsed.' };
  }
  try {
    return { ok: true, jobId: json.jobId, parsed: parseParsedDocument(json.parsed) };
  } catch {
    return { ok: false, error: 'The import service returned an unexpected document shape.' };
  }
}

/** Best-effort: keep the hosted job's draft in step with the local one. */
export async function syncDraftToService(draft: ImportDraft): Promise<void> {
  if (!draft.jobId || !importServiceEligible()) return;
  try {
    await authed(`/api/import/${encodeURIComponent(draft.jobId)}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
  } catch {
    // Local draft is the source of truth; the hosted copy is an audit aid.
  }
}

export async function markJobFinalized(jobId: string, scenarioId: string): Promise<void> {
  if (!importServiceEligible()) return;
  try {
    await authed(`/api/import/${encodeURIComponent(jobId)}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId }),
    });
  } catch {
    // Same: best effort.
  }
}
