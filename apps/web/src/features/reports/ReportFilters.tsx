// Linha de filtros dos relatórios: período (com períodos prontos e calendário),
// membros, projetos, clientes, tags, faturável e descrição. Os filtros valem para
// todos os gráficos e tabelas da página.
import type { IsoDate } from '@ott/shared';
import { toIsoDate } from '@ott/shared';
import clsx from 'clsx';
import { Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign, Folder, Hash, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { usePreferences } from '../../app/session';
import pickerStyles from '../../components/pickers/Picker.module.css';
import { IconButton } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { Checkbox } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { Popover } from '../../components/ui/Popover';
import { ChipButton } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { matchPreset, presetRange, PRESETS, shiftRange } from './reportRange';
import styles from './Reports.module.css';

export function DateRangeControl({ start, end, onChange }: { start: IsoDate; end: IsoDate; onChange: (start: IsoDate, end: IsoDate) => void }) {
  const t = useT();
  const format = useFormat();
  const { weekStart } = usePreferences();
  const today = toIsoDate(new Date());
  const preset = matchPreset(start, end, today, weekStart);
  const label = preset ? t.reports.presets[preset] : format.range(start, end);
  const isWeek = preset === 'thisWeek' || preset === 'lastWeek';

  return (
    <div className={styles.range}>
      <IconButton
        icon={<ChevronLeft />}
        label={t.common.previous}
        variant="secondary"
        size="sm"
        onClick={() => {
          const next = shiftRange(start, end, -1);
          onChange(next.start, next.end);
        }}
      />
      <Popover
        initialFocus={-1}
        width={300}
        trigger={({ ref, getProps }) => (
          <ChipButton
            ref={ref}
            icon={<CalendarDays />}
            label={label}
            value={isWeek ? `· ${t.timer.weekShort}${format.week(start)}` : undefined}
            {...getProps()}
          />
        )}
      >
        {({ close }) => (
          <div className={styles.rangePopover}>
            {PRESETS.map((item) => (
              <button
                key={item}
                type="button"
                className={clsx(pickerStyles.option, item === preset && pickerStyles.selected)}
                onClick={() => {
                  const range = presetRange(item, today, weekStart);
                  onChange(range.start, range.end);
                  close();
                }}
              >
                <span className={pickerStyles.optionLabel}>{t.reports.presets[item]}</span>
                {item === preset && <Check size={16} strokeWidth={3} />}
              </button>
            ))}
            <div className={styles.rangeCalendar}>
              <Calendar
                start={start}
                end={end}
                range
                onSelect={(a, b) => {
                  onChange(a, b);
                  close();
                }}
              />
            </div>
          </div>
        )}
      </Popover>
      <IconButton
        icon={<ChevronRight />}
        label={t.common.next}
        variant="secondary"
        size="sm"
        onClick={() => {
          const next = shiftRange(start, end, 1);
          onChange(next.start, next.end);
        }}
      />
    </div>
  );
}

export interface FilterOption {
  id: number;
  label: string;
  marker?: ReactNode;
}

export function MultiFilter({
  icon,
  label,
  options,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  options: FilterOption[];
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const visible = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedLabel =
    value.length === 0 ? undefined : value.length === 1 ? options.find((o) => o.id === value[0])?.label : t.common.selected(value.length);
  return (
    <Popover
      width={280}
      trigger={({ ref, getProps }) => (
        <ChipButton ref={ref} icon={icon} label={selectedLabel ? `${label}:` : label} value={selectedLabel} active={value.length > 0} {...getProps()} />
      )}
    >
      <input className={pickerStyles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.common.search} autoFocus />
      <div className={styles.filterList}>
        {visible.map((option) => (
          <Checkbox
            key={option.id}
            checked={value.includes(option.id)}
            onChange={(checked) => onChange(checked ? [...value, option.id] : value.filter((id) => id !== option.id))}
            label={
              <span className={styles.filterOption}>
                {option.marker}
                {option.label}
              </span>
            }
          />
        ))}
        {visible.length === 0 && <div className={pickerStyles.empty}>{t.common.noResults}</div>}
      </div>
      {value.length > 0 && (
        <button type="button" className={styles.clear} onClick={() => onChange([])}>
          {t.common.clear}
        </button>
      )}
    </Popover>
  );
}

export function BillableFilter({ value, onChange }: { value: 'all' | 'true' | 'false'; onChange: (value: 'all' | 'true' | 'false') => void }) {
  const t = useT();
  const labels = { all: t.reports.billableAll, true: t.reports.billableOnly, false: t.reports.nonBillableOnly };
  return (
    <Menu
      trigger={({ ref, getProps }) => (
        <ChipButton
          ref={ref}
          icon={<CircleDollarSign />}
          label={value === 'all' ? t.reports.billableFilter : `${t.reports.billableFilter}:`}
          value={value === 'all' ? undefined : labels[value]}
          active={value !== 'all'}
          {...getProps()}
        />
      )}
      items={(['all', 'true', 'false'] as const).map((key) => ({ key, label: labels[key], checked: key === value, onSelect: () => onChange(key) }))}
    />
  );
}

export const FILTER_ICONS = { members: <Users />, projects: <Folder />, clients: <Building2 />, tags: <Hash /> };
