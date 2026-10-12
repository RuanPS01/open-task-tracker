import type { Id } from '@ott/shared';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useMembers } from '../../data/workspace';
import { useT } from '../../i18n';
import { Avatar } from '../ui/Avatar';
import { Popover, type PopoverTriggerProps } from '../ui/Popover';
import styles from './Picker.module.css';

export function MemberPicker({
  value,
  onChange,
  trigger,
  single = false,
}: {
  value: Id[];
  onChange: (value: Id[]) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  single?: boolean;
}) {
  const t = useT();
  const { data: members = [] } = useMembers();
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const visible = members.filter(
    (member) => member.active && (member.name.toLowerCase().includes(normalized) || member.email.includes(normalized)),
  );

  return (
    <Popover trigger={trigger} width={260}>
      {({ close }) => (
        <>
          <input
            className={styles.search}
            placeholder={t.common.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <div className={styles.list}>
            {visible.map((member) => {
              const selected = value.includes(member.userId);
              return (
                <button
                  key={member.userId}
                  type="button"
                  className={clsx(styles.option, selected && styles.selected)}
                  onClick={() => {
                    if (single) {
                      onChange(selected ? [] : [member.userId]);
                      close();
                    } else {
                      onChange(selected ? value.filter((id) => id !== member.userId) : [...value, member.userId]);
                    }
                  }}
                >
                  <Avatar name={member.name} color={member.avatarColor} size={20} />
                  <span className={styles.optionLabel}>{member.name}</span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}
            {visible.length === 0 && <div className={styles.empty}>{t.common.noResults}</div>}
          </div>
        </>
      )}
    </Popover>
  );
}
