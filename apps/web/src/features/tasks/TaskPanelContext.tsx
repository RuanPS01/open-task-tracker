// Painel de tarefa global: qualquer tela (Lista, Quadro, Gantt, Linha do tempo,
// busca rápida) abre o mesmo painel pelo hook useTaskPanel.
import type { CreateTaskInput, Id } from '@ott/shared';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { TaskPanel } from './TaskPanel';

export type TaskPanelState =
  | { mode: 'closed' }
  | { mode: 'edit'; taskId: Id }
  | { mode: 'new'; defaults: Partial<CreateTaskInput> };

interface TaskPanelApi {
  openTask: (taskId: Id) => void;
  openNew: (defaults: Partial<CreateTaskInput>) => void;
  close: () => void;
  state: TaskPanelState;
}

const TaskPanelContext = createContext<TaskPanelApi | null>(null);

export function TaskPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TaskPanelState>({ mode: 'closed' });
  const openTask = useCallback((taskId: Id) => setState({ mode: 'edit', taskId }), []);
  const openNew = useCallback((defaults: Partial<CreateTaskInput>) => setState({ mode: 'new', defaults }), []);
  const close = useCallback(() => setState({ mode: 'closed' }), []);
  const api = useMemo(() => ({ openTask, openNew, close, state }), [openTask, openNew, close, state]);
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
