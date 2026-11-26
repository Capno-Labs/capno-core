import { describe, expect, it } from 'vitest';
import { shortcutAllowed, shortcutBlock } from './shortcutGuard';

describe('shortcutBlock', () => {
  it('reserves nothing when nothing interactive has focus', () => {
    expect(shortcutBlock(null)).toBe('none');
    expect(shortcutBlock({ tagName: 'BODY' })).toBe('none');
    expect(shortcutBlock({ tagName: 'DIV' })).toBe('none');
  });

  it('blocks every key while typing', () => {
    expect(shortcutBlock({ tagName: 'TEXTAREA' })).toBe('all');
    expect(shortcutBlock({ tagName: 'SELECT' })).toBe('all');
    expect(shortcutBlock({ tagName: 'INPUT' })).toBe('all');
    expect(shortcutBlock({ tagName: 'INPUT', inputType: 'text' })).toBe('all');
    expect(shortcutBlock({ tagName: 'INPUT', inputType: 'number' })).toBe('all');
    expect(shortcutBlock({ tagName: 'INPUT', inputType: 'search' })).toBe('all');
    expect(shortcutBlock({ tagName: 'DIV', isContentEditable: true })).toBe('all');
  });

  it('blocks every key inside or behind a modal dialog', () => {
    expect(shortcutBlock({ tagName: 'BUTTON', inModal: true })).toBe('all');
    expect(shortcutBlock({ tagName: 'BODY', inModal: true })).toBe('all');
  });

  it('reserves only Space/Enter on things those keys operate', () => {
    expect(shortcutBlock({ tagName: 'BUTTON' })).toBe('activation');
    expect(shortcutBlock({ tagName: 'A' })).toBe('activation');
    expect(shortcutBlock({ tagName: 'SUMMARY' })).toBe('activation');
    expect(shortcutBlock({ tagName: 'INPUT', inputType: 'checkbox' })).toBe('activation');
    expect(shortcutBlock({ tagName: 'INPUT', inputType: 'radio' })).toBe('activation');
    // The monitor's vital tiles are div[role=button].
    expect(shortcutBlock({ tagName: 'DIV', role: 'button' })).toBe('activation');
  });

  it('a range slider reserves nothing — it keeps focus after a drag', () => {
    expect(shortcutBlock({ tagName: 'INPUT', inputType: 'range' })).toBe('none');
  });

  it('is case-insensitive about tag, type and role', () => {
    expect(shortcutBlock({ tagName: 'button' })).toBe('activation');
    expect(shortcutBlock({ tagName: 'input', inputType: 'RANGE' })).toBe('none');
    expect(shortcutBlock({ tagName: 'div', role: 'Button' })).toBe('activation');
  });
});

describe('shortcutAllowed', () => {
  it('letter shortcuts work with a button focused; Space and Enter do not', () => {
    const button = { tagName: 'BUTTON' };
    expect(shortcutAllowed('n', button)).toBe(true);
    expect(shortcutAllowed('/', button)).toBe(true);
    expect(shortcutAllowed(' ', button)).toBe(false);
    expect(shortcutAllowed('Enter', button)).toBe(false);
  });

  it('everything works from the page body or a slider', () => {
    for (const target of [null, { tagName: 'BODY' }, { tagName: 'INPUT', inputType: 'range' }]) {
      expect(shortcutAllowed(' ', target)).toBe(true);
      expect(shortcutAllowed('n', target)).toBe(true);
    }
  });

  it('nothing works while typing or with a modal open', () => {
    expect(shortcutAllowed('n', { tagName: 'INPUT' })).toBe(false);
    expect(shortcutAllowed('/', { tagName: 'TEXTAREA' })).toBe(false);
    expect(shortcutAllowed('n', { tagName: 'BUTTON', inModal: true })).toBe(false);
  });
});
