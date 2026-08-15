/**
 * The deck, and its relationship to the replica.
 *
 * The deck is the authority and Supabase is the replica. Four arrays of rows,
 * the Unsent set, and the actions that change them — no maps, no indexes, no
 * sorted copies (ADR-0017). `persist` owns durability, and hydration gates the
 * pull (ADR-0016), so boot is: rehydrate → render → pull → replay.
 *
 * Upserts are protected and deletes are not (ADR-0014, ADR-0015). A failed
 * write marks its row Unsent, which keeps its local version through the next
 * pull; a failed delete leaves the row on the server and it comes back.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LogEntry, Position, Sequence, Skill } from '../domain/types';
import { RowError, type TableName } from '../data/mappers';
import * as repo from '../data/repo';
import type { Row } from '../data/repo';
import { seedDeck } from '../data/seed';
import { notify } from './useUi';

/**
 * Ordered so a replay writes Positions before the Skills that need them, and
 * Skills before the LogEntries that reference them. Replay needs no order of
 * its own; this is the foreign keys' order, and it is free.
 */
const TABLES: readonly TableName[] = ['positions', 'skills', 'logs', 'sequences'];

/** Which rows the deck holds that the replica does not, by id, keyed by table. */
export type Unsent = Record<TableName, string[]>;

export type SyncError =
  | { kind: 'transport'; message: string }
  | { kind: 'row'; table: TableName; id: string; detail: string };

const NOTHING_UNSENT: Unsent = { positions: [], skills: [], logs: [], sequences: [] };

const withUnsent = (unsent: Unsent, table: TableName, ids: string[]): Unsent => ({
  ...unsent,
  [table]: [...new Set([...unsent[table], ...ids])],
});

const withoutUnsent = (unsent: Unsent, table: TableName, ids: string[]): Unsent => ({
  ...unsent,
  [table]: unsent[table].filter((id) => !ids.includes(id)),
});

export const unsentCount = (unsent: Unsent): number =>
  TABLES.reduce((total, table) => total + unsent[table].length, 0);

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * An Unsent row keeps its local version, and an Unsent row the server has
 * never seen is added rather than dropped. Everything else comes from the
 * server — the pull is still a refill, not a merge.
 */
function reconcile<T extends { id: string }>(server: T[], local: T[], unsent: string[]): T[] {
  const kept = server.map((row) => {
    if (!unsent.includes(row.id)) return row;
    return local.find((l) => l.id === row.id) ?? row;
  });
  const neverSeen = local.filter(
    (row) => unsent.includes(row.id) && !server.some((s) => s.id === row.id),
  );
  return [...kept, ...neverSeen];
}

type DeckState = {
  positions: Position[];
  skills: Skill[];
  logs: LogEntry[];
  sequences: Sequence[];
  unsent: Unsent;
  /** Describes one attempt, not a state of the data, so it is not persisted. */
  syncError: SyncError | null;
  booting: boolean;

  boot: () => Promise<void>;
  pull: () => Promise<boolean>;
  replay: () => Promise<void>;

  savePosition: (position: Position) => Promise<void>;
  saveSkill: (skill: Skill) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  addLogEntry: (entry: LogEntry) => Promise<void>;
  deleteLogEntry: (id: string) => Promise<void>;
  saveSequence: (sequence: Sequence) => Promise<void>;
};

export const useDeck = create<DeckState>()(
  persist(
    (set, get) => {
      /** Every write goes through here, including the seed's. */
      const send = async <T extends TableName>(table: T, value: Row[T]): Promise<void> => {
        try {
          await repo.upsert(table, value);
          set((state) => ({ unsent: withoutUnsent(state.unsent, table, [value.id]) }));
        } catch (error) {
          set((state) => ({ unsent: withUnsent(state.unsent, table, [value.id]) }));
          notify(`Not saved to the server: ${message(error)}`);
        }
      };

      const sendMany = async <T extends TableName>(
        table: T,
        values: Row[T][],
      ): Promise<void> => {
        const ids = values.map((v) => v.id);
        try {
          await repo.upsertMany(table, values);
          set((state) => ({ unsent: withoutUnsent(state.unsent, table, ids) }));
        } catch (error) {
          set((state) => ({ unsent: withUnsent(state.unsent, table, ids) }));
          notify(`Not saved to the server: ${message(error)}`);
        }
      };

      const drop = async (table: TableName, id: string, what: string): Promise<void> => {
        try {
          await repo.remove(table, id);
        } catch {
          // Deletes are outside the Unsent contract on purpose (ADR-0015):
          // there is no row left to mark, so say so plainly instead.
          notify(`Couldn't delete ${what}. It may come back next time you open the app.`);
        }
      };

      return {
        positions: [],
        skills: [],
        logs: [],
        sequences: [],
        unsent: NOTHING_UNSENT,
        syncError: null,
        booting: false,

        boot: async () => {
          // Seeding is guarded by an empty deck, which two concurrent boots
          // both pass — and StrictMode runs effects twice in dev (ADR-0009).
          if (get().booting) return;
          set({ booting: true });
          try {
            const pulled = await get().pull();
            if (pulled && get().positions.length === 0) {
              const seeded = seedDeck();
              set({ positions: seeded.positions, skills: seeded.skills });
              await sendMany('positions', seeded.positions);
              await sendMany('skills', seeded.skills);
            }
            // Runs even when the pull failed: they fail together on a dead
            // network and a row that fails again simply stays Unsent.
            await get().replay();
          } finally {
            set({ booting: false });
          }
        },

        pull: async () => {
          try {
            const server = await repo.pull();
            set((state) => ({
              positions: reconcile(server.positions, state.positions, state.unsent.positions),
              skills: reconcile(server.skills, state.skills, state.unsent.skills),
              logs: reconcile(server.logs, state.logs, state.unsent.logs),
              sequences: reconcile(server.sequences, state.sequences, state.unsent.sequences),
              syncError: null,
            }));
            return true;
          } catch (error) {
            // A bad row is not bad wifi (ADR-0019).
            set({
              syncError:
                error instanceof RowError
                  ? { kind: 'row', table: error.table, id: error.id, detail: error.detail }
                  : { kind: 'transport', message: message(error) },
            });
            return false;
          }
        },

        replay: async () => {
          for (const table of TABLES) {
            for (const id of get().unsent[table]) {
              const rows = get()[table] as { id: string }[];
              const value = rows.find((row) => row.id === id);
              if (!value) {
                // The row was deleted after its write failed. Nothing to send.
                set((state) => ({ unsent: withoutUnsent(state.unsent, table, [id]) }));
                continue;
              }
              // It sends what the row says now, not what it said when the
              // write failed — which is what keeps this out of queue country.
              await send(table, value as Row[typeof table]);
            }
          }
        },

        savePosition: async (position) => {
          set((state) => ({
            positions: state.positions.some((p) => p.id === position.id)
              ? state.positions.map((p) => (p.id === position.id ? position : p))
              : [...state.positions, position],
          }));
          await send('positions', position);
        },

        saveSkill: async (skill) => {
          set((state) => ({
            skills: state.skills.some((s) => s.id === skill.id)
              ? state.skills.map((s) => (s.id === skill.id ? skill : s))
              : [...state.skills, skill],
          }));
          await send('skills', skill);
        },

        deleteSkill: async (id) => {
          const skill = get().skills.find((s) => s.id === id);
          if (!skill) return;

          // The client mirrors the database's cascade rather than discovering
          // it at the next boot (ADR-0018). One row is deleted, not two.
          const doomedLogs = get()
            .logs.filter((l) => l.skillId === id)
            .map((l) => l.id);

          set((state) => ({
            skills: state.skills.filter((s) => s.id !== id),
            logs: state.logs.filter((l) => l.skillId !== id),
            unsent: withoutUnsent(withoutUnsent(state.unsent, 'skills', [id]), 'logs', doomedLogs),
          }));
          await drop('skills', id, skill.name);
        },

        addLogEntry: async (entry) => {
          set((state) => ({ logs: [entry, ...state.logs] }));
          await send('logs', entry);
        },

        deleteLogEntry: async (id) => {
          set((state) => ({
            logs: state.logs.filter((l) => l.id !== id),
            unsent: withoutUnsent(state.unsent, 'logs', [id]),
          }));
          await drop('logs', id, 'that entry');
        },

        saveSequence: async (sequence) => {
          set((state) => ({
            sequences: state.sequences.some((q) => q.id === sequence.id)
              ? state.sequences.map((q) => (q.id === sequence.id ? sequence : q))
              : [...state.sequences, sequence],
          }));
          await send('sequences', sequence);
        },
      };
    },
    {
      name: 'trilha:deck',
      version: 1,
      partialize: ({ positions, skills, logs, sequences, unsent }) => ({
        positions,
        skills,
        logs,
        sequences,
        unsent,
      }),
    },
  ),
);
