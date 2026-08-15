import { useState, type FormEvent } from 'react';
import { supabase } from '../../data/supabase';
import styles from './Gate.module.css';

const RESTING_NOTE =
  "No password. You'll get a one-time link by email — open it on whichever device you want to use.";

/**
 * The phase the app is in before it has a session, not a place you go
 * (ADR-0009). There is no `/signin` route and no auth store.
 *
 * The link has to be opened in the browser that requested it: the PKCE code
 * verifier lives in that browser's storage. The copy below says so.
 */
export function Gate() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState(RESTING_NOTE);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // The app's own URL, minus the route.
      options: { emailRedirectTo: window.location.href.split('#')[0] },
    });
    setSending(false);
    setNote(
      error
        ? `Could not send: ${error.message}`
        : 'Link sent. Check your email — it expires in an hour, and opening it on this device signs you in here.',
    );
  };

  return (
    <div className={styles.gate}>
      <div className={styles.box}>
        <div className={styles.wordmark}>
          Trilha<span>.</span>
        </div>
        <p className={styles.lede}>
          Positions, skills, and the paths between them. Sign in and your deck follows you from
          the gym to the laptop.
        </p>
        <form onSubmit={send}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <button className="btn primary wide" type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send me a sign-in link'}
          </button>
        </form>
        <p className={styles.note}>{note}</p>
      </div>
    </div>
  );
}
