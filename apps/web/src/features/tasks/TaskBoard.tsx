// Quadro (kanban) por status, no estilo do Trello: uma coluna para cada status padrão e
// para os customizados (do workspace e do projeto). Arrastar um cartão reordena dentro da
// coluna ou leva para outra (muda o status), com rolagem automática perto das bordas.
// Subtarefas ficam dentro do cartão da mãe. A ordem e o status são gravados pela camada
// de dados (`tasks.move`); a tela só antecipa com a mesma regra (`planBoardMove`).
import { effectiveStatusKey, statusAppliesTo, type CreateTaskInput, type Id, type Task } from '@ott/shared';
import clsx from 'clsx';
import { Maximize2, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useCreateTask, useMoveTask, useTasks } from '../../data/tasks';
import { useRunningTimer } from '../../data/timeEntries';
import { StatusOptionIcon, statusInput, useStatusCatalog, type StatusOption } from '../../components/pickers/TaskStatus';
import { Button, IconButton } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { BoardCard } from './BoardCard';
import { afterIdAt, buildBoard, isSamePlace } from './boardModel';
import type { TaskRowContext } from './TaskRow';
import { statusOrder } from './taskGrouping';
import { useTaskPanel } from './TaskPanelContext';
import { useBoardDrag, type BoardDropTarget } from './useBoardDrag';
import styles from './TaskBoard.module.css';

export function TaskBoard({
  tasks,
  context,
  defaults = {},
  hideProject = false,
}: {
  /** Tarefas que passaram pelos filtros da tela. */
  tasks: Task[];
  context: TaskRowContext;
  /** Valores das tarefas criadas pelas colunas (projeto da aba, responsável do filtro). */
  defaults?: Partial<CreateTaskInput>;
  hideProject?: boolean;
}) {
  const t = useT();
  const panel = useTaskPanel();
  const move = useMoveTask();
  const { data: all = [] } = useTasks();
  const { data: running } = useRunningTimer();
  const catalog = useStatusCatalog();
  const boardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<ReadonlyMap<Id, boolean>>(new Map());
  const projectId = defaults.projectId ?? undefined;

  const known = useMemo(() => new Set(catalog.byId.keys()), [catalog.byId]);
  const keys = useMemo(() => statusOrder(catalog.statuses, tasks, projectId), [catalog.statuses, tasks, projectId]);
  const board = useMemo(() => buildBoard(tasks, all, keys, known), [tasks, all, keys, known]);
  const byId = useMemo(() => new Map(all.map((task) => [task.id, task])), [all]);

  /** Motivo para a coluna recusar o cartão, ou nulo se aceita. */
  const refusal = (task: Task, option: StatusOption): string | null => {
    if (effectiveStatusKey(task, known) === option.key) return null;
    if (option.custom && !statusAppliesTo(option.custom, task.projectId)) return t.statuses.notInProject;
    // Status da tarefa-mãe sai das filhas: só muda dentro da mesma categoria.
    if ((board.subtasks.get(task.id)?.length ?? 0) > 0 && option.category !== task.status) return t.tasks.cardParentLocked;
    return null;
  };

  /** Grava o cartão no destino. Devolve falso quando não havia o que gravar ou foi recusado. */
  const drop = (id: Id, target: BoardDropTarget, onSettled?: () => void): boolean => {
    const task = byId.get(id);
    if (!task) return false;
    const option = catalog.option(target.key);
    const reason = refusal(task, option);
    if (reason) {
      toast.error(reason);
      return false;
    }
    const ids = (board.columns.get(target.key) ?? []).map((card) => card.id);
    if (isSamePlace(ids, id, target.index)) return false;
    const afterId = afterIdAt(
      ids.filter((cardId) => cardId !== id),
      target.index,
    );
    const sameColumn = effectiveStatusKey(task, known) === target.key;
    move.mutate({ id, afterId, ...(sameColumn ? {} : statusInput(option)) }, { onSettled });
    return true;
  };

  const drag = useBoardDrag({ boardRef, onDrop: (id, target) => void drop(id, target) });

  // Alternativa ao arraste pelo teclado: o mesmo `drop`, com o índice calculado aqui. O
  // foco volta para o cartão depois que ele muda de lugar (ou de coluna).
  const moveByKey = (task: Task, direction: 'up' | 'down' | 'left' | 'right') => {
    const key = effectiveStatusKey(task, known);
    const ids = (board.columns.get(key) ?? []).map((card) => card.id);
    const index = ids.indexOf(task.id);
    if (index === -1) return;
    let target: BoardDropTarget | null = null;
    if (direction === 'up' && index > 0) target = { key, index: index - 1 };
    if (direction === 'down' && index < ids.length - 1) target = { key, index: index + 1 };
    if (direction === 'left' || direction === 'right') {
      const next = keys[keys.indexOf(key) + (direction === 'left' ? -1 : 1)];
      if (next) target = { key: next, index: Math.min(index, board.columns.get(next)?.length ?? 0) };
    }
    if (!target) return;
    const pending = { id: task.id, key: target.key, settled: false, until: Date.now() + 2000 };
    const moved = drop(task.id, target, () => {
      pending.settled = true;
    });
    if (moved) pendingFocus.current = pending;
  };

  // O cartão movido pelo teclado vira outro elemento na prévia otimista (mudou de coluna)
  // e pode mudar de novo com a resposta da camada de dados: cada renderização devolve o
  // foco a ele, até a gravação terminar (ou o prazo vencer, para nunca roubar o foco).
  const pendingFocus = useRef<{ id: Id; key: string; settled: boolean; until: number } | null>(null);
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    if (Date.now() > pending.until) {
      pendingFocus.current = null;
      return;
    }
    const card = boardRef.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(pending.id)}"]`);
    if (card && document.activeElement !== card) card.focus();
    if (card && pending.settled && card.closest<HTMLElement>('[data-column-key]')?.dataset.columnKey === pending.key) {
      pendingFocus.current = null;
    }
  });
  const draggedTask = drag.dragging ? byId.get(drag.dragging.id) : undefined;

  const setCardExpanded = (id: Id, open: boolean, focusAdd = false) =>
    setExpanded((current) => {
      const next = new Map(current);
      if (open) next.set(id, focusAdd);
      else next.delete(id);
      return next;
    });

  const renderCard = (task: Task, extra: { hidden?: boolean; ghost?: boolean } = {}) => (
    <BoardCard
      key={task.id}
      task={task}
      subtasks={board.subtasks.get(task.id) ?? []}
      context={context}
      hideProject={hideProject}
      timerRunning={running?.taskId === task.id}
      expanded={expanded.has(task.id)}
      focusAdd={expanded.get(task.id) === true}
      onExpand={(open, focusAdd) => setCardExpanded(task.id, open, focusAdd)}
      onOpen={() => !drag.consumeClick() && panel.openTask(task.id)}
      onMoveKey={(direction) => moveByKey(task, direction)}
      onPointerDown={drag.onPointerDown(task.id)}
      {...extra}
    />
  );

  return (
    <>
      <div ref={boardRef} className={clsx(styles.board, drag.dragging && styles.boardDragging)}>
        {keys.map((key) => {
          const option = catalog.option(key);
          const cards = board.columns.get(key) ?? [];
          const isTarget = drag.target?.key === key && draggedTask !== undefined;
          const refused = isTarget && refusal(draggedTask, option) !== null;
          const placeholderAt = isTarget && !refused ? drag.target!.index : -1;
          const placeholder = (
            <div key="placeholder" className={styles.placeholder} style={{ height: drag.dragging?.height }} aria-hidden />
          );
          const items: ReactNode[] = [];
          let shown = 0;
          for (const card of cards) {
            const isDragged = card.id === drag.dragging?.id;
            if (!isDragged) {
              if (shown === placeholderAt) items.push(placeholder);
              shown += 1;
            }
            items.push(renderCard(card, { hidden: isDragged }));
          }
          if (placeholderAt >= shown) items.push(placeholder);
          return (
            <section
              key={key}
              data-column-key={key}
              className={clsx(styles.column, isTarget && !refused && styles.over, refused && styles.refused)}
              aria-label={option.label}
            >
              <header className={styles.columnHeader}>
                <StatusOptionIcon option={option} />
                <span className={styles.columnTitle}>{option.label}</span>
                <span className={styles.count}>{cards.length}</span>
              </header>
              <div className={styles.cards} data-column-list>
                {items}
              </div>
              <ColumnComposer option={option} defaults={defaults} />
            </section>
          );
        })}
      </div>
      {drag.dragging &&
        draggedTask &&
        createPortal(
          <div ref={drag.ghostRef} className={styles.ghost} style={{ width: drag.dragging.width }} aria-hidden>
            {renderCard(draggedTask, { ghost: true })}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * "Adicionar tarefa" no pé da coluna, como o "Adicionar um cartão" do Trello: digita o
 * nome e Enter cria já com o status da coluna e continua aberto para a próxima. O botão de
 * expandir leva o nome para o painel completo.
 */
function ColumnComposer({ option, defaults }: { option: StatusOption; defaults: Partial<CreateTaskInput> }) {
  const t = useT();
  const panel = useTaskPanel();
  const createTask = useCreateTask();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const values = { ...defaults, ...statusInput(option) };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createTask.mutate({ ...values, name: trimmed });
    setName('');
  };
  const close = () => {
    setOpen(false);
    setName('');
  };

  if (!open) {
    return (
      <button type="button" className={styles.add} onClick={() => setOpen(true)}>
        <Plus size={14} />
        {t.tasks.add}
      </button>
    );
  }
  return (
    <div className={styles.composer}>
      <textarea
        className={styles.composerInput}
        value={name}
        rows={2}
        autoFocus
        placeholder={t.tasks.namePlaceholder}
        aria-label={t.tasks.namePlaceholder}
        onChange={(event) => setName(event.target.value.replace(/\n/g, ' '))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          } else if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          }
        }}
        onBlur={(event) => {
          // Sair para fora do campo e dos botões dele fecha, como no Trello.
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null) && !name.trim()) close();
        }}
      />
      <div className={styles.composerActions}>
        <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()} loading={createTask.isPending}>
          {t.common.add}
        </Button>
        <IconButton icon={<X />} label={t.common.cancel} size="sm" onClick={close} />
        <span className={styles.spacer} />
        <IconButton
          icon={<Maximize2 />}
          label={t.tasks.cardOpenInPanel}
          size="sm"
          onClick={() => {
            panel.openNew({ ...values, name: name.trim() });
            close();
          }}
        />
      </div>
    </div>
  );
}
