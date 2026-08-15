import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Seg } from './components/Seg';
import { supabase } from './data/supabase';
import { DISCIPLINES, type Discipline } from './domain/types';
import { BuildView } from './features/build/BuildView';
import { LogView } from './features/log/LogView';
import { MapView } from './features/map/MapView';
import { SkillsView } from './features/skills/SkillsView';
import { unsentCount, useDeck } from './store/useDeck';
import { useUi } from './store/useUi';
import styles from './Shell.module.css';

const DISCIPLINE_LABELS: Record<Discipline, string> = { juggling: 'Juggling', acro: 'Acro' };

const VIEWS = [
  { path: '/skills', label: 'Skills' },
  { path: '/log', label: 'Log' },
  { path: '/build', label: 'Build' },
  { path: '/map', label: 'Map' },
];

/**
 * The four views are the four routes, and the nav is four links — links change
 * where you are, buttons change what you are doing (ADR-0008).
 */
export function Shell() {
  const discipline = useUi((state) => state.discipline);
  const setDiscipline = useUi((state) => state.setDiscipline);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.wordmark}>
          Trilha<span>.</span>
        </div>
        <div className={styles.tag}>positions, skills, and the paths between them</div>
        <div className={styles.discipline}>
          <Seg
            label="Discipline"
            variant="pill"
            value={discipline}
            onChange={setDiscipline}
            options={DISCIPLINES.map((value) => ({ value, label: DISCIPLINE_LABELS[value] }))}
          />
        </div>
      </header>

      <nav className={styles.nav}>
        {VIEWS.map((view) => (
          <NavLink key={view.path} to={view.path}>
            <span className={styles.dot} />
            {view.label}
          </NavLink>
        ))}
      </nav>

      <main className={styles.main}>
        <RowErrorBanner />
        <Routes>
          <Route path="/skills" element={<SkillsView />} />
          <Route path="/log" element={<LogView />} />
          <Route path="/build" element={<BuildView />} />
          <Route path="/map" element={<MapView />} />
          <Route path="*" element={<Navigate to="/skills" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

/**
 * A mapper throw is rare and always actionable, so it does not go in the badge
 * the user has learnt to ignore (ADR-0019).
 */
function RowErrorBanner() {
  const syncError = useDeck((state) => state.syncError);
  if (syncError?.kind !== 'row') return null;

  return (
    <div className={styles.rowError}>
      <b>A row the app cannot read.</b> {syncError.table} row <code>{syncError.id}</code>:{' '}
      {syncError.detail}. Your local copy is still what you see here — the fix is in the Supabase
      dashboard.
    </div>
  );
}

function Footer() {
  const unsent = useDeck((state) => state.unsent);
  const syncError = useDeck((state) => state.syncError);
  const pull = useDeck((state) => state.pull);
  const replay = useDeck((state) => state.replay);

  const waiting = unsentCount(unsent);
  const offline = syncError?.kind === 'transport';

  // The badge derives from the Unsent set, not from the last write — which is
  // what makes a failure sticky (ADR-0014). Tapping it is the only manual
  // recovery there is, so the badge is a button.
  const label = waiting > 0 ? `${waiting} unsent` : offline ? 'Offline — showing your local copy' : 'Synced';

  const retry = async () => {
    await pull();
    await replay();
  };

  return (
    <div className={styles.foot}>
      <button
        className={styles.sync}
        data-off={waiting > 0 || offline}
        type="button"
        title="Try the server again"
        onClick={() => void retry()}
      >
        <b />
        {label}
      </button>
      <button type="button" onClick={exportJson}>
        Export JSON
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

function exportJson() {
  const { positions, skills, logs, sequences } = useDeck.getState();
  const blob = new Blob([JSON.stringify({ positions, skills, logs, sequences }, null, 2)], {
    type: 'application/json',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `trilha-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(href);
}

/**
 * A hard reload is the only reset that cannot leave a store holding the
 * previous session's deck, and it costs one page load (ADR-0009).
 */
async function signOut() {
  useDeck.persist.clearStorage();
  useUi.persist.clearStorage();
  await supabase.auth.signOut();
  window.location.reload();
}
