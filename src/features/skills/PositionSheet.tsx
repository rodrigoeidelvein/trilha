import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { collidingPosition } from '../../domain/positions';
import type { Discipline, Position } from '../../domain/types';
import { useDeck } from '../../store/useDeck';
import { notify } from '../../store/useUi';
import styles from './Skills.module.css';

type PositionSheetProps = {
  discipline: Discipline;
  onClose: () => void;
};

export function PositionSheet({ discipline, onClose }: PositionSheetProps) {
  const positions = useDeck((state) => state.positions);
  const savePosition = useDeck((state) => state.savePosition);
  const [name, setName] = useState('');
  const [aka, setAka] = useState('');

  // The database refuses a collision with a 23505, which would arrive looking
  // like a sync failure and sit Unsent forever (ADR-0023). So warn first.
  const clash = name.trim() === '' ? null : collidingPosition(positions, discipline, name);

  const save = () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      notify('Give it a name first.');
      return;
    }
    if (clash) {
      notify(`You already have ${clash.name}.`);
      return;
    }
    const position: Position = {
      id: crypto.randomUUID(),
      name: trimmed,
      aka: aka.trim(),
      discipline,
    };
    onClose();
    void savePosition(position);
  };

  return (
    <Sheet
      title="New position"
      onClose={onClose}
      actions={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="button" onClick={save} disabled={clash !== null}>
            Save
          </button>
        </>
      }
    >
      <p className="sub">
        A position is a place you can be — a pattern in juggling, a shape in acro. Skills are the
        moves between them.
      </p>
      <div className="field">
        <label htmlFor="poName">Name</label>
        <input
          id="poName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={discipline === 'juggling' ? 'e.g. Half shower' : 'e.g. Ninja star'}
        />
        {clash && (
          <p className={styles.clash}>
            You already have <b>{clash.name}</b> — same name once the spacing and punctuation come
            out.
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="poAka">Also called</label>
        <input id="poAka" value={aka} onChange={(event) => setAka(event.target.value)} />
      </div>
    </Sheet>
  );
}
