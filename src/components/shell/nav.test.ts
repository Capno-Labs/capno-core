import { describe, expect, it } from 'vitest';

import { MAIN_NAV, NAV, WORKSPACE_NAV, crumbFor, isNavActive } from './nav';

describe('navigation', () => {
  it('has one entry per route', () => {
    const hrefs = [...MAIN_NAV, ...WORKSPACE_NAV].map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('matches Home exactly and other items by prefix', () => {
    expect(isNavActive('/', NAV.home)).toBe(true);
    expect(isNavActive('/scenarios', NAV.home)).toBe(false);
    expect(isNavActive('/scenarios/import', NAV.library)).toBe(true);
    expect(isNavActive('/faculty/run/anaphylaxis', NAV.run)).toBe(true);
    expect(isNavActive('/debrief/abc', NAV.debriefs)).toBe(true);
    expect(isNavActive('/debriefing', NAV.debriefs)).toBe(false);
  });

  it('names every route in the breadcrumb', () => {
    expect(crumbFor('/')).toBe('Home');
    expect(crumbFor('/scenarios')).toBe('Case library');
    expect(crumbFor('/scenarios/import')).toBe('Import a run sheet');
    expect(crumbFor('/faculty/run/quick-start')).toBe('Live session');
    expect(crumbFor('/debrief')).toBe('Debriefs');
    expect(crumbFor('/debrief/abc')).toBe('Session report');
    expect(crumbFor('/somewhere-else')).toBe('Home');
  });
});
