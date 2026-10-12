import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/database';
import { seedDemo } from '../src/seed/demo';

describe('seed de demonstração', () => {
  it('cria dados coerentes sem violar nenhuma regra dos serviços', async () => {
    const db = openDatabase(':memory:');
    await seedDemo(db, '2026-10-14');
    const count = (table: string) => db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n;
    expect(count('users')).toBe(4);
    expect(count('projects')).toBe(4);
    expect(count('tasks')).toBeGreaterThan(25);
    expect(count('task_dependencies')).toBe(18);
    expect(count('time_entries')).toBeGreaterThan(50);
    // Mãe "Design" acompanha as filhas depois da cascata.
    const design = db.get<{ start_date: string; due_date: string }>("SELECT start_date, due_date FROM tasks WHERE name = 'Design'")!;
    expect(design.start_date <= design.due_date).toBe(true);
    db.close();
  });
});
