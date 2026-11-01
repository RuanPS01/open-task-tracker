// Catálogo dos status de tarefa na web: os três padrão (rótulo traduzido) mais os
// customizados do workspace e dos projetos. As regras de quais valem para cada projeto e
// em que ordem ficam em @ott/shared (statusKeysFor); aqui só se monta o que a tela mostra.
import { statusKeysFor, type CustomStatus, type Id, type Task, type TaskStatus } from '@ott/shared';
import { useMemo } from 'react';
import { useStatuses } from '../../data/statuses';
import { useT } from '../../i18n';
import { StatusIcon } from './TaskIcons';

export interface StatusOption {
  /** Categoria (status padrão) ou id do status customizado. */
  key: string;
  category: TaskStatus;
  label: string;
  custom: CustomStatus | null;
}

/** Valores para gravar a escolha numa tarefa (criar ou alterar). */
export const statusInput = (option: StatusOption) => ({ status: option.category, statusId: option.custom?.id ?? null });

export function useStatusCatalog() {
  const t = useT();
  const { data: statuses = [] } = useStatuses();
  return useMemo(() => {
    const byId = new Map(statuses.map((status) => [status.id, status]));
    const option = (key: string): StatusOption => {
      const custom = byId.get(key);
      if (custom) return { key, category: custom.category, label: custom.name, custom };
      const category = key as TaskStatus;
      return { key: category, category, label: t.tasks.statusLabels[category], custom: null };
    };
    return {
      statuses,
      byId,
      option,
      /** Status da tarefa; customizado que não existe mais conta como o padrão da categoria. */
      forTask: (task: Pick<Task, 'status' | 'statusId'>) =>
        option(task.statusId !== null && byId.has(task.statusId) ? task.statusId : task.status),
      /** Opções para uma tarefa do projeto, na ordem do menu. */
      optionsFor: (projectId: Id | null) => statusKeysFor(statuses, projectId).map(option),
    };
  }, [statuses, t]);
}

export type StatusCatalog = ReturnType<typeof useStatusCatalog>;

export function StatusOptionIcon({ option, size }: { option: StatusOption; size?: number }) {
  return <StatusIcon status={option.category} custom={option.custom} size={size} />;
}

/** Ícone do status da tarefa (padrão ou customizado). */
export function TaskStatusIcon({ task, size }: { task: Pick<Task, 'status' | 'statusId'>; size?: number }) {
  const catalog = useStatusCatalog();
  return <StatusOptionIcon option={catalog.forTask(task)} size={size} />;
}
