import type { Holiday, IsoDate } from '@ott/shared';
import { nowIso, type Db } from '../../db/database';

interface HolidayRow {
  id: number;
  workspace_id: number;
  date: string;
  name: string;
}

const toHoliday = (row: HolidayRow): Holiday => ({ id: row.id, workspaceId: row.workspace_id, date: row.date, name: row.name });

export function listHolidays(db: Db, workspaceId: number): Holiday[] {
  return db.all<HolidayRow>('SELECT * FROM holidays WHERE workspace_id = ? ORDER BY date', workspaceId).map(toHoliday);
}

export function holidayDates(db: Db, workspaceId: number): Set<IsoDate> {
  return new Set(
    db.all<{ date: string }>('SELECT date FROM holidays WHERE workspace_id = ?', workspaceId).map((row) => row.date),
  );
}

export function getHoliday(db: Db, workspaceId: number, id: number): Holiday | null {
  const row = db.get<HolidayRow>('SELECT * FROM holidays WHERE workspace_id = ? AND id = ?', workspaceId, id);
  return row ? toHoliday(row) : null;
}

/** Insere se a data ainda não tem feriado; devolve se inseriu. */
export function insertHoliday(db: Db, workspaceId: number, date: IsoDate, name: string): boolean {
  return (
    db.run(
      'INSERT OR IGNORE INTO holidays (workspace_id, date, name, created_at) VALUES (?, ?, ?, ?)',
      workspaceId,
      date,
      name,
      nowIso(),
    ).changes > 0
  );
}

export function deleteHoliday(db: Db, workspaceId: number, id: number): void {
  db.run('DELETE FROM holidays WHERE workspace_id = ? AND id = ?', workspaceId, id);
}
