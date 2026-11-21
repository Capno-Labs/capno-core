import { describe, expect, it } from 'vitest';

import { accountPortalOrigin, accountPortalUrl, passwordResetUrl } from './accountPortal';

describe('account portal links', () => {
  it('render nothing when unconfigured', () => {
    expect(accountPortalOrigin(undefined)).toBeNull();
    expect(accountPortalUrl('/invites', '')).toBeNull();
    expect(passwordResetUrl(undefined)).toBeNull();
  });

  it('reduce the portal URL to its origin', () => {
    expect(accountPortalOrigin('https://start.example.org/some/path?x=1')).toBe(
      'https://start.example.org',
    );
    expect(accountPortalUrl('/invites', 'https://start.example.org/')).toBe(
      'https://start.example.org/invites',
    );
  });

  it('keep the full reset URL', () => {
    expect(passwordResetUrl('https://start.example.org/reset')).toBe(
      'https://start.example.org/reset',
    );
  });

  it('ignore anything that is not https (http only on localhost)', () => {
    for (const bad of ['javascript:alert(1)', 'http://start.example.org', '/reset', 'not a url']) {
      expect(accountPortalOrigin(bad)).toBeNull();
      expect(passwordResetUrl(bad)).toBeNull();
    }
    expect(accountPortalOrigin('http://localhost:3005')).toBe('http://localhost:3005');
  });
});
