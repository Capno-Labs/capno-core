import { describe, expect, it } from 'vitest';
import { formatTime, moveItem, parseNumber, parseTime, rangeProblem } from './formFields';

describe('parseTime / formatTime', () => {
  it('reads seconds, m:ss and h:mm:ss', () => {
    expect(parseTime('90')).toBe(90);
    expect(parseTime('1:30')).toBe(90);
    expect(parseTime(' 2:05 ')).toBe(125);
    expect(parseTime('0:00')).toBe(0);
    expect(parseTime('75:00')).toBe(4500);
    expect(parseTime('1:02:03')).toBe(3723);
  });

  it('rejects what is not a time', () => {
    for (const bad of ['', 'soon', '1:75', '-5', '1:2:3:4', '1:60:00', '1.5']) {
      expect(parseTime(bad)).toBeNull();
    }
  });

  it('round-trips', () => {
    for (const sec of [0, 5, 59, 60, 90, 600, 3599, 3600, 3723]) {
      expect(parseTime(formatTime(sec))).toBe(sec);
    }
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(3723)).toBe('1:02:03');
  });
});

describe('parseNumber', () => {
  it('reads integers, decimals and a decimal comma', () => {
    expect(parseNumber('72')).toBe(72);
    expect(parseNumber(' 36.6 ')).toBe(36.6);
    expect(parseNumber('36,6')).toBe(36.6);
    expect(parseNumber('-1.5')).toBe(-1.5);
    expect(parseNumber('3.')).toBe(3);
  });

  it('returns null for empty or non-numeric text', () => {
    for (const bad of ['', ' ', 'abc', '1e3', '--2', '.', '1.2.3']) {
      expect(parseNumber(bad)).toBeNull();
    }
  });
});

describe('rangeProblem', () => {
  it('accepts values inside the range, ends included', () => {
    expect(rangeProblem(0, { min: 0, max: 220 })).toBeNull();
    expect(rangeProblem(220, { min: 0, max: 220 })).toBeNull();
  });

  it('names the range in plain words', () => {
    expect(rangeProblem(1200, { min: 0, max: 220, unit: 'bpm' })).toBe(
      'Use a value from 0 to 220 bpm.',
    );
    expect(rangeProblem(-1, { min: 0 })).toBe('Use 0 or more.');
    expect(rangeProblem(9, { max: 4 })).toBe('Use 4 or less.');
    expect(rangeProblem(2.5, { integer: true })).toBe('Use a whole number.');
  });
});

describe('moveItem', () => {
  it('moves without mutating', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 2, 1)).toEqual(['a', 'c', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('ignores moves off either end', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });
});
