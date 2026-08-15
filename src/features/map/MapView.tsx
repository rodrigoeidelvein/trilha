import { useMemo } from 'react';
import { isolatedPositions, skillsAt } from '../../domain/graph';
import { STATUSES } from '../../domain/types';
import { STATUS_LABELS } from '../../labels';
import { useDeck } from '../../store/useDeck';
import { ofDiscipline, positionName } from '../../store/select';
import { useUi } from '../../store/useUi';
import styles from './Map.module.css';

const W = 760;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const RADIUS = Math.min(W, H) / 2 - 72;

/**
 * Geometry is data and stays in attributes; appearance is CSS (ADR-0012).
 * There is no opacity table in here — the ramp lives in the stylesheet, keyed
 * by the same `data-status` the Skills cards use.
 */
export function MapView() {
  const allPositions = useDeck((state) => state.positions);
  const allSkills = useDeck((state) => state.skills);
  const discipline = useUi((state) => state.discipline);

  const positions = useMemo(
    () => ofDiscipline(allPositions, discipline),
    [allPositions, discipline],
  );
  const skills = useMemo(() => ofDiscipline(allSkills, discipline), [allSkills, discipline]);

  const points = useMemo(() => {
    const laidOut = new Map<string, { x: number; y: number }>();
    positions.forEach((position, index) => {
      const angle = (index / positions.length) * Math.PI * 2 - Math.PI / 2;
      laidOut.set(position.id, {
        x: CX + RADIUS * Math.cos(angle),
        y: CY + RADIUS * Math.sin(angle),
      });
    });
    return laidOut;
  }, [positions]);

  const isolated = useMemo(
    () => isolatedPositions(positions, skills),
    [positions, skills],
  );

  return (
    <>
      <h2>Map</h2>
      <p className="sub">
        Circles are positions. Lines are skills. The more solid the line, the more solid the skill.
      </p>

      <div className={styles.wrap}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your position graph">
          {skills.map((skill) => {
            const a = points.get(skill.from);
            const b = points.get(skill.to);
            if (!a || !b) return null;

            if (skill.from === skill.to) {
              return (
                <circle
                  key={skill.id}
                  className={styles.selfLoop}
                  data-status={skill.status}
                  cx={a.x}
                  cy={a.y - 26}
                  r={17}
                >
                  <title>{skill.name} (loops in place)</title>
                </circle>
              );
            }

            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const dx = b.x - a.x;
            const dy = b.y - a.y;

            return (
              <path
                key={skill.id}
                className={styles.edge}
                data-status={skill.status}
                d={`M${a.x} ${a.y} Q${mx - dy * 0.12} ${my + dx * 0.12} ${b.x} ${b.y}`}
              >
                <title>
                  {skill.name}: {positionName(allPositions, skill.from)} →{' '}
                  {positionName(allPositions, skill.to)}
                </title>
              </path>
            );
          })}

          {positions.map((position) => {
            const point = points.get(position.id);
            if (!point) return null;

            const touching = skillsAt(skills, position.id);
            const solid = touching.filter((skill) => skill.status === 'got').length;
            const r = 7 + Math.min(touching.length, 10) * 1.1;

            return (
              <g key={position.id}>
                <circle
                  className={styles.node}
                  data-solid={solid > 0}
                  cx={point.x}
                  cy={point.y}
                  r={r}
                >
                  <title>
                    {position.name} — {touching.length} skills, {solid} solid
                  </title>
                </circle>
                <text
                  className={styles.label}
                  x={point.x}
                  y={point.y + r + 15}
                  textAnchor="middle"
                >
                  {position.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={styles.legend}>
        {STATUSES.map((status) => (
          <span key={status}>
            <i className={styles.swatch} data-status={status} />
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      <p className="sub" style={{ marginTop: 16 }}>
        {STATUSES.map(
          (status) =>
            `${STATUS_LABELS[status]}: ${skills.filter((s) => s.status === status).length}`,
        ).join('   ·   ')}
      </p>

      {isolated.length > 0 && (
        <div className="empty" style={{ textAlign: 'left' }}>
          Positions with nothing attached yet: {isolated.map((p) => p.name).join(', ')}. Those are
          the gaps in your vocabulary.
        </div>
      )}
    </>
  );
}
