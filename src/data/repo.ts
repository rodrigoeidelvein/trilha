/**
 * CRUD and the full pull. Everything that talks to Postgres.
 *
 * Failures are thrown, never returned — the store decides what a failure
 * means. Two kinds escape `pull()`, and telling them apart is the point
 * (ADR-0019): anything from the fetch is transport, and a `RowError` from the
 * mapping is a row the domain says cannot exist.
 */

import { supabase } from './supabase';
import type { LogEntry, Position, Sequence, Skill } from '../domain/types';
import type { TableName } from './mappers';
import {
  logEntryFromRow,
  logEntryToRow,
  positionFromRow,
  positionToRow,
  sequenceFromRow,
  sequenceToRow,
  skillFromRow,
  skillToRow,
} from './mappers';

export type Deck = {
  positions: Position[];
  skills: Skill[];
  logs: LogEntry[];
  sequences: Sequence[];
};

/** What each table holds, in domain terms. */
export type Row = {
  positions: Position;
  skills: Skill;
  logs: LogEntry;
  sequences: Sequence;
};

function toRow<T extends TableName>(table: T, value: Row[T]): object {
  switch (table) {
    case 'positions':
      return positionToRow(value as Position);
    case 'skills':
      return skillToRow(value as Skill);
    case 'logs':
      return logEntryToRow(value as LogEntry);
    case 'sequences':
      return sequenceToRow(value as Sequence);
  }
  throw new Error(`unknown table ${table}`);
}

/**
 * Fetches the whole deck.
 *
 * No sort: the deck holds rows in whatever order the server returned, and the
 * views sort what they want to see (ADR-0017).
 */
export async function pull(): Promise<Deck> {
  const [positions, skills, logs, sequences] = await Promise.all([
    supabase.from('positions').select('*'),
    supabase.from('skills').select('*'),
    supabase.from('logs').select('*'),
    supabase.from('sequences').select('*'),
  ]);

  for (const result of [positions, skills, logs, sequences]) {
    if (result.error) throw new Error(result.error.message);
  }

  // Mapping is outside everything the network can fail at, on purpose.
  return {
    positions: (positions.data ?? []).map(positionFromRow),
    skills: (skills.data ?? []).map(skillFromRow),
    logs: (logs.data ?? []).map(logEntryFromRow),
    sequences: (sequences.data ?? []).map(sequenceFromRow),
  };
}

/**
 * Ids are UUIDs generated client-side, so every write is an upsert against a
 * key that already exists — which is what makes a replay idempotent without
 * any ordering at all (ADR-0014).
 */
export async function upsert<T extends TableName>(table: T, value: Row[T]): Promise<void> {
  // One cast, at the one seam where a union of table names meets postgrest's
  // per-table row types.
  const { error } = await supabase.from(table).upsert(toRow(table, value) as never);
  if (error) throw new Error(error.message);
}

export async function upsertMany<T extends TableName>(table: T, values: Row[T][]): Promise<void> {
  if (values.length === 0) return;
  const rows = values.map((value) => toRow(table, value));
  const { error } = await supabase.from(table).upsert(rows as never);
  if (error) throw new Error(error.message);
}

export async function remove(table: TableName, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
