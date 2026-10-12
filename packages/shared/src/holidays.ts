// Feriados nacionais do Brasil, usados no botão "Importar feriados nacionais".
// Feriados estaduais e municipais variam por cidade: entram pelo cadastro manual.
import { addDays } from './dates';
import type { IsoDate } from './entities';

export interface HolidaySeed {
  date: IsoDate;
  name: string;
  /** Ponto facultativo (Carnaval, Corpus Christi): só entra se pedido. */
  optional: boolean;
}

/** Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function brazilianHolidays(year: number, includeOptional = false): HolidaySeed[] {
  const easter = easterSunday(year);
  const fixed = (monthDay: string, name: string): HolidaySeed => ({ date: `${year}-${monthDay}`, name, optional: false });
  const list: HolidaySeed[] = [
    fixed('01-01', 'Confraternização Universal'),
    { date: addDays(easter, -48), name: 'Carnaval', optional: true },
    { date: addDays(easter, -47), name: 'Carnaval', optional: true },
    { date: addDays(easter, -2), name: 'Sexta-feira Santa', optional: false },
    fixed('04-21', 'Tiradentes'),
    fixed('05-01', 'Dia do Trabalho'),
    { date: addDays(easter, 60), name: 'Corpus Christi', optional: true },
    fixed('09-07', 'Independência do Brasil'),
    fixed('10-12', 'Nossa Senhora Aparecida'),
    fixed('11-02', 'Finados'),
    fixed('11-15', 'Proclamação da República'),
    // Feriado nacional desde 2024 (Lei 14.759/2023).
    ...(year >= 2024 ? [fixed('11-20', 'Dia Nacional de Zumbi e da Consciência Negra')] : []),
    fixed('12-25', 'Natal'),
  ];
  return list.filter((holiday) => includeOptional || !holiday.optional);
}
