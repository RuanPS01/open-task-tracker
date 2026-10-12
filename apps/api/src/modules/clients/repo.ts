import type { Client, CreateClientInput, UpdateClientInput } from '@ott/shared';
import { bool, nowIso, type Db } from '../../db/database';

interface ClientRow {
  id: number;
  workspace_id: number;
  name: string;
  archived: number;
  created_at: string;
  project_count: number;
}

const toClient = (row: ClientRow): Client => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  archived: row.archived === 1,
  projectCount: row.project_count,
  createdAt: row.created_at,
});

const SELECT = `SELECT c.*,
  (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id AND p.archived = 0) AS project_count
  FROM clients c`;

export function listClients(db: Db, workspaceId: number): Client[] {
  return db.all<ClientRow>(`${SELECT} WHERE c.workspace_id = ? ORDER BY c.name COLLATE NOCASE`, workspaceId).map(toClient);
}

export function getClient(db: Db, workspaceId: number, id: number): Client | null {
  const row = db.get<ClientRow>(`${SELECT} WHERE c.workspace_id = ? AND c.id = ?`, workspaceId, id);
  return row ? toClient(row) : null;
}

export function findClientByName(db: Db, workspaceId: number, name: string): Client | null {
  const row = db.get<ClientRow>(
    `${SELECT} WHERE c.workspace_id = ? AND c.name = ? COLLATE NOCASE`,
    workspaceId,
    name,
  );
  return row ? toClient(row) : null;
}

export function insertClient(db: Db, workspaceId: number, input: CreateClientInput): number {
  return db.run(
    'INSERT INTO clients (workspace_id, name, created_at) VALUES (?, ?, ?)',
    workspaceId,
    input.name,
    nowIso(),
  ).lastInsertRowid;
}

export function updateClient(db: Db, workspaceId: number, id: number, input: UpdateClientInput): void {
  if (input.name !== undefined) {
    db.run('UPDATE clients SET name = ? WHERE id = ? AND workspace_id = ?', input.name, id, workspaceId);
  }
  if (input.archived !== undefined) {
    db.run(
      'UPDATE clients SET archived = ? WHERE id = ? AND workspace_id = ?',
      bool(input.archived),
      id,
      workspaceId,
    );
  }
}

export function deleteClient(db: Db, workspaceId: number, id: number): void {
  db.run('DELETE FROM clients WHERE id = ? AND workspace_id = ?', id, workspaceId);
}
