import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Sheet.module.css';

type SheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
};

/**
 * A bottom sheet on a phone, a centred dialog on a laptop.
 *
 * Whether it is open is component state, not a route (ADR-0008): the sheet
 * already has three dismissals, and routing it would add a `/skills/:id` that
 * can point at a deleted Skill.
 */
export function Sheet({ title, onClose, children, actions }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, []);

  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <h3 className={styles.title}>{title}</h3>
        {children}
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  );
}
