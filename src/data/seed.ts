/**
 * First-run content, so the app is useful before you type anything.
 *
 * Ids are minted here rather than by the database, so the seeded deck is the
 * same locally and remotely without a round trip. The caller seeds only into
 * an empty deck, and the database's unique index on the normalised Position
 * name is the backstop that stops a second seed doubling the deck (ADR-0023).
 */

import type { Position, Skill } from '../domain/types';

type PositionSeed = { key: string; name: string; discipline: Position['discipline']; aka?: string };
type SkillSeed = Omit<Skill, 'id' | 'from' | 'to'> & { from: string; to: string };

const POSITIONS: PositionSeed[] = [
  { key: 'j_rest', name: 'Hands empty', discipline: 'juggling' },
  { key: 'j_casc', name: 'Cascade', discipline: 'juggling', aka: '3-ball cascade' },
  { key: 'j_rev', name: 'Reverse cascade', discipline: 'juggling', aka: 'outside throws' },
  { key: 'j_show', name: 'Shower', discipline: 'juggling' },
  { key: 'j_box', name: 'Box', discipline: 'juggling' },
  { key: 'j_mills', name: 'Mills Mess', discipline: 'juggling' },
  { key: 'j_fount', name: 'Fountain', discipline: 'juggling', aka: '4-ball fountain' },
  { key: 'j_casc5', name: '5-ball cascade', discipline: 'juggling' },
  { key: 'a_stand', name: 'Standing', discipline: 'acro', aka: 'ground' },
  { key: 'a_s2s', name: 'Shin to shin', discipline: 'acro' },
  { key: 'a_bird', name: 'Bird', discipline: 'acro', aka: 'front bird' },
  { key: 'a_rbird', name: 'Reverse bird', discipline: 'acro', aka: 'back bird' },
  { key: 'a_throne', name: 'Throne', discipline: 'acro' },
  { key: 'a_whale', name: 'Whale', discipline: 'acro' },
  { key: 'a_star', name: 'Star', discipline: 'acro' },
  { key: 'a_f2h', name: 'Foot to hand', discipline: 'acro', aka: 'F2H' },
  { key: 'a_leaf', name: 'Folded leaf', discipline: 'acro' },
];

const skill = (
  s: Partial<SkillSeed> & Pick<SkillSeed, 'name' | 'discipline' | 'from' | 'to'>,
): SkillSeed => ({
  aka: '',
  siteswap: '',
  propCount: null,
  status: 'want',
  notes: '',
  ...s,
});

const SKILLS: SkillSeed[] = [
  /* juggling */
  skill({ name: 'Cascade', discipline: 'juggling', from: 'j_rest', to: 'j_casc', siteswap: '3', propCount: 3, status: 'got', notes: 'The ground state. Everything below enters and exits from here.' }),
  skill({ name: 'Reverse cascade', discipline: 'juggling', from: 'j_casc', to: 'j_rev', siteswap: '3', propCount: 3, status: 'got', notes: 'Throws go over the top instead of under.' }),
  skill({ name: 'Back to cascade', discipline: 'juggling', from: 'j_rev', to: 'j_casc', siteswap: '3', propCount: 3, status: 'got' }),
  skill({ name: '441', discipline: 'juggling', from: 'j_casc', to: 'j_casc', siteswap: '441', propCount: 3, status: 'working', notes: 'Ground state, so it drops straight in and out of cascade. Two columns and a cross.' }),
  skill({ name: '531', discipline: 'juggling', from: 'j_casc', to: 'j_casc', siteswap: '531', propCount: 3, status: 'working', notes: 'The 1 is a fast hand-across. Feels like a shower that resolves.' }),
  skill({ name: '423', discipline: 'juggling', from: 'j_casc', to: 'j_casc', siteswap: '423', propCount: 3, notes: 'One ball just sits in the hand on the 2. Good entry to columns work.' }),
  skill({ name: 'Into shower', discipline: 'juggling', from: 'j_casc', to: 'j_show', siteswap: '51', propCount: 3, status: 'working' }),
  skill({ name: 'Out of shower', discipline: 'juggling', from: 'j_show', to: 'j_casc', siteswap: '51', propCount: 3, status: 'working' }),
  skill({ name: 'Box', discipline: 'juggling', from: 'j_casc', to: 'j_box', siteswap: '(4,2x)(2x,4)', propCount: 3, notes: 'Synchronous. The 2x is the ball passing horizontally under.' }),
  skill({ name: 'Out of box', discipline: 'juggling', from: 'j_box', to: 'j_casc', siteswap: '(4,2x)(2x,4)', propCount: 3 }),
  skill({ name: 'Mills Mess', discipline: 'juggling', from: 'j_casc', to: 'j_mills', siteswap: '3', propCount: 3, notes: 'Siteswap is still 3 — all the difficulty is in the arm crossing, not the throws.' }),
  skill({ name: 'Unwind to cascade', discipline: 'juggling', from: 'j_mills', to: 'j_casc', siteswap: '3', propCount: 3 }),
  skill({ name: '55500', discipline: 'juggling', from: 'j_casc', to: 'j_casc', siteswap: '55500', propCount: 3, notes: '3-ball flash. The gateway drill for 5.' }),
  skill({ name: 'Fountain', discipline: 'juggling', from: 'j_rest', to: 'j_fount', siteswap: '4', propCount: 4, status: 'working', notes: 'Hands stay independent — it is two 2-ball columns, not a cascade.' }),
  skill({ name: '534', discipline: 'juggling', from: 'j_fount', to: 'j_fount', siteswap: '534', propCount: 4 }),
  skill({ name: '5-ball cascade', discipline: 'juggling', from: 'j_rest', to: 'j_casc5', siteswap: '5', propCount: 5 }),
  skill({ name: '97531', discipline: 'juggling', from: 'j_casc5', to: 'j_casc5', siteswap: '97531', propCount: 5 }),
  /* acro */
  skill({ name: 'Shin to shin', discipline: 'acro', from: 'a_stand', to: 'a_s2s', status: 'got', notes: 'Base shins vertical, flyer shins across. The warm-up entry to almost everything.' }),
  skill({ name: 'Shin to shin to bird', discipline: 'acro', from: 'a_s2s', to: 'a_bird', status: 'got', notes: 'Flyer leans in, base receives on the feet. Hands stay connected until the balance sets.' }),
  skill({ name: 'Pop to bird', discipline: 'acro', from: 'a_stand', to: 'a_bird', status: 'got' }),
  skill({ name: 'Bird down', discipline: 'acro', from: 'a_bird', to: 'a_stand', status: 'got' }),
  skill({ name: 'Barrel roll', discipline: 'acro', from: 'a_bird', to: 'a_rbird', status: 'working', notes: 'Flyer rotates over one side. Base tracks with the feet — do not chase with the hands.' }),
  skill({ name: 'Reverse barrel roll', discipline: 'acro', from: 'a_rbird', to: 'a_bird', status: 'working', notes: 'Close the loop and you have a washing machine.' }),
  skill({ name: 'Bird to throne', discipline: 'acro', from: 'a_bird', to: 'a_throne', status: 'working' }),
  skill({ name: 'Throne to bird', discipline: 'acro', from: 'a_throne', to: 'a_bird' }),
  skill({ name: 'Throne to whale', discipline: 'acro', from: 'a_throne', to: 'a_whale' }),
  skill({ name: 'Whale to folded leaf', discipline: 'acro', from: 'a_whale', to: 'a_leaf' }),
  skill({ name: 'Folded leaf down', discipline: 'acro', from: 'a_leaf', to: 'a_stand' }),
  skill({ name: 'Throne to star', discipline: 'acro', from: 'a_throne', to: 'a_star', notes: 'Side star. Needs a spot the first few times.' }),
  skill({ name: 'Star to throne', discipline: 'acro', from: 'a_star', to: 'a_throne' }),
  skill({ name: 'Bird to foot to hand', discipline: 'acro', from: 'a_bird', to: 'a_f2h', notes: 'Straight arms, stacked joints. Spot at the hips.' }),
  skill({ name: 'Foot to hand down', discipline: 'acro', from: 'a_f2h', to: 'a_stand' }),
];

export function seedDeck(): { positions: Position[]; skills: Skill[] } {
  const ids = new Map(POSITIONS.map((p) => [p.key, crypto.randomUUID()]));
  const id = (key: string): string => {
    const found = ids.get(key);
    if (!found) throw new Error(`seed references unknown position ${key}`);
    return found;
  };

  return {
    positions: POSITIONS.map((p) => ({
      id: id(p.key),
      name: p.name,
      aka: p.aka ?? '',
      discipline: p.discipline,
    })),
    skills: SKILLS.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      from: id(s.from),
      to: id(s.to),
    })),
  };
}
