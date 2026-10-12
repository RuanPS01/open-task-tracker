import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, formatHoursCompact, parseDuration } from '../src/duration';

describe('formatação de duração', () => {
  it('mostra o relógio do cronômetro', () => {
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00:00');
  });

  it('respeita os três formatos do Toggl', () => {
    expect(formatDuration(2826, 'improved')).toBe('0:47:06');
    expect(formatDuration(2826, 'classic')).toBe('47:06 min');
    expect(formatDuration(6426, 'classic')).toBe('1:47:06');
    expect(formatDuration(2844, 'decimal', 'pt-BR')).toBe('0,79 h');
    expect(formatDuration(2844, 'decimal', 'en')).toBe('0.79 h');
  });

  it('usa forma compacta para capacidade', () => {
    expect(formatHoursCompact(40 * 3600)).toBe('40h');
    expect(formatHoursCompact(7.5 * 3600)).toBe('7h 30m');
    expect(formatHoursCompact(45 * 60)).toBe('45m');
    expect(formatHoursCompact(-2 * 3600)).toBe('-2h');
  });
});

describe('interpretação de duração digitada', () => {
  it.each([
    ['1:30', 5400],
    ['1:30:15', 5415],
    ['1h', 3600],
    ['1h30', 5400],
    ['1h 30m', 5400],
    ['1,5h', 5400],
    ['1.5 h', 5400],
    ['90m', 5400],
    ['90 min', 5400],
    ['45s', 45],
    ['2 horas', 7200],
  ])('%s vira %i segundos', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it('interpreta número sem unidade conforme a opção', () => {
    expect(parseDuration('30')).toBe(1800);
    expect(parseDuration('3', { bareNumberUnit: 'hours' })).toBe(10800);
  });

  it('recusa texto que não é duração', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('1:75')).toBeNull();
    expect(parseDuration('2 dias')).toBeNull();
  });
});
