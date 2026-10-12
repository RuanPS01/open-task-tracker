import type { Tag } from '@ott/shared';
import { nowIso, type Db } from '../../db/database';

interface TagRow {
  id: number;
  workspace_id: number;
  name: string;
  created_at: string;
}

const toTag = (row: TagRow): Tag => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  createdAt: row.created_at,
});

export function listTags(db: Db, workspaceId: number): Tag[] {
  return db
    .all<TagRow>('SELECT * FROM tags WHERE workspace_id = ? ORDER BY name COLLATE NOCASE', workspaceId)
    .map(toTag);
}

export function getTag(db: Db, workspaceId: number, id: number): Tag | null {
  const row = db.get<TagRow>('SELECT * FROM tags WHERE workspace_id = ? AND id = ?', workspaceId, id);
  return row ? toTag(row) : null;
}

export function findTagByName(db: Db, workspaceId: number, name: string): Tag | null {
  const row = db.get<TagRow>('SELECT * FROM tags WHERE workspace_id = ? AND name = ?', workspaceId, name);
  return row ? toTag(row) : null;
}

export function insertTag(db: Db, workspaceId: number, name: string): number {
  return db.run('INSERT INTO tags (workspace_id, name, created_at) VALUES (?, ?, ?)', workspaceId, name, nowIso())
    .lastInsertRowid;
}

export function renameTag(db: Db, workspaceId: number, id: number, name: string): void {
  db.run('UPDATE tags SET name = ? WHERE id = ? AND workspace_id = ?', name, id, workspaceId);
}

export function deleteTag(db: Db, workspaceId: number, id: number): void {
  db.run('DELETE FROM tags WHERE id = ? AND workspace_id = ?', id, workspaceId);
}

export function tagIdsOf(db: Db, workspaceId: number): Set<number> {
  return new Set(
    db.all<{ id: number }>('SELECT id FROM tags WHERE workspace_id = ?', workspaceId).map((row) => row.id),
  );
}
