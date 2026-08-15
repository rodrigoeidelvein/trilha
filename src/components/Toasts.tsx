import { useUi } from '../store/useUi';
import styles from './Toasts.module.css';

/** The one place a transient message is shown. Failures are surfaced, never swallowed. */
export function Toasts() {
  const toasts = useUi((state) => state.toasts);

  return (
    <div className={styles.strip} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
