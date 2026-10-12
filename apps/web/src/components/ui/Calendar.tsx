// Calendário de um mês para escolher data ou intervalo (seletor de datas da tarefa,
// período dos relatórios). Trabalha com IsoDate para não sofrer com fuso horário.
import {
  addDays,
  isoToUtcMs,
  startOfWeekIso,
  toIsoDate,
  type IsoDate,
} from '@ott/shared';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { usePreferences } from '../../app/session';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { IconButton } from './Button';
import styles from './Calendar.module.css';

const monthKey = (iso: IsoDate) => iso.slice(0, 7);
const firstOfMonth = (iso: IsoDate) => `${iso.slice(0, 7)}-01`;

function shiftMonth(iso: IsoDate, delta: number): IsoDate {
  const date = new Date(isoToUtcMs(firstOfMonth(iso)));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 10);
}

export interface CalendarProps {
  /** Data única ou início do intervalo. */
  start: IsoDate | null;
  /** Fim do intervalo (modo intervalo). */
  end?: IsoDate | null;
  range?: boolean;
  onSelect: (start: IsoDate, end: IsoDate) => void;
}

export function Calendar({ start, end, range = false, onSelect }: CalendarProps) {
  const t = useT();
  const format = useFormat();
  const { weekStart } = usePreferences();
  const today = toIsoDate(new Date());
  const [month, setMonth] = useState<IsoDate>(firstOfMonth(start ?? today));
  const [anchor, setAnchor] = useState<IsoDate | null>(null);
  const [hover, setHover] = useState<IsoDate | null>(null);

  const gridStart = startOfWeekIso(month, weekStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekdays = days.slice(0, 7);

  const rangeStart = anchor ?? start;
  const rangeEnd = anchor ? (hover ?? anchor) : (end ?? start);
  const [lo, hi] =
    rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart]) : [null, null];

  const choose = (day: IsoDate) => {
    if (!range) {
      onSelect(day, day);
      return;
    }
    if (!anchor) {
      setAnchor(day);
      return;
    }
    const [a, b] = anchor <= day ? [anchor, day] : [day, anchor];
    setAnchor(null);
    onSelect(a, b);
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <IconButton icon={<ChevronLeft />} label={t.common.previous} size="sm" onClick={() => setMonth(shiftMonth(month, -1))} />
        <span className={styles.month}>{format.yearMonth(month)}</span>
        <IconButton icon={<ChevronRight />} label={t.common.next} size="sm" onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>
      <div className={styles.grid} role="grid">
        {weekdays.map((day) => (
          <span key={`w-${day}`} className={styles.weekday}>
            {format.weekdayShort(day).slice(0, 3)}
          </span>
        ))}
        {days.map((day) => {
          const inRange = lo !== null && hi !== null && day >= lo && day <= hi;
          return (
            <button
              key={day}
              type="button"
              className={clsx(
                styles.day,
                monthKey(day) !== monthKey(month) && styles.outside,
                day === today && styles.today,
                inRange && styles.inRange,
                (day === lo || day === hi) && styles.edge,
              )}
              onClick={() => choose(day)}
              onMouseEnter={() => setHover(day)}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
