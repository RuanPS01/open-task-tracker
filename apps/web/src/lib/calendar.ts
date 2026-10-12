// Calendário de trabalho do workspace na web: dias úteis da semana mais feriados.
import type { IsoDate, WorkCalendar } from '@ott/shared';
import { useMemo } from 'react';
import { useHolidays } from '../data/workspace';
import { useWorkspace } from '../app/session';

export interface CalendarInfo {
  calendar: WorkCalendar;
  holidayNames: Map<IsoDate, string>;
}

export function useWorkCalendar(): CalendarInfo {
  const workspace = useWorkspace();
  const { data: holidays = [] } = useHolidays();
  return useMemo(() => {
    const holidayNames = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
    return {
      calendar: { workingDays: workspace.workingDays, holidays: new Set(holidayNames.keys()) },
      holidayNames,
    };
  }, [holidays, workspace.workingDays]);
}
