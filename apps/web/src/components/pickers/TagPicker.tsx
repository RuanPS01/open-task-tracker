import type { Id } from '@ott/shared';
import clsx from 'clsx';
import { Check, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useCreateTag, useTags } from '../../api/workspace';
import { useT } from '../../i18n';
import { Popover, type PopoverTriggerProps } from '../ui/Popover';
import styles from './Picker.module.css';

/** Seleção múltipla de tags com criação na hora (Enter cria a tag digitada). */
export function TagPicker({
  value,
  onChange,
  trigger,
}: {
  value: Id[];
  onChange: (value: Id[]) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
}) {
  const t = useT();
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const visible = tags.filter((tag) => tag.name.toLowerCase().includes(normalized));
  const exists = tags.some((tag) => tag.name.toLowerCase() === normalized);
  const toggle = (id: Id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const create = async () => {
    if (!normalized || exists) return;
    const tag = await createTag.mutateAsync(query.trim());
    onChange([...value, tag.id]);
    setQuery('');
  };

  return (
    <Popover trigger={trigger} width={260}>
      <input
        className={styles.search}
        placeholder={t.common.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && void create()}
        autoFocus
      />
      <div className={styles.list}>
        {visible.map((tag) => {
          const selected = value.includes(tag.id);
          return (
            <button key={tag.id} type="button" className={clsx(styles.option, selected && styles.selected)} onClick={() => toggle(tag.id)}>
              <span className={styles.optionLabel}>{tag.name}</span>
              {selected && <Check size={14} />}
            </button>
          );
        })}
        {visible.length === 0 && !normalized && <div className={styles.empty}>{t.tags.emptyTitle}</div>}
        {normalized && !exists && (
          <button type="button" className={clsx(styles.option, styles.create)} onClick={() => void create()}>
            <Plus size={14} />
            <span className={styles.optionLabel}>{t.common.create_named(query.trim())}</span>
          </button>
        )}
      </div>
    </Popover>
  );
}
