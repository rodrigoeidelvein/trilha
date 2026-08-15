import type { MouseEvent } from 'react';
import type { Skill } from '../../domain/types';
import styles from './Skills.module.css';

type SkillCardProps = {
  skill: Skill;
  fromName: string;
  toName: string;
  onAdvance: () => void;
  onEdit: () => void;
};

/**
 * Status is a data attribute rather than a class name (ADR-0011), so the card
 * passes it straight through and the Map keys off the identical attribute.
 */
export function SkillCard({ skill, fromName, toName, onAdvance, onEdit }: SkillCardProps) {
  const click = (event: MouseEvent) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) onEdit();
    else onAdvance();
  };

  return (
    <button className={styles.card} data-status={skill.status} onClick={click}>
      <div className={styles.nm}>{skill.name}</div>
      {skill.aka !== '' && <div className={styles.aka}>also: {skill.aka}</div>}
      <div className={styles.path}>
        {skill.siteswap !== '' && <span className={styles.ss}>{skill.siteswap}</span>}
        {skill.propCount !== null && <span>{skill.propCount}</span>}
        <span>{fromName}</span>
        <span className={styles.arw}>&rarr;</span>
        <span>{toName}</span>
      </div>
    </button>
  );
}
