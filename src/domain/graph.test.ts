import { describe, expect, test } from 'bun:test';
import type { Position, Skill } from './types';
import {
  analyseSequence,
  bridges,
  isolatedPositions,
  resolveSequence,
  skillsAt,
} from './graph';

const position = (id: string): Position => ({
  id,
  name: id,
  aka: '',
  discipline: 'acro',
});

const skill = (id: string, from: string, to: string): Skill => ({
  id,
  name: id,
  aka: '',
  discipline: 'acro',
  from,
  to,
  siteswap: '',
  propCount: null,
  status: 'want',
  notes: '',
});

/*  standing --stand2bird--> bird --roll--> rbird --unroll--> bird
 *  bird --spin--> bird  (a self-loop)
 *  whale is touched by nothing
 */
const standToBird = skill('stand2bird', 'standing', 'bird');
const roll = skill('roll', 'bird', 'rbird');
const unroll = skill('unroll', 'rbird', 'bird');
const spin = skill('spin', 'bird', 'bird');
const birdDown = skill('birdDown', 'bird', 'standing');

describe('resolveSequence', () => {
  test('resolves ids to Skills in the Sequence order', () => {
    const { skills, missing } = resolveSequence(
      ['roll', 'unroll'],
      [unroll, spin, roll],
    );

    expect(skills.map((s) => s.id)).toEqual(['roll', 'unroll']);
    expect(missing).toEqual([]);
  });

  test('reports a dangling id rather than silently closing the gap', () => {
    const { skills, missing } = resolveSequence(
      ['stand2bird', 'roll', 'birdDown'],
      [standToBird, birdDown],
    );

    // The prototype's `.filter(Boolean)` left [stand2bird, birdDown], which
    // analyses as a connected Sequence the user never built.
    expect(skills.map((s) => s.id)).toEqual(['stand2bird', 'birdDown']);
    expect(missing).toEqual(['roll']);
  });

  test('reports the same id twice when a Sequence uses it twice', () => {
    const { missing } = resolveSequence(['roll', 'roll'], []);
    expect(missing).toEqual(['roll', 'roll']);
  });
});

describe('analyseSequence', () => {
  test('an empty Sequence is vacuously connected and is not a Loop', () => {
    expect(analyseSequence([])).toEqual({
      joints: [],
      connected: true,
      loop: false,
      from: null,
      to: null,
    });
  });

  test('a lone self-loop is a Loop', () => {
    expect(analyseSequence([spin])).toEqual({
      joints: [],
      connected: true,
      loop: true,
      from: 'bird',
      to: 'bird',
    });
  });

  test('a lone Skill that goes somewhere else is not a Loop', () => {
    const { connected, loop } = analyseSequence([roll]);
    expect(connected).toBe(true);
    expect(loop).toBe(false);
  });

  test('a holding joint names the Position where the Skills meet', () => {
    const { joints, connected, from, to } = analyseSequence([roll, unroll]);

    expect(joints).toEqual([{ connected: true, at: 'rbird' }]);
    expect(connected).toBe(true);
    expect(from).toBe('bird');
    expect(to).toBe('bird');
  });

  test('a broken joint names the two Positions that failed to meet', () => {
    const { joints, connected } = analyseSequence([standToBird, unroll]);

    expect(joints).toEqual([
      { connected: false, lands: 'bird', departs: 'rbird' },
    ]);
    expect(connected).toBe(false);
  });

  test('returning to the start is not enough — a broken Sequence is no Loop', () => {
    // bird → rbird, then a break, then bird → standing … which happens to
    // start where it ends. The prototype called this a Washing machine.
    const broken = analyseSequence([standToBird, unroll, birdDown]);

    expect(broken.from).toBe('standing');
    expect(broken.to).toBe('standing');
    expect(broken.connected).toBe(false);
    expect(broken.loop).toBe(false);
  });

  test('connected and returning is a Loop', () => {
    const machine = analyseSequence([standToBird, roll, unroll, birdDown]);

    expect(machine.connected).toBe(true);
    expect(machine.loop).toBe(true);
  });
});

describe('bridges', () => {
  test('finds the Skills that join two Positions', () => {
    const found = bridges([standToBird, roll, unroll, spin], 'bird', 'rbird');
    expect(found.map((s) => s.id)).toEqual(['roll']);
  });

  test('a self-loop bridges a Position to itself', () => {
    const found = bridges([roll, spin], 'bird', 'bird');
    expect(found.map((s) => s.id)).toEqual(['spin']);
  });

  test('returns nothing when no Skill makes the join', () => {
    expect(bridges([roll, unroll], 'standing', 'rbird')).toEqual([]);
  });
});

describe('skillsAt', () => {
  test('counts a Skill touching the Position in either direction', () => {
    const found = skillsAt([standToBird, roll, unroll, birdDown], 'bird');
    expect(found.map((s) => s.id)).toEqual([
      'stand2bird',
      'roll',
      'unroll',
      'birdDown',
    ]);
  });

  test('counts a self-loop once, not twice', () => {
    expect(skillsAt([spin], 'bird')).toHaveLength(1);
  });
});

describe('isolatedPositions', () => {
  test('finds the Positions no Skill touches', () => {
    const positions = ['standing', 'bird', 'rbird', 'whale'].map(position);
    const isolated = isolatedPositions(positions, [standToBird, roll]);

    expect(isolated.map((p) => p.id)).toEqual(['whale']);
  });

  test('a self-loop is enough to attach a Position', () => {
    expect(isolatedPositions([position('bird')], [spin])).toEqual([]);
  });
});
