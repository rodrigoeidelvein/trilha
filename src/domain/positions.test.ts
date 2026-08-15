import { describe, expect, test } from 'bun:test';
import type { Position } from './types';
import { collidingPosition, normalisePositionName } from './positions';

const position = (name: string, discipline: Position['discipline']): Position => ({
  id: name,
  name,
  aka: '',
  discipline,
});

describe('normalisePositionName', () => {
  test('lowercases and drops everything that is not a letter or digit', () => {
    expect(normalisePositionName('Hip Key')).toBe('hipkey');
    expect(normalisePositionName('hipkey')).toBe('hipkey');
    expect(normalisePositionName('hip-key')).toBe('hipkey');
    expect(normalisePositionName('HIP  KEY')).toBe('hipkey');
  });

  test('keeps digits, so 5-ball cascade stays distinct from 4-ball', () => {
    expect(normalisePositionName('5-ball cascade')).toBe('5ballcascade');
    expect(normalisePositionName('4 ball cascade')).toBe('4ballcascade');
  });

  test('a name with nothing alphanumeric in it normalises to empty', () => {
    expect(normalisePositionName('!!!')).toBe('');
  });
});

describe('collidingPosition', () => {
  const deck = [position('Hip Key', 'acro'), position('Star', 'juggling')];

  test('finds the Position a differently-spelled name would collide with', () => {
    expect(collidingPosition(deck, 'acro', 'hipkey')?.name).toBe('Hip Key');
  });

  test('does not collide across Disciplines', () => {
    expect(collidingPosition(deck, 'acro', 'star')).toBe(null);
  });

  test('ignores the Position being renamed', () => {
    expect(collidingPosition(deck, 'acro', 'hip key', 'Hip Key')).toBe(null);
  });

  test('is quiet about a name that is genuinely new', () => {
    expect(collidingPosition(deck, 'acro', 'Whale')).toBe(null);
  });
});
