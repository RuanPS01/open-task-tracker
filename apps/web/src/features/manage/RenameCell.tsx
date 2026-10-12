import { useState } from 'react';
import styles from './Manage.module.css';

/** Campo de renomear na própria linha: Enter salva, Esc cancela, sair do campo salva. */
export function RenameCell({ value, onSave, onCancel }: { value: string; onSave: (value: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value);
  return (
    <input
      className={styles.renameInput}
      value={text}
      autoFocus
      onChange={(event) => setText(event.target.value)}
      onBlur={() => (text.trim() && text !== value ? onSave(text.trim()) : onCancel())}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') onCancel();
      }}
    />
  );
}
