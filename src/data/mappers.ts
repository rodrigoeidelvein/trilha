/**
 * snake_case row <-> camelCase domain. The only place mapping happens.
 *
 * If `from_position` or `acro_role` appears anywhere else in `src/`, that is a
 * bug. Both directions are total field copies (ADR-0001) — no conditional key
 * construction — which is what makes it cheap to see, by reading this file
 * alone, that no column was forgotten.
 *
 * The one asymmetry is `logs`. The table permits an acro row with `best_run`
 * set; `LogEntry` does not (ADR-0002), so reading switches on the discipline
 * and discards the off-discipline columns. A row the domain says cannot exist
 * — a discipline, status or role outside its CHECK constraint — throws a
 * `RowError`, which is a bug in the data and not bad wifi (ADR-0019).
 */

import type { Tables, TablesInsert } from './db.types';
import type {
  Discipline,
  LogEntry,
  Position,
  Role,
  Sequence,
  Skill,
  Status,
} from '../domain/types';
import { DISCIPLINES, ROLES, STATUSES } from '../domain/types';

export type TableName = 'positions' | 'skills' | 'logs' | 'sequences';

/** A row the domain says cannot exist. Named so the UI can say which one. */
export class RowError extends Error {
  constructor(
    readonly table: TableName,
    readonly id: string,
    readonly detail: string,
  ) {
    super(`${table} row ${id}: ${detail}`);
    this.name = 'RowError';
  }
}

function oneOf<T extends string>(
  allowed: readonly T[],
  table: TableName,
  id: string,
  column: string,
  value: string,
): T {
  const found = allowed.find((a) => a === value);
  if (!found) {
    throw new RowError(table, id, `${column} is "${value}", not one of ${allowed.join(', ')}`);
  }
  return found;
}

/* ---------- reading ---------- */

export function positionFromRow(row: Tables<'positions'>): Position {
  return {
    id: row.id,
    name: row.name,
    aka: row.aka,
    discipline: oneOf<Discipline>(DISCIPLINES, 'positions', row.id, 'discipline', row.discipline),
  };
}

export function skillFromRow(row: Tables<'skills'>): Skill {
  return {
    id: row.id,
    name: row.name,
    aka: row.aka,
    discipline: oneOf<Discipline>(DISCIPLINES, 'skills', row.id, 'discipline', row.discipline),
    from: row.from_position,
    to: row.to_position,
    siteswap: row.siteswap,
    propCount: row.prop_count,
    status: oneOf<Status>(STATUSES, 'skills', row.id, 'status', row.status),
    notes: row.notes,
  };
}

export function sequenceFromRow(row: Tables<'sequences'>): Sequence {
  return {
    id: row.id,
    name: row.name,
    discipline: oneOf<Discipline>(DISCIPLINES, 'sequences', row.id, 'discipline', row.discipline),
    skillIds: row.skill_ids,
  };
}

export function logEntryFromRow(row: Tables<'logs'>): LogEntry {
  const discipline = oneOf<Discipline>(DISCIPLINES, 'logs', row.id, 'discipline', row.discipline);
  const base = {
    id: row.id,
    loggedOn: row.logged_on,
    skillId: row.skill_id,
    note: row.note,
  };

  if (discipline === 'juggling') {
    return {
      ...base,
      discipline,
      props: row.props,
      bestRun: row.best_run,
      drops: row.drops,
    };
  }

  return {
    ...base,
    discipline,
    role:
      row.acro_role === null
        ? null
        : oneOf<Role>(ROLES, 'logs', row.id, 'acro_role', row.acro_role),
    partner: row.partner ?? '',
    felt: row.felt,
  };
}

/* ---------- writing ---------- */

/**
 * `user_id` is deliberately absent from every insert: the column defaults to
 * `auth.uid()` and RLS's WITH CHECK guarantees it, so the domain never carries
 * it (ADR-0009).
 */

export function positionToRow(position: Position): TablesInsert<'positions'> {
  return {
    id: position.id,
    name: position.name,
    aka: position.aka,
    discipline: position.discipline,
  };
}

export function skillToRow(skill: Skill): TablesInsert<'skills'> {
  return {
    id: skill.id,
    name: skill.name,
    aka: skill.aka,
    discipline: skill.discipline,
    from_position: skill.from,
    to_position: skill.to,
    siteswap: skill.siteswap,
    prop_count: skill.propCount,
    status: skill.status,
    notes: skill.notes,
  };
}

export function sequenceToRow(sequence: Sequence): TablesInsert<'sequences'> {
  return {
    id: sequence.id,
    name: sequence.name,
    discipline: sequence.discipline,
    skill_ids: sequence.skillIds,
  };
}

export function logEntryToRow(entry: LogEntry): TablesInsert<'logs'> {
  const base = {
    id: entry.id,
    logged_on: entry.loggedOn,
    skill_id: entry.skillId,
    discipline: entry.discipline,
    note: entry.note,
  };

  if (entry.discipline === 'juggling') {
    return {
      ...base,
      props: entry.props,
      best_run: entry.bestRun,
      drops: entry.drops,
      acro_role: null,
      partner: null,
      felt: null,
    };
  }

  return {
    ...base,
    props: null,
    best_run: null,
    drops: null,
    acro_role: entry.role,
    partner: entry.partner === '' ? null : entry.partner,
    felt: entry.felt,
  };
}
