import type { CustomStatus, Holiday, Member, Project, Task } from '@ott/shared';
import { describe, expect, it } from 'vitest';
import { exampleDates, promptContext } from './taskImportModel';

const WEEK = [1, 2, 3, 4, 5];
const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const weekdayName = (iso: string) => names[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;

describe('datas do exemplo', () => {
  it('começa no próximo dia útil e encadeia as entregas', () => {
    expect(exampleDates('2026-10-16', WEEK)).toEqual({ start: '2026-10-16', second: '2026-10-21', approval: '2026-10-23' });
    expect(exampleDates('2026-10-17', WEEK).start).toBe('2026-10-19');
  });
});

describe('contexto do prompt', () => {
  const project = (id: string, name: string, archived = false) => ({ id, name, archived }) as Project;
  const task = (name: string, projectId: string) => ({ name, projectId }) as Task;

  it('leva dias úteis, feriados futuros, projetos ativos, status e as tarefas do projeto atual', () => {
    const context = promptContext({
      today: '2026-10-14',
      weekdayName,
      workingDays: [5, 1, 2, 3, 4],
      holidays: [
        { id: '2026-10-12', workspaceId: 'w', date: '2026-10-12', name: 'Aparecida' },
        { id: '2026-11-02', workspaceId: 'w', date: '2026-11-02', name: 'Finados' },
      ] as Holiday[],
      autoSchedule: true,
      projects: [project('p1', 'Site'), project('p2', 'Antigo', true)],
      currentProjectId: 'p1',
      members: [
        { name: 'Ana', email: 'ana@exemplo.com', active: true },
        { name: 'Bia', email: 'bia@exemplo.com', active: false },
      ] as Member[],
      tags: [],
      statuses: [
        { id: 's3', name: 'Velho', category: 'todo', projectId: 'p2', position: 1 },
        { id: 's2', name: 'Aguardando cliente', category: 'todo', projectId: 'p1', position: 1 },
        { id: 's1', name: 'Em revisão', category: 'in_progress', projectId: null, position: 1 },
      ] as CustomStatus[],
      tasks: [task('Layout', 'p1'), task('Layout', 'p1'), task('Outro', 'p2')],
      example: '{}',
    });
    expect(context).toMatchObject({
      todayWeekday: 'qua',
      workingDays: 'seg, ter, qua, qui, sex',
      holidays: ['2026-11-02 Finados'],
      projects: ['Site'],
      currentProject: 'Site',
      members: ['Ana <ana@exemplo.com>'],
      existingTasks: ['Layout'],
      // Status de projeto arquivado fica de fora.
      statuses: [
        { name: 'Aguardando cliente', category: 'todo', project: 'Site' },
        { name: 'Em revisão', category: 'in_progress', project: null },
      ],
    });
  });
});
