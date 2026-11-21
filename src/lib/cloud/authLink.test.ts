import { describe, expect, it } from 'vitest';

import { hasAuthFragment, parseAuthFragment } from './authLink';

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
