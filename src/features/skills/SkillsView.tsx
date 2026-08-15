import { useMemo, useState } from 'react';
import { Seg } from '../../components/Seg';
import { STATUSES, type Skill, type Status } from '../../domain/types';
import { STATUS_LABELS } from '../../labels';
import { useDeck } from '../../store/useDeck';
import { byName, ofDiscipline, positionName } from '../../store/select';
import { useUi } from '../../store/useUi';
import { PositionSheet } from './PositionSheet';
import { SkillCard } from './SkillCard';
import { SkillSheet } from './SkillSheet';
import styles from './Skills.module.css';

const nextStatus = (status: Status): Status =>
  status === 'want' ? 'working' : status === 'working' ? 'got' : 'want';

type OpenSheet =
  | { kind: 'none' }
  | { kind: 'position' }
  | { kind: 'skill'; skill: Skill | null };

export function SkillsView() {
  const allPositions = useDeck((state) => state.positions);
  const allSkills = useDeck((state) => state.skills);
  const saveSkill = useDeck((state) => state.saveSkill);
  const discipline = useUi((state) => state.discipline);
  const boardMode = useUi((state) => state.boardMode);
  const setBoardMode = useUi((state) => state.setBoardMode);

  const [sheet, setSheet] = useState<OpenSheet>({ kind: 'none' });

  const positions = useMemo(
    () => ofDiscipline(allPositions, discipline),
    [allPositions, discipline],
  );
  const skills = useMemo(() => ofDiscipline(allSkills, discipline), [allSkills, discipline]);

  const card = (skill: Skill) => (
    <SkillCard
      key={skill.id}
      skill={skill}
      fromName={positionName(allPositions, skill.from)}
      toName={positionName(allPositions, skill.to)}
      onAdvance={() => void saveSkill({ ...skill, status: nextStatus(skill.status) })}
      onEdit={() => setSheet({ kind: 'skill', skill })}
    />
  );

  return (
    <>
      <h2>Skills</h2>
      <p className="sub">
        Tap a card to move it along: want &rarr; working &rarr; got it. Shift-click to edit.
      </p>

      <div className="row" style={{ marginBottom: 16 }}>
        <Seg
          label="How to show skills"
          value={boardMode}
          onChange={setBoardMode}
          options={[
            { value: 'board', label: 'Board' },
            { value: 'list', label: 'List' },
          ]}
        />
        <div className="spacer" />
        <button className="btn" type="button" onClick={() => setSheet({ kind: 'position' })}>
          Add position
        </button>
        <button
          className="btn primary"
          type="button"
          // A Skill is an edge, so it cannot be created before the Positions it
          // connects exist (ADR-0003).
          disabled={positions.length === 0}
          title={positions.length === 0 ? 'Add a position first — a skill goes between two' : ''}
          onClick={() => setSheet({ kind: 'skill', skill: null })}
        >
          Add skill
        </button>
      </div>

      {boardMode === 'board' ? (
        <div className={styles.board}>
          {STATUSES.map((status) => {
            const column = skills.filter((skill) => skill.status === status);
            return (
              <div key={status}>
                <div className="col-head">
                  <b>{STATUS_LABELS[status]}</b>
                  <span className="count">{column.length}</span>
                </div>
                <div className="stack">
                  {column.length > 0 ? (
                    column.map(card)
                  ) : (
                    <div className="empty">Nothing here yet</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stack">
          {skills.length > 0 ? (
            byName(skills).map(card)
          ) : (
            <div className="empty">No skills yet</div>
          )}
        </div>
      )}

      {sheet.kind === 'position' && (
        <PositionSheet discipline={discipline} onClose={() => setSheet({ kind: 'none' })} />
      )}
      {sheet.kind === 'skill' && (
        <SkillSheet
          skill={sheet.skill}
          discipline={discipline}
          positions={positions}
          onClose={() => setSheet({ kind: 'none' })}
        />
      )}
    </>
  );
}
