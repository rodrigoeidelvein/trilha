/**
 * A Position name is unique after aggressive normalisation (ADR-0023).
 *
 * The database enforces this with a unique index over
 * `regexp_replace(lower(name), '[^a-z0-9]', '', 'g')`, scoped to
 * `(user_id, discipline)`. This is the exact JavaScript mirror of that
 * expression, so the app can warn before the insert instead of letting a
 * `23505` arrive from the network — where it would look like a sync failure
 * and sit Unsent forever, because replaying it can never succeed.
 */

import type { Discipline, Position } from './types';

export function normalisePositionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The existing Position a proposed name would collide with, or `null`.
 *
 * `exceptId` is the Position being renamed, which cannot collide with itself.
 */
export function collidingPosition(
  positions: Position[],
  discipline: Discipline,
  name: string,
  exceptId: string | null = null,
): Position | null {
  const normalised = normalisePositionName(name);

  return (
    positions.find(
      (p) =>
        p.id !== exceptId &&
        p.discipline === discipline &&
        normalisePositionName(p.name) === normalised,
    ) ?? null
  );
}
