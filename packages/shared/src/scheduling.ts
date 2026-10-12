// Algoritmos de planejamento usados pelo Gantt (web) e pela camada de dados.
// A explicação de cada regra, com exemplos, está em docs/08-planejamento-gantt-e-algoritmos.md.
// Mudou uma regra aqui? Atualize o documento e os testes em packages/shared/test.
import type { DependencyType } from './constants';
import type { Id, IsoDate } from './entities';
import { compareIds } from './ids';
import {
  addWorkdays,
  ALL_DAYS,
  diffDays,
  isWorkday,
  maxIsoDate,
  minIsoDate,
  nextWorkday,
  previousWorkday,
  workdaysBetween,
  type CalendarInput,
} from './dates';

export interface SchedulableTask {
  id: Id;
  parentId: Id | null;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  isMilestone: boolean;
  progress?: number;
  /** Tarefa liberada para fins de semana e feriados. */
  allowNonWorkingDays?: boolean;
}

/** Calendário que vale para a tarefa: o do workspace ou todos os dias, se liberada. */
export function calendarFor(task: { allowNonWorkingDays?: boolean }, calendar: CalendarInput): CalendarInput {
  return task.allowNonWorkingDays ? ALL_DAYS : calendar;
}

export interface SchedulableDependency {
  predecessorId: Id;
  successorId: Id;
  type: DependencyType;
  lagDays: number;
}

export interface DateRange {
  startDate: IsoDate;
  dueDate: IsoDate;
}

export interface DateChange extends DateRange {
  id: Id;
}

// ---------------------------------------------------------------------------
// Hierarquia
// ---------------------------------------------------------------------------

export function childrenByParent<T extends SchedulableTask>(tasks: readonly T[]): Map<Id, T[]> {
  const map = new Map<Id, T[]>();
  for (const task of tasks) {
    if (task.parentId === null) continue;
    const list = map.get(task.parentId) ?? [];
    list.push(task);
    map.set(task.parentId, list);
  }
  return map;
}

/** Verdadeiro quando `ancestorId` está acima de `taskId` na árvore (pai, avô...). */
export function isAncestor(
  tasks: readonly SchedulableTask[],
  ancestorId: Id,
  taskId: Id,
): boolean {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set<Id>();
  let current = byId.get(taskId)?.parentId ?? null;
  while (current !== null && !visited.has(current)) {
    if (current === ancestorId) return true;
    visited.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

/** Todos os descendentes de `taskId`, em qualquer profundidade. */
export function descendantIds(tasks: readonly SchedulableTask[], taskId: Id): Id[] {
  const children = childrenByParent(tasks);
  const result: Id[] = [];
  const stack = [...(children.get(taskId) ?? [])];
  const visited = new Set<Id>();
  while (stack.length > 0) {
    const task = stack.pop()!;
    if (visited.has(task.id)) continue;
    visited.add(task.id);
    result.push(task.id);
    stack.push(...(children.get(task.id) ?? []));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Resumo (tarefas-mãe)
// ---------------------------------------------------------------------------

export interface SummaryValues {
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  progress: number;
}

/**
 * Datas e progresso das tarefas que têm subtarefas, calculados de baixo para cima.
 * O progresso é a média das filhas ponderada pela duração em dias corridos, para que
 * uma subtarefa de 10 dias pese mais que uma de 1 dia.
 */
export function rollupSummaries(tasks: readonly SchedulableTask[]): Map<Id, SummaryValues> {
  const children = childrenByParent(tasks);
  const result = new Map<Id, SummaryValues>();
  const visiting = new Set<Id>();

  const compute = (task: SchedulableTask): SummaryValues => {
    const cached = result.get(task.id);
    if (cached) return cached;
    const kids = children.get(task.id);
    if (!kids || kids.length === 0 || visiting.has(task.id)) {
      return {
        startDate: task.startDate,
        dueDate: task.dueDate,
        progress: task.progress ?? 0,
      };
    }
    visiting.add(task.id);
    let start: IsoDate | null = null;
    let due: IsoDate | null = null;
    let weighted = 0;
    let weight = 0;
    for (const kid of kids) {
      const values = compute(kid);
      start = minIsoDate(start, values.startDate);
      due = maxIsoDate(due, values.dueDate);
      const span =
        values.startDate && values.dueDate ? diffDays(values.startDate, values.dueDate) + 1 : 1;
      weighted += values.progress * span;
      weight += span;
    }
    visiting.delete(task.id);
    const summary = {
      startDate: start,
      dueDate: due,
      progress: weight > 0 ? Math.round(weighted / weight) : 0,
    };
    result.set(task.id, summary);
    return summary;
  };

  for (const task of tasks) if (children.has(task.id)) compute(task);
  return result;
}

// ---------------------------------------------------------------------------
// Grafo de agendamento
// ---------------------------------------------------------------------------

/**
 * Monta o grafo usado em ordenação e detecção de ciclo. Além das dependências
 * explícitas, inclui arestas implícitas da hierarquia:
 * - filha para mãe, porque as datas da mãe saem das filhas;
 * - predecessora de uma mãe para cada descendente, porque a restrição vale para
 *   tudo que está dentro do resumo.
 */
function buildGraph(
  tasks: readonly SchedulableTask[],
  dependencies: readonly SchedulableDependency[],
): Map<Id, Set<Id>> {
  const graph = new Map<Id, Set<Id>>();
  const known = new Set(tasks.map((task) => task.id));
  const addEdge = (from: Id, to: Id) => {
    if (!known.has(from) || !known.has(to)) return;
    let edges = graph.get(from);
    if (!edges) {
      edges = new Set();
      graph.set(from, edges);
    }
    edges.add(to);
  };
  for (const task of tasks) {
    if (!graph.has(task.id)) graph.set(task.id, new Set());
    if (task.parentId !== null) addEdge(task.id, task.parentId);
  }
  for (const dep of dependencies) {
    addEdge(dep.predecessorId, dep.successorId);
    for (const descendant of descendantIds(tasks, dep.successorId)) {
      addEdge(dep.predecessorId, descendant);
    }
  }
  return graph;
}

/** Ordem topológica (Kahn). Devolve null se houver ciclo. */
function topologicalOrder(graph: Map<Id, Set<Id>>): Id[] | null {
  const inDegree = new Map<Id, number>();
  for (const id of graph.keys()) inDegree.set(id, 0);
  for (const edges of graph.values()) {
    for (const to of edges) inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }
  const queue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const order: Id[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const to of graph.get(id) ?? []) {
      const degree = (inDegree.get(to) ?? 0) - 1;
      inDegree.set(to, degree);
      if (degree === 0) queue.push(to);
    }
  }
  return order.length === graph.size ? order : null;
}

export function hasCycle(
  tasks: readonly SchedulableTask[],
  dependencies: readonly SchedulableDependency[],
): boolean {
  return topologicalOrder(buildGraph(tasks, dependencies)) === null;
}

export type DependencyRejection = 'self' | 'hierarchy' | 'duplicate' | 'cycle';

/**
 * Diz se a nova dependência pode ser criada. Recusa ligar a tarefa a si mesma, a um
 * ancestral ou descendente (a mãe já contém a filha, a ligação não tem sentido), uma
 * ligação repetida e qualquer ligação que feche um ciclo.
 */
export function validateDependency(
  tasks: readonly SchedulableTask[],
  dependencies: readonly SchedulableDependency[],
  candidate: SchedulableDependency,
): DependencyRejection | null {
  const { predecessorId, successorId } = candidate;
  if (predecessorId === successorId) return 'self';
  if (isAncestor(tasks, predecessorId, successorId) || isAncestor(tasks, successorId, predecessorId)) {
    return 'hierarchy';
  }
  const duplicate = dependencies.some(
    (dep) =>
      (dep.predecessorId === predecessorId && dep.successorId === successorId) ||
      (dep.predecessorId === successorId && dep.successorId === predecessorId),
  );
  if (duplicate) return 'duplicate';
  if (hasCycle(tasks, [...dependencies, candidate])) return 'cycle';
  return null;
}

// ---------------------------------------------------------------------------
// Duração e restrições
// ---------------------------------------------------------------------------

/**
 * Duração em dias úteis no calendário da tarefa. Marco vale 0; tarefa comum vale no
 * mínimo 1. Tarefa liberada para fins de semana e feriados conta dias corridos.
 */
export function workdayDuration(
  task: Pick<SchedulableTask, 'startDate' | 'dueDate' | 'isMilestone' | 'allowNonWorkingDays'>,
  calendar: CalendarInput,
): number {
  if (task.isMilestone) return 0;
  if (!task.startDate || !task.dueDate) return 1;
  return Math.max(1, workdaysBetween(task.startDate, task.dueDate, calendarFor(task, calendar)));
}

/** Coloca a tarefa começando em `start` mantendo a duração em dias úteis. */
export function placeAt(
  start: IsoDate,
  duration: number,
  isMilestone: boolean,
  calendar: CalendarInput,
): DateRange {
  const startDate = nextWorkday(start, calendar);
  if (isMilestone || duration <= 0) return { startDate, dueDate: startDate };
  return { startDate, dueDate: addWorkdays(startDate, duration - 1, calendar) };
}

/**
 * Data mais cedo em que a sucessora pode começar por causa de uma dependência.
 * Um marco termina no fim do próprio dia; por isso um marco sucessor de FS pode cair
 * no mesmo dia em que a predecessora termina, e uma tarefa comum começa no dia útil
 * seguinte. O atraso e o encaixe usam o calendário da sucessora (regra do MS Project).
 */
export function earliestStartFor(
  dependency: SchedulableDependency,
  predecessor: DateRange,
  successor: { isMilestone: boolean; duration: number },
  calendar: CalendarInput,
): IsoDate {
  const lag = dependency.lagDays;
  const fromDue = (requiredDue: IsoDate) =>
    successor.isMilestone
      ? requiredDue
      : addWorkdays(requiredDue, -(Math.max(1, successor.duration) - 1), calendar);
  switch (dependency.type) {
    case 'SS':
      return addWorkdays(predecessor.startDate, lag, calendar);
    case 'FF':
      return fromDue(addWorkdays(predecessor.dueDate, lag, calendar));
    case 'SF':
      return fromDue(addWorkdays(predecessor.startDate, lag, calendar));
    case 'FS':
    default:
      return addWorkdays(predecessor.dueDate, (successor.isMilestone ? 0 : 1) + lag, calendar);
  }
}

// ---------------------------------------------------------------------------
// Cascata (agendamento automático)
// ---------------------------------------------------------------------------

/**
 * Empurra para frente as tarefas que violam alguma dependência, preservando a duração
 * em dias úteis. Só empurra, nunca puxa: se a predecessora for antecipada, a sucessora
 * fica onde está (mesmo comportamento do Toggl Plan e do TeamGantt). Tarefas sem data
 * e tarefas-mãe não são movidas diretamente; a mãe acompanha as filhas.
 */
export function cascadeSchedule(
  tasks: readonly SchedulableTask[],
  dependencies: readonly SchedulableDependency[],
  calendar: CalendarInput,
): DateChange[] {
  const graph = buildGraph(tasks, dependencies);
  const order = topologicalOrder(graph);
  if (!order) return [];

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const children = childrenByParent(tasks);
  const current = new Map<Id, { startDate: IsoDate | null; dueDate: IsoDate | null }>();
  for (const task of tasks) current.set(task.id, { startDate: task.startDate, dueDate: task.dueDate });

  const incoming = new Map<Id, SchedulableDependency[]>();
  for (const dep of dependencies) {
    const list = incoming.get(dep.successorId) ?? [];
    list.push(dep);
    incoming.set(dep.successorId, list);
  }

  const ancestorsOf = (id: Id): Id[] => {
    const result: Id[] = [];
    const seen = new Set<Id>();
    let parent = byId.get(id)?.parentId ?? null;
    while (parent !== null && !seen.has(parent)) {
      result.push(parent);
      seen.add(parent);
      parent = byId.get(parent)?.parentId ?? null;
    }
    return result;
  };

  const changes = new Map<Id, DateChange>();

  for (const id of order) {
    const task = byId.get(id);
    if (!task) continue;
    const kids = children.get(id);
    if (kids && kids.length > 0) {
      // Mãe: recalcula a partir das filhas já processadas (arestas filha para mãe).
      let start: IsoDate | null = null;
      let due: IsoDate | null = null;
      for (const kid of kids) {
        const dates = current.get(kid.id)!;
        start = minIsoDate(start, dates.startDate);
        due = maxIsoDate(due, dates.dueDate);
      }
      if (start && due) current.set(id, { startDate: start, dueDate: due });
      continue;
    }
    const dates = current.get(id)!;
    if (!dates.startDate || !dates.dueDate) continue;

    const constraints = [id, ...ancestorsOf(id)].flatMap((target) => incoming.get(target) ?? []);
    const taskCalendar = calendarFor(task, calendar);
    const duration = workdayDuration({ ...task, ...dates }, calendar);
    let required: IsoDate | null = null;
    for (const dep of constraints) {
      const pred = current.get(dep.predecessorId);
      if (!pred?.startDate || !pred.dueDate) continue;
      const earliest = earliestStartFor(
        dep,
        { startDate: pred.startDate, dueDate: pred.dueDate },
        { isMilestone: task.isMilestone, duration },
        taskCalendar,
      );
      required = maxIsoDate(required, earliest);
    }
    if (required && required > dates.startDate) {
      const placed = placeAt(required, duration, task.isMilestone, taskCalendar);
      current.set(id, placed);
      changes.set(id, { id, ...placed });
    }
  }

  // Ordem estável por id: facilita teste e deixa o lote de gravação previsível.
  return [...changes.values()].sort((a, b) => compareIds(a.id, b.id));
}

// ---------------------------------------------------------------------------
// Caminho crítico
// ---------------------------------------------------------------------------

export interface CriticalPathResult {
  /** Folga total em dias úteis por tarefa folha agendada. */
  floatByTask: Map<Id, number>;
  criticalTaskIds: Set<Id>;
  projectStart: IsoDate | null;
  projectEnd: IsoDate | null;
}

/**
 * Caminho crítico sobre o cronograma planejado. As datas atuais valem como início mais
 * cedo; a passada para trás parte do fim do projeto e calcula o término mais tarde de
 * cada tarefa. Folga zero (ou negativa, quando há dependência violada) é crítica.
 * A folga é medida em dias úteis do calendário do workspace, inclusive para tarefas
 * liberadas para fins de semana e feriados (aproximação documentada no doc 08).
 */
export function computeCriticalPath(
  tasks: readonly SchedulableTask[],
  dependencies: readonly SchedulableDependency[],
  calendar: CalendarInput,
): CriticalPathResult {
  const children = childrenByParent(tasks);
  const leaves = tasks.filter(
    (task) => !(children.get(task.id)?.length) && task.startDate && task.dueDate,
  );
  const empty: CriticalPathResult = {
    floatByTask: new Map(),
    criticalTaskIds: new Set(),
    projectStart: null,
    projectEnd: null,
  };
  if (leaves.length === 0) return empty;

  const projectStart = nextWorkday(minIsoDate(...leaves.map((t) => t.startDate))!, calendar);
  const projectEnd = maxIsoDate(...leaves.map((t) => t.dueDate))!;

  // Índice de dia útil relativo ao início do projeto.
  const indexOf = (date: IsoDate, edge: 'start' | 'finish') => {
    const adjusted =
      edge === 'start' ? nextWorkday(date, calendar) : previousWorkday(date, calendar);
    if (adjusted < projectStart) return -workdaysBetween(adjusted, projectStart, calendar) + 1;
    return workdaysBetween(projectStart, adjusted, calendar) - (isWorkday(adjusted, calendar) ? 1 : 0);
  };

  interface Node {
    id: Id;
    start: number;
    finish: number;
    duration: number;
    isMilestone: boolean;
  }
  const nodes = new Map<Id, Node>();
  for (const task of leaves) {
    const start = indexOf(task.startDate!, 'start');
    const finish = task.isMilestone ? indexOf(task.dueDate!, 'finish') : Math.max(start, indexOf(task.dueDate!, 'finish'));
    nodes.set(task.id, {
      id: task.id,
      start: task.isMilestone ? finish : start,
      finish,
      duration: task.isMilestone ? 0 : finish - start + 1,
      isMilestone: task.isMilestone,
    });
  }

  // Dependências com mãe viram dependências entre as folhas descendentes.
  const leavesOf = (id: Id): Id[] => {
    if (nodes.has(id)) return [id];
    return descendantIds(tasks, id).filter((descendant) => nodes.has(descendant));
  };
  const edges: { pred: Node; succ: Node; dep: SchedulableDependency }[] = [];
  for (const dep of dependencies) {
    for (const p of leavesOf(dep.predecessorId)) {
      for (const s of leavesOf(dep.successorId)) {
        edges.push({ pred: nodes.get(p)!, succ: nodes.get(s)!, dep });
      }
    }
  }

  const graph = new Map<Id, Set<Id>>();
  for (const id of nodes.keys()) graph.set(id, new Set());
  for (const { pred, succ } of edges) graph.get(pred.id)!.add(succ.id);
  const order = topologicalOrder(graph);
  if (!order) return { ...empty, projectStart, projectEnd };

  const endIndex = indexOf(projectEnd, 'finish');
  const latestFinish = new Map<Id, number>();
  const outgoing = new Map<Id, typeof edges>();
  for (const edge of edges) {
    const list = outgoing.get(edge.pred.id) ?? [];
    list.push(edge);
    outgoing.set(edge.pred.id, list);
  }

  for (const id of [...order].reverse()) {
    const node = nodes.get(id)!;
    let lf = endIndex;
    for (const { succ, dep } of outgoing.get(id) ?? []) {
      const succLf = latestFinish.get(succ.id)!;
      const succLs = succ.isMilestone ? succLf : succLf - succ.duration + 1;
      const lag = dep.lagDays;
      let limit: number;
      switch (dep.type) {
        case 'SS':
          limit = succLs - lag + Math.max(node.duration - 1, 0);
          break;
        case 'FF':
          limit = succLf - lag;
          break;
        case 'SF':
          limit = succLf - lag + Math.max(node.duration - 1, 0);
          break;
        case 'FS':
        default:
          limit = succLs - lag - (succ.isMilestone ? 0 : 1);
          break;
      }
      lf = Math.min(lf, limit);
    }
    latestFinish.set(id, lf);
  }

  const floatByTask = new Map<Id, number>();
  const criticalTaskIds = new Set<Id>();
  for (const node of nodes.values()) {
    const slack = latestFinish.get(node.id)! - node.finish;
    floatByTask.set(node.id, slack);
    if (slack <= 0) criticalTaskIds.add(node.id);
  }
  return { floatByTask, criticalTaskIds, projectStart, projectEnd };
}
