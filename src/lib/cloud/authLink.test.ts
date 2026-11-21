import { describe, expect, it } from 'vitest';

import {
  cameFromPortal,
  hasAuthFragment,
  hasSessionFragment,
  parseAuthFragment,
} from './authLink';

const HASH = 'a'.repeat(56);

describe('parseAuthFragment', () => {
  it('reads a token hash, type and email from the fragment', () => {
    expect(
      parseAuthFragment(`#token_hash=${HASH}&type=magiclink&email=ana%40example.org`),
    ).toEqual({ tokenHash: HASH, type: 'magiclink', email: 'ana@example.org' });
  });

  it('accepts an email on its own (prefill only)', () => {
    expect(parseAuthFragment('#email=ana%40example.org')).toEqual({ email: 'ana@example.org' });
  });

  it('drops a token with a missing or unknown type', () => {
    expect(parseAuthFragment(`#token_hash=${HASH}`)).toEqual({});
    expect(parseAuthFragment(`#token_hash=${HASH}&type=recovery`)).toEqual({});
    expect(parseAuthFragment(`#token_hash=${HASH}&type=signup`)).toEqual({});
  });

  it('drops malformed tokens and emails', () => {
    for (const bad of ['short', 'has space in it here', `${HASH}<script>`, 'x'.repeat(129)]) {
      expect(
        parseAuthFragment(`#token_hash=${encodeURIComponent(bad)}&type=magiclink`).tokenHash,
      ).toBeUndefined();
    }
    expect(parseAuthFragment('#email=not-an-email').email).toBeUndefined();
    expect(parseAuthFragment('#email=a%20b%40example.org').email).toBeUndefined();
  });

  it('ignores the keys supabase-js handles itself', () => {
    expect(parseAuthFragment('#access_token=abc&refresh_token=def&type=magiclink')).toEqual({});
    expect(parseAuthFragment('#error=access_denied&error_description=x')).toEqual({});
    expect(parseAuthFragment('')).toEqual({});
  });
});

describe('hasAuthFragment', () => {
  it('is true only for fragments this module owns', () => {
    expect(hasAuthFragment(`#token_hash=${HASH}&type=magiclink`)).toBe(true);
    expect(hasAuthFragment('#email=ana%40example.org')).toBe(true);
    expect(hasAuthFragment('#access_token=abc')).toBe(false);
    expect(hasAuthFragment('#section-2')).toBe(false);
    expect(hasAuthFragment('')).toBe(false);
  });
});

describe('hasSessionFragment', () => {
  it('spots a ready-made session in the fragment', () => {
    expect(hasSessionFragment('#access_token=abc&refresh_token=def&type=invite')).toBe(true);
    expect(hasSessionFragment('#refresh_token=def')).toBe(true);
    expect(hasSessionFragment('access_token=abc')).toBe(true);
  });

  it('leaves this app\'s own links and ordinary anchors alone', () => {
    expect(hasSessionFragment(`#token_hash=${HASH}&type=magiclink&email=ana%40example.org`)).toBe(
      false,
    );
    expect(hasSessionFragment('#block-access_token')).toBe(false);
    expect(hasSessionFragment('#section-2')).toBe(false);
    expect(hasSessionFragment('')).toBe(false);
  });
});

describe('cameFromPortal', () => {
  const portal = 'https://start.example.org';

  it('is true only for a navigation from the configured portal origin', () => {
    expect(cameFromPortal('https://start.example.org/', portal)).toBe(true);
    expect(cameFromPortal('https://start.example.org/start?x=1', portal)).toBe(true);
  });

  it('is false for other origins, look-alikes, no referrer, or no portal', () => {
    for (const referrer of [
      '',
      'https://evil.example/',
      'https://start.example.org.evil.example/',
      'http://start.example.org/',
      'https://mail.example.org/',
      'not a url',
    ]) {
      expect(cameFromPortal(referrer, portal)).toBe(false);
    }
    expect(cameFromPortal('https://start.example.org/', null)).toBe(false);
  });
});
