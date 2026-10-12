// Seção de feriados nas configurações do workspace: cadastro manual (feriados
// estaduais, municipais, recesso da empresa) e importação dos nacionais do Brasil.
import { toIsoDate, type IsoDate } from '@ott/shared';
import { CalendarPlus, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCreateHoliday, useDeleteHoliday, useHolidays, useImportHolidays } from '../../data/workspace';
import { Button, IconButton } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { Checkbox, Input } from '../../components/ui/Field';
import { Popover } from '../../components/ui/Popover';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import styles from './Settings.module.css';

export function HolidaysSection({ disabled }: { disabled: boolean }) {
  const t = useT();
  const format = useFormat();
  const { data: holidays = [] } = useHolidays();
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();
  const importHolidays = useImportHolidays();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [date, setDate] = useState<IsoDate>(toIsoDate(new Date()));
  const [name, setName] = useState('');
  const shown = holidays.filter((holiday) => holiday.date.startsWith(String(year)));

  const add = () => {
    if (!name.trim()) return;
    create.mutate({ date, name: name.trim() }, { onSuccess: () => setName('') });
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.settings.holidays}</h2>
      <p className={styles.sectionHint}>{t.settings.holidaysHint}</p>

      <div className={styles.importRow}>
        <div className={styles.yearSwitch}>
          <Button size="sm" variant="ghost" onClick={() => setYear(year - 1)}>
            {year - 1}
          </Button>
          <strong>{year}</strong>
          <Button size="sm" variant="ghost" onClick={() => setYear(year + 1)}>
            {year + 1}
          </Button>
        </div>
        <Button
          size="sm"
          icon={<Download />}
          disabled={disabled}
          loading={importHolidays.isPending}
          onClick={() =>
            importHolidays.mutate(
              { year, includeOptional },
              { onSuccess: (result) => toast.success(t.settings.holidaysImported(result.created)) },
            )
          }
        >
          {t.settings.importHolidays(year)}
        </Button>
        <Checkbox checked={includeOptional} onChange={setIncludeOptional} label={t.settings.includeOptional} disabled={disabled} />
      </div>

      <ul className={styles.holidayList}>
        {shown.map((holiday) => (
          <li key={holiday.id}>
            <span className={styles.holidayDate}>{format.dayLabel(holiday.date)}</span>
            <span className={styles.holidayName}>{holiday.name}</span>
            {!disabled && <IconButton icon={<Trash2 />} label={t.common.remove} size="sm" onClick={() => remove.mutate(holiday.id)} />}
          </li>
        ))}
        {shown.length === 0 && <li className={styles.empty}>{t.settings.noHolidays}</li>}
      </ul>

      {!disabled && (
        <div className={styles.addHoliday}>
          <Popover
            initialFocus={-1}
            trigger={({ ref, getProps }) => (
              <button ref={ref} type="button" className={styles.dateButton} aria-label={t.settings.holidayDate} {...getProps()}>
                {format.dayLabel(date)}
              </button>
            )}
          >
            {({ close }) => (
              <Calendar
                start={date}
                onSelect={(day) => {
                  setDate(day);
                  setYear(Number(day.slice(0, 4)));
                  close();
                }}
              />
            )}
          </Popover>
          <Input value={name} placeholder={t.settings.holidayName} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} />
          <Button icon={<CalendarPlus />} onClick={add} disabled={!name.trim()} loading={create.isPending}>
            {t.settings.addHoliday}
          </Button>
        </div>
      )}
    </section>
  );
}
