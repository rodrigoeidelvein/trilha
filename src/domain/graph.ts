/**
 * What the Build and Map views need to know about the graph.
 *
 * Every function takes plain arrays, returns plain data, and holds no state
 * between calls (ADR-0005). There is no Graph value to construct and no
 * adjacency index — one user's deck is tens of Positions and low hundreds of
 * Skills, and an index buys nothing but a staleness question.
 *
 * The one precondition, stated rather than checked: the Skills handed to these
 * functions are a *single* Discipline's. No edge ever crosses between the two,
 * so a mixed list describes a graph that does not exist. `Discipline` is
 * deliberately not imported here; the store selector is what enforces this.
 */

import type { Position, PositionId, Skill, SkillId } from './types';

/** The meeting point between two consecutive Skills in a Sequence. */
export type Joint =
  | { connected: true; at: PositionId }
  | { connected: false; lands: PositionId; departs: PositionId };

export type SequenceAnalysis = {
  joints: Joint[];
  /** Vacuously true for an empty Sequence: no joints, so none broken. */
  connected: boolean;
  /** Connected **and** ending where it began. Both, in one pass (ADR-0006). */
  loop: boolean;
  from: PositionId | null;
  to: PositionId | null;
};

export type Resolution = {
  skills: Skill[];
  missing: SkillId[];
};

/**
 * Turns a saved Sequence's ids into Skills, saying which ones are gone.
 *
 * `sequences.skill_ids` carries no foreign key, so a saved Sequence can hold
 * the id of a deleted Skill — and so can the persisted Build chain, which
 * outlives the pull that deletes one (ADR-0007, ADR-0008). Dropping those
 * silently *closes the gap*, which makes the rest of this module answer
 * questions about a Sequence the user never built.
 */
export function resolveSequence(skillIds: SkillId[], skills: Skill[]): Resolution {
  const resolved: Skill[] = [];
  const missing: SkillId[] = [];

  for (const id of skillIds) {
    const skill = skills.find((s) => s.id === id);
    if (skill) resolved.push(skill);
    else missing.push(id);
  }

  return { skills: resolved, missing };
}

/** Every joint, plus whether the whole thing holds together and comes home. */
export function analyseSequence(skills: Skill[]): SequenceAnalysis {
  const first = skills[0];
  const last = skills[skills.length - 1];

  const joints: Joint[] = [];
  let connected = true;

  for (let i = 1; i < skills.length; i++) {
    const lands = skills[i - 1]!.to;
    const departs = skills[i]!.from;

    if (lands === departs) {
      joints.push({ connected: true, at: lands });
    } else {
      joints.push({ connected: false, lands, departs });
      connected = false;
    }
  }

  if (!first || !last) {
    return { joints, connected, loop: false, from: null, to: null };
  }

  return {
    joints,
    connected,
    loop: connected && last.to === first.from,
    from: first.from,
    to: last.to,
  };
}

/** The Skills that would join two Positions — repairing a break, or closing a Loop. */
export function bridges(skills: Skill[], from: PositionId, to: PositionId): Skill[] {
  return skills.filter((s) => s.from === from && s.to === to);
}

/**
 * The Skills touching a Position in either direction.
 *
 * Not called `degree`: a self-loop is one Skill on the Position, and a degree
 * would have to count it twice.
 */
export function skillsAt(skills: Skill[], position: PositionId): Skill[] {
  return skills.filter((s) => s.from === position || s.to === position);
}

/** Positions with no Skill touching them — the gaps in the user's vocabulary. */
export function isolatedPositions(positions: Position[], skills: Skill[]): Position[] {
  return positions.filter((p) => skillsAt(skills, p.id).length === 0);
}
