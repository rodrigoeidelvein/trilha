import { useMemo } from 'react';
import { analyseSequence, bridges, resolveSequence } from '../../domain/graph';
import type { Sequence } from '../../domain/types';
import { useDeck } from '../../store/useDeck';
import { ofDiscipline, positionName } from '../../store/select';
import { notify, useUi } from '../../store/useUi';
import styles from './Build.module.css';

/** A Sequence is a path; a connected path that comes home is a Loop. */
export function BuildView() {
  const allPositions = useDeck((state) => state.positions);
  const allSkills = useDeck((state) => state.skills);
  const allSequences = useDeck((state) => state.sequences);
  const saveSequence = useDeck((state) => state.saveSequence);

  const discipline = useUi((state) => state.discipline);
  const chain = useUi((state) => state.chain);
  const appendToChain = useUi((state) => state.appendToChain);
  const insertIntoChain = useUi((state) => state.insertIntoChain);
  const removeFromChain = useUi((state) => state.removeFromChain);
  const loadChain = useUi((state) => state.loadChain);
  const clearChain = useUi((state) => state.clearChain);

  const skills = useMemo(() => ofDiscipline(allSkills, discipline), [allSkills, discipline]);
  const sequences = useMemo(
    () => ofDiscipline(allSequences, discipline),
    [allSequences, discipline],
  );

  const ids = chain[discipline];
  // The chain is persisted, so it outlives the pull that can delete a Skill
  // under it — it is resolved exactly like a loaded Sequence (ADR-0008).
  const { skills: linked, missing } = useMemo(
    () => resolveSequence(ids, skills),
    [ids, skills],
  );
  const { joints, connected, loop } = useMemo(() => analyseSequence(linked), [linked]);

  // Where each resolved Skill sits in the *chain*, which is not where it sits
  // in `linked` once a dangling id has been dropped out of the middle.
  const chainIndex = useMemo(
    () => ids.flatMap((id, index) => (skills.some((s) => s.id === id) ? [index] : [])),
    [ids, skills],
  );

  const name = (id: string) => positionName(allPositions, id);
  const last = linked[linked.length - 1];
  const first = linked[0];

  const save = () => {
    if (linked.length < 2) {
      notify('Add at least two skills.');
      return;
    }
    const suggested =
      loop && discipline === 'acro' ? 'Washing machine' : `Sequence ${sequences.length + 1}`;
    const given = window.prompt('Name this sequence', suggested);
    if (given === null || given.trim() === '') return;

    const sequence: Sequence = {
      id: crypto.randomUUID(),
      name: given.trim(),
      discipline,
      skillIds: [...ids],
    };
    notify('Saved.');
    void saveSequence(sequence);
  };

  return (
    <>
      <h2>Build</h2>
      <p className="sub">
        Chain skills together. Trilha checks whether each one actually starts where the last one
        ended
        {discipline === 'acro' ? ", and tells you when you've closed a washing machine" : ''}.
      </p>

      {missing.length > 0 && (
        <p className={styles.missing}>
          {missing.length} of the {ids.length} skills in this chain no longer exist. What is left is
          shown below, with the gaps closed up — it is not the sequence you built.
        </p>
      )}

      {linked.length > 0 ? (
        <>
          <div className={styles.chain}>
            {linked.map((skill, index) => {
              const joint = index > 0 ? joints[index - 1] : undefined;
              return (
                <div key={`${skill.id}-${index}`}>
                  {joint?.connected === true && (
                    <div className={styles.jointOk}>&#9679; lands in {name(joint.at)}</div>
                  )}
                  {joint?.connected === false && (
                    <>
                      <div className={styles.jointBad}>
                        &#9888; breaks — you end in {name(joint.lands)} but the next skill starts
                        from {name(joint.departs)}
                      </div>
                      {bridges(skills, joint.lands, joint.departs)
                        .slice(0, 3)
                        .map((bridge) => (
                          <button
                            key={bridge.id}
                            type="button"
                            className={styles.bridge}
                            onClick={() => insertIntoChain(bridge.id, chainIndex[index] ?? index)}
                          >
                            Insert &ldquo;{bridge.name}&rdquo; to connect
                          </button>
                        ))}
                    </>
                  )}
                  <div className={styles.link}>
                    <div className={styles.idx}>{index + 1}</div>
                    <div className={styles.body}>
                      <div className={styles.nm}>
                        {skill.name}
                        {skill.siteswap !== '' && <span className={styles.ss}>{skill.siteswap}</span>}
                      </div>
                      <div className={styles.pos}>
                        {name(skill.from)} &rarr; {name(skill.to)}
                      </div>
                    </div>
                    <button
                      className="btn sm ghost"
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeFromChain(chainIndex[index] ?? index)}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* The domain calls a lone self-loop a Loop; the banner keeps the
              prototype's guard, because that is a presentation rule. */}
          {linked.length > 1 && first && last && (
            <Verdict
              connected={connected}
              loop={loop}
              discipline={discipline}
              startName={name(first.from)}
              endName={name(last.to)}
              closable={bridges(skills, last.to, first.from).length > 0}
            />
          )}

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={clearChain}>
              Clear
            </button>
            <button className="btn primary" type="button" onClick={save}>
              Save sequence
            </button>
          </div>
        </>
      ) : (
        <div className="empty">
          Pick a skill below to start a chain.
          <br />
          Highlighted ones start where you currently are.
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <div className="col-head">
          <b>Add a skill</b>
          <span className="count">{last ? `from ${name(last.to)}` : 'any start'}</span>
        </div>
        <div className={styles.picker}>
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className={!last || skill.from === last.to ? styles.live : undefined}
              onClick={() => appendToChain(skill.id)}
            >
              {skill.name}
            </button>
          ))}
        </div>
      </div>

      {sequences.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div className="col-head">
            <b>Saved</b>
          </div>
          {sequences.map((sequence) => (
            <button
              key={sequence.id}
              type="button"
              className={styles.bridge}
              onClick={() => loadChain(sequence.skillIds)}
            >
              {sequence.name}{' '}
              <span className={styles.faint}>— {sequence.skillIds.length} skills</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

type VerdictProps = {
  connected: boolean;
  loop: boolean;
  discipline: 'juggling' | 'acro';
  startName: string;
  endName: string;
  closable: boolean;
};

function Verdict({ connected, loop, discipline, startName, endName, closable }: VerdictProps) {
  if (!connected) {
    return (
      <div className={styles.verdictBad}>
        <h3>Doesn&rsquo;t connect yet</h3>
        Fix the breaks above, or drop the skill that doesn&rsquo;t fit.
      </div>
    );
  }

  if (loop) {
    return (
      <div className={styles.verdictLoop}>
        <h3>{discipline === 'acro' ? 'Washing machine' : 'Closed loop'}</h3>
        This returns to {startName}, so you can run it continuously.{' '}
        {discipline === 'acro'
          ? 'That is the whole point of a washing machine — no reset between rounds.'
          : 'Ground state in, ground state out.'}
      </div>
    );
  }

  return (
    <div className={styles.verdictGood}>
      <h3>Valid sequence</h3>
      Runs from {startName} to {endName}.{' '}
      {closable
        ? 'You already have a skill that would close this into a loop — it is highlighted below.'
        : `Add a skill back to ${startName} to close it into a loop.`}
    </div>
  );
}
