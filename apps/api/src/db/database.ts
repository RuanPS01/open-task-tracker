// Acesso ao SQLite pelo módulo nativo node:sqlite (sem dependência nativa para compilar).
// Toda consulta passa por esta classe para ter cache de statements e transação
// com savepoint, que o node:sqlite não oferece pronto.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { runMigrations } from './migrations';

export type SqlParam = SQLInputValue;

export class Db {
  private readonly statements = new Map<string, StatementSync>();
  private transactionDepth = 0;

  constructor(readonly raw: DatabaseSync) {}

  private prepare(sql: string): StatementSync {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.raw.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }

  all<T>(sql: string, ...params: SqlParam[]): T[] {
    return this.prepare(sql).all(...params) as T[];
  }

  get<T>(sql: string, ...params: SqlParam[]): T | undefined {
    return this.prepare(sql).get(...params) as T | undefined;
  }

  run(sql: string, ...params: SqlParam[]): { changes: number; lastInsertRowid: number } {
    const result = this.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /**
   * Executa `fn` numa transação. Chamadas aninhadas viram savepoints, então um serviço
   * pode chamar outro sem se preocupar se já existe transação aberta.
   */
  transaction<T>(fn: () => T): T {
    const depth = this.transactionDepth;
    const savepoint = `sp_${depth}`;
    this.raw.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    this.transactionDepth += 1;
    try {
      const result = fn();
      this.raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
      throw error;
    } finally {
      this.transactionDepth = depth;
    }
  }

  close(): void {
    this.statements.clear();
    this.raw.close();
  }
}

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec('PRAGMA busy_timeout = 5000');
  if (path !== ':memory:') raw.exec('PRAGMA journal_mode = WAL');
  const db = new Db(raw);
  runMigrations(db);
  return db;
}

/** Converte booleano para o inteiro que o SQLite guarda (node:sqlite não aceita boolean). */
export const bool = (value: boolean) => (value ? 1 : 0);

export const nowIso = () => new Date().toISOString();

/** Lista "1,2,3" vinda de GROUP_CONCAT para array de números. */
export function idList(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
}
