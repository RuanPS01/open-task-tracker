// Importação de várias tarefas de uma vez a partir de um JSON (formato em
// taskImportFileSchema, @ott/shared). A mesma montagem serve para a prévia (revisão na
// tela, sem gravar nada) e para a importação: o arquivo é validado, nomes viram ids
// (projeto, responsáveis, tags, dependências), a cascata e o resumo das tarefas-mãe
// rodam em memória e só então tudo é gravado num lote.
import {
  addWorkdays,
  calendarFor,
  IMPORT_MAX_TASKS,
  PRIORITY_KEYS,
  taskImportFileSchema,
  validateDependency,
  type DependencyType,
  type Id,
  type ImportTaskInput,
  type Priority,
  type SchedulableDependency,
  type TaskImportIssue,
  type TaskImportPreview,
  type TaskImportResult,
  type TaskImportRow,
} from '@ott/shared';
import { AppError } from '../errors';
import { paths, type DependencyDoc, type MemberDoc, type ProjectDoc, type TagDoc, type TaskDoc } from '../store/schema';
import { Batch } from '../store/types';
import { loadWorkspace, nowIso, type Ctx } from './context';
import {
  applyScheduling,
  cloneTasks,
  listDependencyDocs,
  listTaskDocs,
  loadCalendar,
  nextPosition,
  normalizeDates,
  toSchedulable,
  writeChanges,
} from './tasks';

export interface TaskImportOptions {
  /** Projeto de quem importa pelo Gantt: vale para as tarefas sem projeto no arquivo. */
  defaultProjectId?: Id | null;
}

/** Compara nomes sem diferenciar maiúsculas, acentos e espaços nas pontas. */
const nameKey = (value: string) =>
  value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const PRIORITY_BY_NAME = new Map(
  (Object.entries(PRIORITY_KEYS) as [string, string][]).map(([value, key]) => [key, Number(value) as Priority]),
);

interface Planned {
  key: string;
  parentKey: string | null;
  depth: number;
  path: string;
  node: ImportTaskInput;
  doc: TaskDoc;
  /** Datas como vieram do arquivo (depois de duração e marco), para marcar o que a cascata mudou. */
  givenStart: string | null;
  givenDue: string | null;
  tagNames: string[];
  dependencies: { name: string; type: DependencyType; lagDays: number }[];
}

interface Plan {
  preview: TaskImportPreview;
  batch: Batch;
  created: TaskDoc[];
}

function schemaIssues(error: { issues: readonly { code: string; path: readonly PropertyKey[]; message: string }[] }): TaskImportIssue[] {
  return error.issues.slice(0, 50).map((issue) => {
    const path = issue.path
      .map((part, index) => (typeof part === 'number' ? `[${part}]` : index === 0 ? String(part) : `.${String(part)}`))
      .join('');
    const code =
      issue.code === 'invalid_type' && /undefined/.test(issue.message)
        ? 'SCHEMA_REQUIRED'
        : issue.code === 'invalid_type'
          ? 'SCHEMA_TYPE'
          : issue.code === 'too_small' || issue.code === 'too_big'
            ? 'SCHEMA_RANGE'
            : issue.code === 'invalid_value' || issue.code === 'invalid_union'
              ? 'SCHEMA_VALUE'
              : issue.code === 'custom'
                ? 'SCHEMA_DATE'
                : 'SCHEMA_OTHER';
    return { level: 'error', code, path: path || '(raiz)', taskKey: null, params: {} };
  });
}

const emptyPreview = (issues: TaskImportIssue[]): Plan => ({
  preview: { rows: [], issues, newTags: [], dependencyCount: 0, canImport: false },
  batch: new Batch(),
  created: [],
});

async function buildPlan(ctx: Ctx, workspaceId: Id, text: string, options: TaskImportOptions): Promise<Plan> {
  const { uid, doc: workspace } = await loadWorkspace(ctx, workspaceId);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return emptyPreview([
      { level: 'error', code: 'INVALID_JSON', path: '', taskKey: null, params: { message: (error as Error).message } },
    ]);
  }
  const parsed = taskImportFileSchema.safeParse(Array.isArray(raw) ? { tasks: raw } : raw);
  if (!parsed.success) return emptyPreview(schemaIssues(parsed.error));
  const file = parsed.data;

  const [projects, members, tags, existingTasks, existingDeps, calendar] = await Promise.all([
    ctx.store.list<ProjectDoc>(paths.projects(workspaceId)),
    ctx.store.list<MemberDoc>(paths.members(workspaceId)),
    ctx.store.list<TagDoc>(paths.tags(workspaceId)),
    listTaskDocs(ctx, workspaceId),
    listDependencyDocs(ctx, workspaceId),
    loadCalendar(ctx, workspace),
  ]);
  const defaultProjectId = options.defaultProjectId ?? null;
  if (defaultProjectId && !projects.some((project) => project.id === defaultProjectId)) {
    throw new AppError('NOT_FOUND', 'Projeto não encontrado');
  }

  const issues: TaskImportIssue[] = [];
  const add = (level: TaskImportIssue['level'], code: string, item: Planned | null, params: TaskImportIssue['params'] = {}, path?: string) =>
    issues.push({ level, code, path: path ?? item?.path ?? '', taskKey: item?.key ?? null, params });

  // Árvore achatada: 1, 1.1, 1.2, 2...
  const flat: Omit<Planned, 'doc' | 'givenStart' | 'givenDue' | 'tagNames' | 'dependencies'>[] = [];
  const walk = (nodes: readonly ImportTaskInput[], parentKey: string | null, path: string, depth: number) => {
    nodes.forEach((node, index) => {
      const key = parentKey ? `${parentKey}.${index + 1}` : String(index + 1);
      const nodePath = `${path}[${index}]`;
      flat.push({ key, parentKey, depth, path: nodePath, node });
      if (node.subtasks?.length) walk(node.subtasks, key, `${nodePath}.subtasks`, depth + 1);
    });
  };
  walk(file.tasks, null, 'tasks', 0);
  if (flat.length === 0) return emptyPreview([{ level: 'error', code: 'EMPTY', path: 'tasks', taskKey: null, params: {} }]);
  if (flat.length > IMPORT_MAX_TASKS) {
    return emptyPreview([{ level: 'error', code: 'TOO_MANY', path: 'tasks', taskKey: null, params: { max: IMPORT_MAX_TASKS } }]);
  }

  const projectByName = new Map<string, ProjectDoc>();
  for (const project of projects) projectByName.set(nameKey(project.name), project);
  const memberByKey = new Map<string, MemberDoc>();
  for (const member of members) {
    memberByKey.set(member.email.toLowerCase(), member);
    if (!memberByKey.has(nameKey(member.name))) memberByKey.set(nameKey(member.name), member);
  }
  const tagByName = new Map(tags.map((tag) => [nameKey(tag.name), tag]));
  const newTags = new Map<string, TagDoc>();
  const now = nowIso(ctx);

  const planned: Planned[] = [];
  const byKey = new Map<string, Planned>();
  const refs = new Map<string, Planned>();
  let rootPosition = nextPosition(existingTasks, null) - 1;

  for (const entry of flat) {
    const { node } = entry;
    const parent = entry.parentKey ? byKey.get(entry.parentKey)! : null;
    const item = entry as Planned;

    // Projeto: subtarefa herda da mãe; senão o do item, o do arquivo ou o da tela.
    let projectId: Id | null;
    if (parent) {
      projectId = parent.doc.projectId;
      if (node.project && projectByName.get(nameKey(node.project))?.id !== projectId) {
        add('warning', 'SUBTASK_PROJECT_IGNORED', item, { name: node.project });
      }
    } else {
      const projectName = node.project ?? file.project ?? null;
      if (projectName) {
        const project = projectByName.get(nameKey(projectName));
        if (!project) add('error', 'UNKNOWN_PROJECT', item, { name: projectName });
        projectId = project?.id ?? null;
      } else {
        projectId = defaultProjectId;
      }
    }

    const assigneeIds: Id[] = [];
    for (const name of node.assignees ?? []) {
      const member = memberByKey.get(name.trim().toLowerCase()) ?? memberByKey.get(nameKey(name));
      if (!member) add('warning', 'UNKNOWN_ASSIGNEE', item, { name });
      else if (!assigneeIds.includes(member.userId)) assigneeIds.push(member.userId);
    }

    const tagIds: Id[] = [];
    const tagNames: string[] = [];
    for (const name of node.tags ?? []) {
      const key = nameKey(name);
      let tag = tagByName.get(key) ?? newTags.get(key);
      if (!tag) {
        tag = { id: ctx.store.newId(), workspaceId, name: name.trim(), createdAt: now };
        newTags.set(key, tag);
      }
      if (!tagIds.includes(tag.id)) {
        tagIds.push(tag.id);
        tagNames.push(tag.name);
      }
    }

    const isMilestone = node.milestone ?? false;
    const allowNonWorkingDays = node.allowNonWorkingDays ?? false;
    let startDate = node.startDate ?? null;
    let dueDate = node.dueDate ?? null;
    if (node.durationDays != null) {
      if (dueDate) add('warning', 'DUE_OVERRIDES_DURATION', item);
      else if (startDate) dueDate = addWorkdays(startDate, node.durationDays - 1, calendarFor({ allowNonWorkingDays }, calendar));
      else add('warning', 'DURATION_WITHOUT_START', item);
    }
    try {
      ({ startDate, dueDate } = normalizeDates(startDate, dueDate, isMilestone));
    } catch {
      add('error', 'INVALID_DATES', item, { start: startDate ?? '', due: dueDate ?? '' });
    }

    const priority: Priority =
      typeof node.priority === 'string' ? (PRIORITY_BY_NAME.get(node.priority) ?? 0) : (node.priority ?? 0);
    const status = node.status ?? 'todo';
    const doc: TaskDoc = {
      id: ctx.store.newId(),
      workspaceId,
      projectId,
      parentId: parent ? parent.doc.id : null,
      name: node.name,
      description: node.description ?? '',
      notes: node.notes ?? '',
      status,
      priority,
      startDate,
      dueDate,
      estimateSeconds: node.estimateHours == null ? null : Math.round(node.estimateHours * 3600),
      estimateMode: node.estimateMode ?? 'total',
      progress: status === 'done' ? 100 : (node.progress ?? 0),
      isMilestone,
      allowNonWorkingDays,
      billable: node.billable ?? false,
      position: parent ? Number(entry.key.split('.').pop()) : (rootPosition += 1),
      assigneeIds,
      tagIds,
      trackedSeconds: 0,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'done' ? now : null,
    };
    Object.assign(item, { doc, givenStart: startDate, givenDue: dueDate, tagNames, dependencies: [] });
    planned.push(item);
    byKey.set(item.key, item);
    if (node.ref) {
      if (refs.has(node.ref)) add('error', 'DUPLICATE_REF', item, { ref: node.ref }, `${item.path}.ref`);
      else refs.set(node.ref, item);
    }
  }

  // Dependências: "dependsOn" aponta as predecessoras, por ref do arquivo ou pelo nome
  // de uma tarefa que já existe (no mesmo projeto, quando a tarefa tem projeto).
  const schedulable = [...existingTasks.map(toSchedulable), ...planned.map((item) => toSchedulable(item.doc))];
  const accepted: SchedulableDependency[] = [...existingDeps];
  const newDependencies: DependencyDoc[] = [];
  for (const item of planned) {
    (item.node.dependsOn ?? []).forEach((entry, index) => {
      const target = typeof entry === 'string' ? entry : entry.task;
      const type = (typeof entry === 'string' ? null : entry.type) ?? 'FS';
      const lagDays = (typeof entry === 'string' ? null : entry.lagDays) ?? 0;
      const path = `${item.path}.dependsOn[${index}]`;
      let predecessor: { id: Id; name: string } | null = null;
      const fromFile = refs.get(target);
      if (fromFile) {
        predecessor = { id: fromFile.doc.id, name: fromFile.doc.name };
      } else {
        const matches = existingTasks.filter(
          (task) => nameKey(task.name) === nameKey(target) && (item.doc.projectId === null || task.projectId === item.doc.projectId),
        );
        if (matches.length === 1) predecessor = { id: matches[0]!.id, name: matches[0]!.name };
        else add('error', matches.length > 1 ? 'AMBIGUOUS_DEPENDENCY' : 'UNKNOWN_DEPENDENCY', item, { name: target }, path);
      }
      if (!predecessor) return;
      const candidate = { predecessorId: predecessor.id, successorId: item.doc.id, type, lagDays };
      const rejection = validateDependency(schedulable, accepted, candidate);
      if (rejection === 'duplicate') {
        // A mesma ligação repetida só é ignorada; a ligação invertida é contradição (ciclo).
        const same = accepted.some((dep) => dep.predecessorId === candidate.predecessorId && dep.successorId === candidate.successorId);
        add(same ? 'warning' : 'error', same ? 'DEPENDENCY_DUPLICATE' : 'DEPENDENCY_CYCLE', item, { name: predecessor.name }, path);
        return;
      }
      if (rejection) {
        add('error', `DEPENDENCY_${rejection.toUpperCase()}`, item, { name: predecessor.name }, path);
        return;
      }
      accepted.push(candidate);
      newDependencies.push({ id: ctx.store.newId(), workspaceId, ...candidate, createdAt: now });
      item.dependencies.push({ name: predecessor.name, type, lagDays });
    });
  }

  // Cronograma final: cascata (se ligada) e resumo das mães, sobre todas as tarefas.
  const original = new Map(existingTasks.map((task) => [task.id, task]));
  const working = cloneTasks(existingTasks);
  for (const item of planned) working.set(item.doc.id, item.doc);
  applyScheduling(working, accepted, calendar, workspace.autoSchedule, now);

  const rows: TaskImportRow[] = planned.map((item) => {
    const doc = working.get(item.doc.id)!;
    return {
      key: item.key,
      parentKey: item.parentKey,
      depth: item.depth,
      name: doc.name,
      description: doc.description,
      projectId: doc.projectId,
      startDate: doc.startDate,
      dueDate: doc.dueDate,
      // Só conta como ajuste quando o arquivo trouxe datas; a mãe sem datas só recebe o resumo.
      rescheduled:
        (item.givenStart !== null || item.givenDue !== null) && (doc.startDate !== item.givenStart || doc.dueDate !== item.givenDue),
      estimateSeconds: doc.estimateSeconds,
      estimateMode: doc.estimateMode,
      priority: doc.priority,
      status: doc.status,
      progress: doc.progress,
      isMilestone: doc.isMilestone,
      allowNonWorkingDays: doc.allowNonWorkingDays,
      billable: doc.billable,
      assigneeIds: doc.assigneeIds,
      tagNames: item.tagNames,
      dependencies: item.dependencies,
    };
  });

  const batch = new Batch();
  for (const tag of newTags.values()) batch.set(paths.tags(workspaceId), tag.id, tag);
  writeChanges(batch, workspaceId, original, working, now);
  for (const dep of newDependencies) batch.set(paths.dependencies(workspaceId), dep.id, dep);

  // Erros antes dos avisos; dentro de cada nível, os do arquivo primeiro e depois na ordem das tarefas.
  const order = new Map(planned.map((item, index) => [item.key, index]));
  const rank = (issue: TaskImportIssue) => (issue.taskKey === null ? -1 : (order.get(issue.taskKey) ?? -1));
  issues.sort((a, b) => (a.level === b.level ? rank(a) - rank(b) : a.level === 'error' ? -1 : 1));
  return {
    preview: {
      rows,
      issues,
      newTags: [...newTags.values()].map((tag) => tag.name),
      dependencyCount: newDependencies.length,
      canImport: !issues.some((issue) => issue.level === 'error'),
    },
    batch,
    created: planned.map((item) => working.get(item.doc.id)!),
  };
}

/** Revisão: o que a importação faria, sem gravar nada. */
export async function previewTaskImport(
  ctx: Ctx,
  workspaceId: Id,
  text: string,
  options: TaskImportOptions = {},
): Promise<TaskImportPreview> {
  return (await buildPlan(ctx, workspaceId, text, options)).preview;
}

/** Importa de verdade. Monta tudo de novo (os dados podem ter mudado desde a revisão). */
export async function importTasks(
  ctx: Ctx,
  workspaceId: Id,
  text: string,
  options: TaskImportOptions = {},
): Promise<TaskImportResult> {
  const plan = await buildPlan(ctx, workspaceId, text, options);
  if (!plan.preview.canImport) {
    throw new AppError('IMPORT_INVALID', 'O arquivo tem erros', plan.preview.issues);
  }
  await ctx.store.commit(plan.batch.ops);
  return { created: plan.created.length, tasks: plan.created };
}
