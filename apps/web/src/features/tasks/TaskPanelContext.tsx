// Painel de tarefa global: qualquer tela (Lista, Quadro, Gantt, Linha do tempo,
// busca rápida) abre o mesmo painel pelo hook useTaskPanel. Fechar ou trocar a tarefa
// aberta passa pela guarda do painel de edição: com alterações não salvas, o painel
// segura a ação e pergunta antes (salvar, descartar ou continuar editando).
import type { CreateTaskInput, Id } from '@ott/shared';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { TaskPanel } from './TaskPanel';

export type TaskPanelState =
  | { mode: 'closed' }
  | { mode: 'edit'; taskId: Id }
  | { mode: 'new'; defaults: Partial<CreateTaskInput> };

/**
 * Recebe a ação pedida (fechar, abrir outra tarefa). Devolve verdadeiro para seguir na
 * hora; falso quando segurou a ação, que ela mesma executa depois da escolha da pessoa.
 */
export type TaskPanelGuard = (proceed: () => void) => boolean;

interface TaskPanelApi {
  openTask: (taskId: Id) => void;
  openNew: (defaults: Partial<CreateTaskInput>) => void;
  close: () => void;
  /** O painel de edição registra a guarda enquanto existe (nulo para tirar). */
  setGuard: (guard: TaskPanelGuard | null) => void;
  state: TaskPanelState;
}

const TaskPanelContext = createContext<TaskPanelApi | null>(null);

export function TaskPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TaskPanelState>({ mode: 'closed' });
  const guard = useRef<TaskPanelGuard | null>(null);
  const guarded = useCallback((action: () => void) => {
    if (!guard.current || guard.current(action)) action();
  }, []);
  const openTask = useCallback((taskId: Id) => guarded(() => setState({ mode: 'edit', taskId })), [guarded]);
  const openNew = useCallback((defaults: Partial<CreateTaskInput>) => guarded(() => setState({ mode: 'new', defaults })), [guarded]);
  const close = useCallback(() => guarded(() => setState({ mode: 'closed' })), [guarded]);
  const setGuard = useCallback((next: TaskPanelGuard | null) => {
    guard.current = next;
  }, []);
  const api = useMemo(() => ({ openTask, openNew, close, setGuard, state }), [openTask, openNew, close, setGuard, state]);
  return (
    <TaskPanelContext.Provider value={api}>
      {children}
      {state.mode !== 'closed' && <TaskPanel key={state.mode === 'edit' ? `t${state.taskId}` : 'new'} state={state} onClose={close} />}
    </TaskPanelContext.Provider>
  );
}

export function useTaskPanel(): TaskPanelApi {
  const api = useContext(TaskPanelContext);
  if (!api) throw new Error('useTaskPanel fora do TaskPanelProvider');
  return api;
}
