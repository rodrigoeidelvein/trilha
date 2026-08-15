import styles from './Seg.module.css';

type SegProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** The header toggle is pills; the board/list toggle is one joined box. */
  variant?: 'joined' | 'pill';
};

/**
 * The mode toggle: discipline, and board/list.
 *
 * Buttons with `aria-pressed`, not links — links change where you are, buttons
 * change what you are doing (ADR-0008). The nav is not a Seg for exactly that
 * reason.
 */
export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = 'joined',
}: SegProps<T>) {
  return (
    <div className={variant === 'pill' ? styles.pill : styles.joined} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
