import { useMemo, useState } from 'react';
import type { AcroLogEntry, JugglingLogEntry, LogEntry, Role } from '../../domain/types';
import { ROLES } from '../../domain/types';
import { ROLE_LABELS } from '../../labels';
import { useDeck } from '../../store/useDeck';
import { byNewest, findSkill, ofDiscipline, partners } from '../../store/select';
import { notify, useUi } from '../../store/useUi';
import styles from './Log.module.css';

const today = (): string => new Date().toISOString().slice(0, 10);

const dayMonth = (loggedOn: string): string => {
  const [, month = '', day = ''] = loggedOn.split('-');
  return `${day}/${month}`;
};

const FELT = [1, 2, 3, 4, 5];

/** Juggling counts and acro feels, so the form has two shapes (ADR-0002). */
export function LogView() {
  const allSkills = useDeck((state) => state.skills);
  const allLogs = useDeck((state) => state.logs);
  const addLogEntry = useDeck((state) => state.addLogEntry);
  const deleteLogEntry = useDeck((state) => state.deleteLogEntry);
  const discipline = useUi((state) => state.discipline);

  const loggable = useMemo(
    () => ofDiscipline(allSkills, discipline).filter((skill) => skill.status !== 'want'),
    [allSkills, discipline],
  );
  const recent = useMemo(
    () => byNewest(ofDiscipline(allLogs, discipline)),
    [allLogs, discipline],
  );
  const knownPartners = useMemo(() => partners(allLogs), [allLogs]);

  const [skillId, setSkillId] = useState('');
  const [props, setProps] = useState('3');
  const [bestRun, setBestRun] = useState('');
  const [drops, setDrops] = useState('');
  const [role, setRole] = useState<Role>('base');
  const [partner, setPartner] = useState('');
  const [felt, setFelt] = useState(3);

  // Falls back to the first loggable Skill when the selection is stale — the
  // discipline was switched under it, or the Skill was deleted.
  const chosen = loggable.some((skill) => skill.id === skillId)
    ? skillId
    : loggable[0]?.id ?? '';

  const number = (raw: string): number | null => (raw === '' ? null : Number(raw));

  const save = () => {
    if (chosen === '' || !findSkill(loggable, chosen)) {
      notify('Move a skill to Working first.');
      return;
    }

    const base = { id: crypto.randomUUID(), loggedOn: today(), skillId: chosen, note: '' };
    const entry: LogEntry =
      discipline === 'juggling'
        ? ({
            ...base,
            discipline: 'juggling',
            props: number(props),
            bestRun: number(bestRun),
            drops: number(drops),
          } satisfies JugglingLogEntry)
        : ({
            ...base,
            discipline: 'acro',
            role,
            partner: partner.trim(),
            felt,
          } satisfies AcroLogEntry);

    setBestRun('');
    setDrops('');
    notify('Logged.');
    void addLogEntry(entry);
  };

  const options =
    loggable.length > 0 ? (
      loggable.map((skill) => (
        <option key={skill.id} value={skill.id}>
          {skill.name}
        </option>
      ))
    ) : (
      <option value="">Move a skill to Working first</option>
    );

  return (
    <>
      <h2>Log</h2>
      <p className="sub">
        {discipline === 'juggling'
          ? 'Numbers, not feelings. A run is only a run if you counted it.'
          : 'Same trick, different role, different partner — log all three or the history lies to you.'}
      </p>

      <div className={styles.form}>
        <div className="field">
          <label htmlFor="lgSkill">{discipline === 'juggling' ? 'Pattern' : 'Skill'}</label>
          <select
            id="lgSkill"
            value={chosen}
            onChange={(event) => setSkillId(event.target.value)}
          >
            {options}
          </select>
        </div>

        {discipline === 'juggling' ? (
          <div className="grid3">
            <div className="field">
              <label htmlFor="lgProps">Props</label>
              <input
                id="lgProps"
                type="number"
                inputMode="numeric"
                min={1}
                max={11}
                value={props}
                onChange={(event) => setProps(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lgRun">Best run</label>
              <input
                id="lgRun"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="catches"
                value={bestRun}
                onChange={(event) => setBestRun(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lgDrops">Drops</label>
              <input
                id="lgDrops"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={drops}
                onChange={(event) => setDrops(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid2">
              <div className="field">
                <label htmlFor="lgRole">Your role</label>
                <select
                  id="lgRole"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                >
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="lgPartner">Partner</label>
                <input
                  id="lgPartner"
                  list="partnerList"
                  placeholder="name"
                  value={partner}
                  onChange={(event) => setPartner(event.target.value)}
                />
                <datalist id="partnerList">
                  {knownPartners.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="field">
              <label>How did it feel</label>
              <div className={styles.felt}>
                {FELT.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={n === felt}
                    onClick={() => setFelt(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button className="btn primary wide" type="button" onClick={save}>
          Log it
        </button>
      </div>

      <div className="col-head">
        <b>Recent</b>
        <span className="count">{recent.length}</span>
      </div>

      {recent.length === 0 ? (
        <div className="empty">Nothing logged yet. The first entry is the hard one.</div>
      ) : (
        recent.slice(0, 30).map((entry) => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.when}>{dayMonth(entry.loggedOn)}</div>
            <div className={styles.what}>
              <div>{findSkill(allSkills, entry.skillId)?.name ?? '—'}</div>
              <div className={styles.meta}>{summarise(entry)}</div>
            </div>
            <button
              className="btn sm ghost"
              type="button"
              aria-label="Delete entry"
              onClick={() => void deleteLogEntry(entry.id)}
            >
              &times;
            </button>
          </div>
        ))
      )}
    </>
  );
}

/**
 * A LogEntry knows which shape it is, so this reads the right columns without
 * a null check on the ones that belong to the other discipline.
 */
function summarise(entry: LogEntry): string {
  const parts =
    entry.discipline === 'juggling'
      ? [
          entry.props !== null ? `${entry.props} props` : null,
          entry.bestRun !== null ? `${entry.bestRun} catches` : null,
          entry.drops ? `${entry.drops} drops` : null,
        ]
      : [
          entry.role !== null ? ROLE_LABELS[entry.role].toLowerCase() : null,
          entry.partner !== '' ? `with ${entry.partner}` : null,
          entry.felt !== null ? `${entry.felt}/5` : null,
        ];

  return parts.filter((part) => part !== null).join('  ·  ');
}
