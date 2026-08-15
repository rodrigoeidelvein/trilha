import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Toasts } from './components/Toasts';
import { supabase } from './data/supabase';
import { Gate } from './features/auth/Gate';
import { Shell } from './Shell';
import { useDeck } from './store/useDeck';
import { useUi } from './store/useUi';
import styles from './App.module.css';

type Phase = 'unknown' | 'signedOut' | 'signedIn';

/**
 * The auth gate is a branch above the router (ADR-0009), and hydration is a
 * branch above that (ADR-0016). Boot reads: rehydrate → render from the local
 * deck → pull → replay.
 */
export function App() {
  const hydrated = useHydrated();
  const phase = useAuthPhase();
  const discipline = useUi((state) => state.discipline);
  const boot = useDeck((state) => state.boot);

  // The one imperative DOM write in the app, and it writes a *fact* rather
  // than a style — the stylesheet decides what it means (ADR-0011).
  useEffect(() => {
    document.documentElement.dataset.discipline = discipline;
  }, [discipline]);

  useEffect(() => {
    if (hydrated && phase === 'signedIn') void boot();
  }, [hydrated, phase, boot]);

  if (!hydrated) return <Loading>Loading your deck…</Loading>;
  if (phase === 'unknown') return <Loading>&nbsp;</Loading>;

  return (
    <>
      {phase === 'signedOut' ? (
        <Gate />
      ) : (
        <HashRouter>
          <Shell />
        </HashRouter>
      )}
      <Toasts />
    </>
  );
}

function Loading({ children }: { children: ReactNode }) {
  return <div className={styles.loading}>{children}</div>;
}

/**
 * `persist` rehydrates synchronously from localStorage, so a returning device
 * has its deck before the first paint. This gate exists so `pull()` cannot run
 * before hydration finishes and write a deck that hydration then overwrites.
 */
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useDeck.persist.hasHydrated());

  useEffect(() => useDeck.persist.onFinishHydration(() => setHydrated(true)), []);

  return hydrated;
}

function useAuthPhase(): Phase {
  const [phase, setPhase] = useState<Phase>('unknown');

  useEffect(() => {
    const settle = (session: Session | null) => setPhase(session ? 'signedIn' : 'signedOut');

    void supabase.auth.getSession().then(({ data }) => settle(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => settle(session));

    return () => data.subscription.unsubscribe();
  }, []);

  return phase;
}
