// Campos de hora e de duração que aceitam digitação livre, como no Toggl
// ("930" vira 09:30, "1h30" vira 1:30:00). O valor só é aplicado ao sair do campo.
import { parseDuration } from '@ott/shared';
import clsx from 'clsx';
import { useEffect, useState, type InputHTMLAttributes } from 'react';
import styles from './TimeInputs.module.css';

/** Interpreta "9", "930", "9:30", "21:30", "9:30pm". Devolve [hora, minuto] ou null. */
export function parseClockTime(input: string): [number, number] | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  const match = /^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3];
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return [hour, minute];
}

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>;

export function TimeInput({
  value,
  display,
  onCommit,
  className,
  ...rest
}: BaseProps & { value: Date; display: string; onCommit: (date: Date) => void }) {
  const [text, setText] = useState(display);
  useEffect(() => setText(display), [display]);
  const commit = () => {
    const parsed = parseClockTime(text);
    if (!parsed) {
      setText(display);
      return;
    }
    const next = new Date(value);
    next.setHours(parsed[0], parsed[1], 0, 0);
    if (next.getTime() !== value.getTime()) onCommit(next);
    else setText(display);
  };
  return (
    <input
      className={clsx(styles.input, className)}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') setText(display);
      }}
      {...rest}
    />
  );
}

export function DurationInput({
  seconds,
  display,
  onCommit,
  bareNumberUnit = 'minutes',
  className,
  allowEmpty = false,
  ...rest
}: BaseProps & {
  seconds: number | null;
  display: string;
  onCommit: (seconds: number | null) => void;
  bareNumberUnit?: 'minutes' | 'hours';
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(display);
  useEffect(() => setText(display), [display]);
  const commit = () => {
    if (allowEmpty && text.trim() === '') {
      if (seconds !== null) onCommit(null);
      return;
    }
    const parsed = parseDuration(text, { bareNumberUnit });
    if (parsed === null) {
      setText(display);
      return;
    }
    if (parsed !== seconds) onCommit(parsed);
    else setText(display);
  };
  return (
    <input
      className={clsx(styles.input, className)}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') setText(display);
      }}
      {...rest}
    />
  );
}
