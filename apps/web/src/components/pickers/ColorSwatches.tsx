// Amostras de cor para escolher uma das cores de projeto (PROJECT_COLORS). Serve à cor do
// projeto e ao tema de cor do workspace, que acrescenta a amostra "Padrão" (valor nulo,
// paleta ciano). A cor da amostra vem do dado, não do tema.
import { PROJECT_COLORS } from '@ott/shared';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useT } from '../../i18n';
import styles from './ColorSwatches.module.css';

export function ColorSwatches({
  value,
  onChange,
  label,
  withDefault = false,
  disabled = false,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
  /** Nome do grupo para leitores de tela. */
  label: string;
  /** Primeira amostra "Padrão" (ciano), que devolve nulo. */
  withDefault?: boolean;
  disabled?: boolean;
}) {
  const t = useT();
  const names = t.colors as Record<string, string | undefined>;
  const options: (string | null)[] = withDefault ? [null, ...PROJECT_COLORS] : [...PROJECT_COLORS];
  return (
    <div className={styles.swatches} role="radiogroup" aria-label={label}>
      {options.map((color) => {
        const selected = color === value;
        const name = color === null ? t.colors.default : (names[color] ?? color);
        return (
          <button
            key={color ?? 'default'}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            disabled={disabled}
            className={clsx(styles.swatch, color === null && styles.default, selected && styles.selected)}
            style={color ? { background: color } : undefined}
            onClick={() => onChange(color)}
          >
            {selected && <Check size={14} />}
          </button>
        );
      })}
    </div>
  );
}
