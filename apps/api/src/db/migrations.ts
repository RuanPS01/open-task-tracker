// Migrações do banco, aplicadas em ordem na partida da API.
// Regras: nunca edite uma migração já publicada; crie a próxima versão.
// Mudou o esquema? Atualize docs/06-dados-e-api.md no mesmo trabalho.
import type { Db } from './database';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'esquema inicial',
    sql: `
      CREATE TABLE workspaces (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BRL',
        default_hourly_rate REAL,
        working_days TEXT NOT NULL DEFAULT '1,2,3,4,5',
        auto_schedule INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        current_workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
        preferences TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);

      CREATE TABLE workspace_members (
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
        weekly_capacity_hours REAL NOT NULL DEFAULT 40,
        hourly_rate REAL,
        active INTEGER NOT NULL DEFAULT 1,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, user_id)
      );

      CREATE TABLE clients (
        id INTEGER PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, name)
      );

      CREATE TABLE tags (
        id INTEGER PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, name)
      );

      CREATE TABLE projects (
        id INTEGER PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        billable INTEGER NOT NULL DEFAULT 0,
        estimate_seconds INTEGER,
        hourly_rate REAL,
        start_date TEXT,
        end_date TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX projects_workspace ON projects(workspace_id);

      CREATE TABLE project_pins (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, project_id)
      );

      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4),
        start_date TEXT,
        due_date TEXT,
        estimate_seconds INTEGER,
        estimate_mode TEXT NOT NULL DEFAULT 'total' CHECK (estimate_mode IN ('total', 'per_day')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        is_milestone INTEGER NOT NULL DEFAULT 0,
        billable INTEGER NOT NULL DEFAULT 0,
        position REAL NOT NULL DEFAULT 0,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX tasks_workspace_project ON tasks(workspace_id, project_id);
      CREATE INDEX tasks_parent ON tasks(parent_id);

      CREATE TABLE task_assignees (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, user_id)
      );
      CREATE INDEX task_assignees_user ON task_assignees(user_id);

      CREATE TABLE task_tags (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, tag_id)
      );

      CREATE TABLE task_dependencies (
        id INTEGER PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        successor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'FS' CHECK (type IN ('FS', 'SS', 'FF', 'SF')),
        lag_days INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE (predecessor_id, successor_id)
      );
      CREATE INDEX task_dependencies_workspace ON task_dependencies(workspace_id);

      CREATE TABLE time_entries (
        id INTEGER PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        description TEXT NOT NULL DEFAULT '',
        start TEXT NOT NULL,
        stop TEXT,
        billable INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX time_entries_workspace_start ON time_entries(workspace_id, start);
      CREATE INDEX time_entries_user_start ON time_entries(user_id, start);
      CREATE INDEX time_entries_project ON time_entries(project_id);
      CREATE INDEX time_entries_task ON time_entries(task_id);
      -- Garante no banco a regra do Toggl: no máximo um cronômetro rodando por pessoa.
      CREATE UNIQUE INDEX time_entries_one_running ON time_entries(user_id) WHERE stop IS NULL;

      CREATE TABLE time_entry_tags (
        time_entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (time_entry_id, tag_id)
      );
    `,
  },
  {
    version: 2,
    name: 'feriados e tarefas em dias não úteis',
    sql: `
      ALTER TABLE tasks ADD COLUMN allow_non_working_days INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE holidays (
        id INTEGER PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, date)
      );
    `,
  },
];

export function runMigrations(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    db.all<{ version: number }>('SELECT version FROM schema_migrations').map((row) => row.version),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
}

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;
