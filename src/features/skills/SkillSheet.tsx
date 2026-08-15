import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { STATUSES, type Discipline, type Position, type Skill, type Status } from '../../domain/types';
import { STATUS_LABELS } from '../../labels';
import { useDeck } from '../../store/useDeck';
import { notify } from '../../store/useUi';

type SkillSheetProps = {
  /** The Skill being edited, or null for a new one. */
  skill: Skill | null;
  discipline: Discipline;
  positions: Position[];
  onClose: () => void;
};

export function SkillSheet({ skill, discipline, positions, onClose }: SkillSheetProps) {
  const logs = useDeck((state) => state.logs);
  const saveSkill = useDeck((state) => state.saveSkill);
  const deleteSkill = useDeck((state) => state.deleteSkill);

  const firstPosition = positions[0]?.id ?? '';
  const [name, setName] = useState(skill?.name ?? '');
  const [aka, setAka] = useState(skill?.aka ?? '');
  const [from, setFrom] = useState(skill?.from ?? firstPosition);
  const [to, setTo] = useState(skill?.to ?? firstPosition);
  const [siteswap, setSiteswap] = useState(skill?.siteswap ?? '');
  const [propCount, setPropCount] = useState(String(skill?.propCount ?? 3));
  const [status, setStatus] = useState<Status>(skill?.status ?? 'want');
  const [notes, setNotes] = useState(skill?.notes ?? '');

  const isJuggling = discipline === 'juggling';

  const save = () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      notify('Give it a name first.');
      return;
    }
    const next: Skill = {
      id: skill?.id ?? crypto.randomUUID(),
      name: trimmed,
      aka: aka.trim(),
      discipline,
      from,
      to,
      siteswap: isJuggling ? siteswap.trim() : '',
      propCount: isJuggling ? Number(propCount) || null : null,
      status,
      notes: notes.trim(),
    };
    onClose();
    void saveSkill(next);
  };

  const remove = () => {
    if (!skill) return;
    // Deleting a Skill destroys its history, so the confirmation states the
    // cost (ADR-0018). That sentence is the whole of the protection.
    const attempts = logs.filter((l) => l.skillId === skill.id).length;
    const cost =
      attempts === 0
        ? 'Nothing has been logged against it.'
        : `${attempts} logged attempt${attempts === 1 ? '' : 's'} go${attempts === 1 ? 'es' : ''} with it.`;
    if (!window.confirm(`Delete ${skill.name}? ${cost}`)) return;
    onClose();
    void deleteSkill(skill.id);
  };

  const options = positions.map((position) => (
    <option key={position.id} value={position.id}>
      {position.name}
    </option>
  ));

  return (
    <Sheet
      title={skill ? 'Edit skill' : 'New skill'}
      onClose={onClose}
      actions={
        <>
          {skill && (
            <button className="btn danger" type="button" onClick={remove}>
              Delete
            </button>
          )}
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="button" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="skName">Name</label>
        <input
          id="skName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={isJuggling ? 'e.g. 441' : 'e.g. Barrel roll'}
        />
      </div>
      <div className="field">
        <label htmlFor="skAka">Also called</label>
        <input
          id="skAka"
          value={aka}
          onChange={(event) => setAka(event.target.value)}
          placeholder="other names your coach uses"
        />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="skFrom">Starts from</label>
          <select id="skFrom" value={from} onChange={(event) => setFrom(event.target.value)}>
            {options}
          </select>
        </div>
        <div className="field">
          <label htmlFor="skTo">Ends in</label>
          <select id="skTo" value={to} onChange={(event) => setTo(event.target.value)}>
            {options}
          </select>
        </div>
      </div>
      {isJuggling && (
        <div className="grid2">
          <div className="field">
            <label htmlFor="skSS">Siteswap</label>
            <input
              id="skSS"
              value={siteswap}
              onChange={(event) => setSiteswap(event.target.value)}
              placeholder="441"
            />
          </div>
          <div className="field">
            <label htmlFor="skPC">Props</label>
            <input
              id="skPC"
              type="number"
              min={1}
              max={11}
              value={propCount}
              onChange={(event) => setPropCount(event.target.value)}
            />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="skStatus">Status</label>
        <select
          id="skStatus"
          value={status}
          onChange={(event) => setStatus(event.target.value as Status)}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="skNotes">Notes</label>
        <textarea
          id="skNotes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="cues, corrections, what your coach said"
        />
      </div>
    </Sheet>
  );
}
