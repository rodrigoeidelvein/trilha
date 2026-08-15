/**
 * Sorting, filtering and lookup, derived (ADR-0017).
 *
 * Plain functions over rows: no store, no React, callable from a `useMemo`.
 * They do not live in `src/domain` because they know about Discipline, and
 * ADR-0005 keeps Discipline out of the graph module on purpose. They are not
 * Zustand selectors either — a selector returning `filter(…)` builds a new
 * array on every call, which Zustand v5 reports as an unstable snapshot.
 */

import type { Discipline, LogEntry, Position, Skill } from '../domain/types';

export const ofDiscipline = <T extends { discipline: Discipline }>(
  rows: T[],
  discipline: Discipline,
): T[] => rows.filter((row) => row.discipline === discipline);

export const positionName = (positions: Position[], id: string): string =>
  positions.find((p) => p.id === id)?.name ?? '—';

export const findSkill = (skills: Skill[], id: string): Skill | null =>
  skills.find((s) => s.id === id) ?? null;

/** Newest first, ties broken by id so the order is stable across reloads. */
export const byNewest = (logs: LogEntry[]): LogEntry[] =>
  [...logs].sort((a, b) => (b.loggedOn + b.id).localeCompare(a.loggedOn + a.id));

export const byName = <T extends { name: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name));

/** Every partner the user has ever logged an attempt with. */
export const partners = (logs: LogEntry[]): string[] => [
  ...new Set(
    logs.flatMap((l) => (l.discipline === 'acro' && l.partner !== '' ? [l.partner] : [])),
  ),
];
