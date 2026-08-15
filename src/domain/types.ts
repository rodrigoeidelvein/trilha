/**
 * The domain, as plain data.
 *
 * Positions are nodes, Skills are edges, Sequences are paths, and a path that
 * returns to its starting Position is a Loop — a washing machine, in acro.
 *
 * Absence is `null`, emptiness is `''`, and nothing is optional (ADR-0001):
 * free text that is unset is the empty string, anything else that can be
 * genuinely absent is `| null`, and no property is ever declared with `?:`.
 * Every type therefore has exactly the same key set as its database row.
 */

export type Discipline = 'juggling' | 'acro';
export type Status = 'want' | 'working' | 'got';
export type Role = 'base' | 'flyer' | 'spotter';

export const DISCIPLINES: readonly Discipline[] = ['juggling', 'acro'];
export const STATUSES: readonly Status[] = ['want', 'working', 'got'];
export const ROLES: readonly Role[] = ['base', 'flyer', 'spotter'];

/** Ids are plain aliases, not branded — they are UUIDs generated client-side. */
export type PositionId = string;
export type SkillId = string;
export type LogEntryId = string;
export type SequenceId = string;

/** A state you can hold and be recognised in. */
export type Position = {
  id: PositionId;
  name: string;
  aka: string;
  discipline: Discipline;
};

/**
 * A directed edge between two Positions. Both endpoints are required: an edge
 * missing an endpoint is not a degenerate edge, it is not an edge (ADR-0003).
 * `from === to` is a self-loop and is ordinary data.
 */
export type Skill = {
  id: SkillId;
  name: string;
  aka: string;
  discipline: Discipline;
  from: PositionId;
  to: PositionId;
  siteswap: string;
  propCount: number | null;
  status: Status;
  notes: string;
};

/** An ordered list of Skills. Connectivity is derived, never stored. */
export type Sequence = {
  id: SequenceId;
  name: string;
  discipline: Discipline;
  skillIds: SkillId[];
};

type LogEntryBase = {
  id: LogEntryId;
  loggedOn: string;
  skillId: SkillId;
  note: string;
};

/** Juggling counts. */
export type JugglingLogEntry = LogEntryBase & {
  discipline: 'juggling';
  props: number | null;
  bestRun: number | null;
  drops: number | null;
};

/** Acro feels, and remembers who it was with. */
export type AcroLogEntry = LogEntryBase & {
  discipline: 'acro';
  role: Role | null;
  partner: string;
  felt: number | null;
};

/**
 * One attempt at one Skill on one day. A discriminated union over a flat table
 * (ADR-0002), so reading `entry.felt` on a juggling entry is a compile error
 * rather than a null.
 */
export type LogEntry = JugglingLogEntry | AcroLogEntry;
