// Formatação ciente do idioma e das preferências do usuário.
// Não usamos Intl.DateTimeFormat.formatRange: ele gera meia-risca entre as datas,
// caractere proibido pela regra 3 de docs/00-regras-para-ia.md.
import {
  formatDuration,
  formatHoursCompact,
  fromIsoDate,
  isoWeekNumber,
  toIsoDate,
  type Currency,
  type IsoDate,
} from '@ott/shared';
import { useMemo } from 'react';
import { usePreferences } from '../app/session';
import { useLocale, useT } from '../i18n';

const clean = (text: string) => text.replace(/\./g, '').trim();

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return value.length === 10 ? fromIsoDate(value) : new Date(value);
}

export function createFormatters(locale: string, timeFormat: '24h' | '12h', durationFormat: 'improved' | 'classic' | 'decimal') {
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' });
  const monthLong = new Intl.DateTimeFormat(locale, { month: 'long' });
  const yearMonth = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const time = new Intl.DateTimeFormat(locale, {
    hour: timeFormat === '12h' ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  });
  const hourOnly = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    hour12: timeFormat === '12h',
    ...(timeFormat === '24h' ? { minute: '2-digit' } : {}),
  });
  const full = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const isEn = locale.startsWith('en');

  return {
    weekdayShort: (value: Date | string) => clean(weekdayShort.format(toDate(value))).replace(/^\w/, (c) => c.toUpperCase()),
    weekdayLong: (value: Date | string) => weekdayLong.format(toDate(value)).replace(/^\w/, (c) => c.toUpperCase()),
    monthShort: (value: Date | string) => clean(monthShort.format(toDate(value))).replace(/^\w/, (c) => c.toUpperCase()),
    monthLong: (value: Date | string) => monthLong.format(toDate(value)).replace(/^\w/, (c) => c.toUpperCase()),
    yearMonth: (value: Date | string) => yearMonth.format(toDate(value)).replace(/^\w/, (c) => c.toUpperCase()),
    /** "12 out" ou "Oct 12". */
    dayMonth: (value: Date | string) => {
      const date = toDate(value);
      const month = clean(monthShort.format(date));
      return isEn ? `${month.replace(/^\w/, (c) => c.toUpperCase())} ${date.getDate()}` : `${date.getDate()} ${month}`;
    },
    /** "Seg, 12 out" ou "Mon, Oct 12". */
    dayLabel: (value: Date | string) => {
      const date = toDate(value);
      const weekday = clean(weekdayShort.format(date)).replace(/^\w/, (c) => c.toUpperCase());
      const month = clean(monthShort.format(date));
      return isEn
        ? `${weekday}, ${month.replace(/^\w/, (c) => c.toUpperCase())} ${date.getDate()}`
        : `${weekday}, ${date.getDate()} ${month}`;
    },
    fullDate: (value: Date | string) => clean(full.format(toDate(value))),
    time: (value: Date | string) => time.format(toDate(value)),
    hour: (value: Date) => hourOnly.format(value),
    duration: (seconds: number) => formatDuration(seconds, durationFormat, locale),
    hours: (seconds: number) => formatHoursCompact(seconds),
    money: (value: number, currency: Currency) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value),
    percent: (value: number) => `${Math.round(value)}%`,
    number: (value: number, digits = 0) =>
      value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    week: (iso: IsoDate) => isoWeekNumber(iso),
    /** Intervalo de datas sem meia-risca: "12 out - 18 out". */
    range: (start: Date | string, end: Date | string) => {
      const a = toDate(start);
      const b = toDate(end);
      const one = (date: Date) => {
        const month = clean(monthShort.format(date));
        return isEn ? `${month.replace(/^\w/, (c) => c.toUpperCase())} ${date.getDate()}` : `${date.getDate()} ${month}`;
      };
      if (toIsoDate(a) === toIsoDate(b)) return one(a);
      const sameYear = a.getFullYear() === b.getFullYear();
      const suffix = sameYear && a.getFullYear() === new Date().getFullYear() ? '' : `, ${b.getFullYear()}`;
      return `${one(a)} - ${one(b)}${suffix}`;
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;

export function useFormat(): Formatters {
  const locale = useLocale();
  const prefs = usePreferences();
  return useMemo(
    () => createFormatters(locale, prefs.timeFormat, prefs.durationFormat),
    [locale, prefs.timeFormat, prefs.durationFormat],
  );
}

/** Mensagem traduzida para um erro da API (ou genérica). */
export function useErrorMessage(): (error: unknown) => string {
  const t = useT();
  return (error: unknown) => {
    const code = (error as { code?: string } | null)?.code;
    if (code && code in t.errors) return t.errors[code as keyof typeof t.errors];
    return t.errors.UNKNOWN;
  };
}
