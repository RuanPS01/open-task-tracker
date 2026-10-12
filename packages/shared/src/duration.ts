// Formatação e interpretação de durações. Toda duração do sistema é guardada em
// segundos inteiros; estes utilitários só existem na borda (exibição e digitação).
import type { DurationFormat } from './constants';

const pad = (value: number) => String(value).padStart(2, '0');

/** Relógio H:MM:SS, usado no cronômetro e no formato "improved". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}

/**
 * Duração no formato escolhido pelo usuário (mesmas três opções do Toggl):
 * improved 0:47:06, classic 47:06 min (ou 1:47:06 acima de uma hora) e decimal 0,79 h.
 */
export function formatDuration(
  totalSeconds: number,
  format: DurationFormat = 'improved',
  locale = 'pt-BR',
): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (format === 'decimal') {
    const hours = seconds / 3600;
    return `${hours.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
  }
  if (format === 'classic' && seconds < 3600) {
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)} min`;
  }
  return formatClock(seconds);
}

/** Forma curta para capacidade e estimativas: 40h, 7h 30m, 45m. */
export function formatHoursCompact(totalSeconds: number): string {
  const negative = totalSeconds < 0;
  const seconds = Math.round(Math.abs(totalSeconds) / 60) * 60;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  let text: string;
  if (h === 0) text = `${m}m`;
  else if (m === 0) text = `${h}h`;
  else text = `${h}h ${m}m`;
  return negative ? `-${text}` : text;
}

export interface ParseDurationOptions {
  /** Como interpretar um número sem unidade, por exemplo "2". */
  bareNumberUnit?: 'minutes' | 'hours';
}

const UNIT_SECONDS: Record<string, number> = {
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hora: 3600,
  horas: 3600,
  m: 60,
  min: 60,
  mins: 60,
  minuto: 60,
  minutos: 60,
  s: 1,
  seg: 1,
  sec: 1,
};

/**
 * Interpreta o que o usuário digitou num campo de duração. Aceita "1:30", "1:30:15",
 * "1h30", "1h 30m", "1,5h", "90m", "45s" e números sem unidade. Devolve segundos ou
 * null quando o texto não é uma duração.
 */
export function parseDuration(input: string, options: ParseDurationOptions = {}): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (text === '') return null;

  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(text);
  if (clock) {
    const [, h, m, s] = clock;
    if (Number(m) >= 60 || (s !== undefined && Number(s) >= 60)) return null;
    return Number(h) * 3600 + Number(m) * 60 + Number(s ?? 0);
  }

  const bare = /^(\d+(?:[.,]\d+)?)$/.exec(text);
  if (bare) {
    const value = Number(bare[1]!.replace(',', '.'));
    const unit = options.bareNumberUnit === 'hours' ? 3600 : 60;
    return Math.round(value * unit);
  }

  const partPattern = /(\d+(?:[.,]\d+)?)\s*([a-z]+)/g;
  let total = 0;
  let consumed = '';
  let match: RegExpExecArray | null;
  let lastUnit = 0;
  while ((match = partPattern.exec(text)) !== null) {
    const unit = UNIT_SECONDS[match[2]!];
    if (unit === undefined) return null;
    total += Number(match[1]!.replace(',', '.')) * unit;
    consumed += match[0];
    lastUnit = unit;
  }
  // "1h30" deixa um número final sem unidade: vale como a unidade seguinte à última.
  const trailing = /(\d+)$/.exec(text.replace(partPattern, '').trim());
  if (trailing && lastUnit > 1) {
    total += Number(trailing[1]) * (lastUnit === 3600 ? 60 : 1);
    consumed += trailing[0];
  }
  if (consumed.replace(/\s/g, '') !== text.replace(/\s/g, '')) return null;
  return Math.round(total);
}
