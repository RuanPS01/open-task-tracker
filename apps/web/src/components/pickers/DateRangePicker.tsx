import type { IsoDate } from '@ott/shared';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { Button } from '../ui/Button';
import { Calendar } from '../ui/Calendar';
import { Popover, type PopoverTriggerProps } from '../ui/Popover';
import styles from './DateRangePicker.module.css';

/** Seletor de intervalo para datas de tarefa (início e entrega). */
export function DateRangePicker({
  start,
  end,
  onChange,
  trigger,
  single = false,
}: {
  start: IsoDate | null;
  end: IsoDate | null;
  onChange: (start: IsoDate | null, end: IsoDate | null) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  single?: boolean;
}) {
  const t = useT();
  return (
    <Popover trigger={trigger} initialFocus={-1}>
      {({ close }) => (
        <div>
          <Calendar
            start={start}
            end={end}
            range={!single}
            onSelect={(a, b) => {
              onChange(a, b);
              close();
            }}
          />
          {(start || end) && (
            <div className={styles.footer}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(null, null);
                  close();
                }}
              >
                {t.common.clear}
              </Button>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
