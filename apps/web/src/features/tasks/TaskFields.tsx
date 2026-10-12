// Lista de propriedades do painel de tarefa (mesma ordem do Toggl: Projeto, Datas,
// Estimativa, Prioridade, Tags, Responsável, Status, Faturável). Serve tanto ao
// rascunho de tarefa nova quanto à edição com salvamento imediato.
import {
  PRIORITY_KEYS,
  type EstimateMode,
  type Id,
  type IsoDate,
  type Priority,
  type TaskStatus,
} from '@ott/shared';
import {
  BarChart3,
  Calendar,
  CircleCheck,
  CircleDollarSign,
  Clock,
  Diamond,
  Folder,
  Gauge,
  Plus,
  Tag as TagIcon,
  User,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useProjectMap } from '../../api/projects';
import { useMembers, useTags } from '../../api/workspace';
import { DateRangePicker } from '../../components/pickers/DateRangePicker';
import { MemberPicker } from '../../components/pickers/MemberPicker';
import pickerStyles from '../../components/pickers/Picker.module.css';
import { ProjectTaskPicker } from '../../components/pickers/ProjectTaskPicker';
import { PriorityMenu, StatusMenu } from '../../components/pickers/StatusPriority';
import { TagPicker } from '../../components/pickers/TagPicker';
import { PriorityIcon, StatusIcon } from '../../components/pickers/TaskIcons';
import { DurationInput } from '../../components/pickers/TimeInputs';
import { Avatar } from '../../components/ui/Avatar';
import { Switch } from '../../components/ui/Field';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import styles from './TaskPanel.module.css';

export interface TaskDraft {
  name: string;
  description: string;
  notes: string;
  projectId: Id | null;
  parentId: Id | null;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  estimateSeconds: number | null;
  estimateMode: EstimateMode;
  priority: Priority;
  tagIds: Id[];
  assigneeIds: Id[];
  status: TaskStatus;
  billable: boolean;
  isMilestone: boolean;
  progress: number;
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        {icon}
        <span>{label}</span>
      </div>
      <div className={styles.rowValue}>{children}</div>
    </div>
  );
}

function Empty() {
  const t = useT();
  return <span className={pickerStyles.placeholder}>{t.common.empty}</span>;
}

export function TaskFields({
  values,
  onChange,
  isSummary = false,
  showProgress = false,
}: {
  values: TaskDraft;
  onChange: (change: Partial<TaskDraft>) => void;
  /** Tarefa com subtarefas: datas e progresso vêm das filhas. */
  isSummary?: boolean;
  showProgress?: boolean;
}) {
  const t = useT();
  const format = useFormat();
  const projects = useProjectMap();
  const { data: members = [] } = useMembers();
  const { data: tags = [] } = useTags();
  const project = values.projectId ? projects.get(values.projectId) : undefined;
  const assignees = members.filter((member) => values.assigneeIds.includes(member.userId));
  const selectedTags = tags.filter((tag) => values.tagIds.includes(tag.id));

  const dateLabel = values.startDate
    ? values.isMilestone || values.startDate === values.dueDate
      ? format.dayLabel(values.startDate)
      : format.range(values.startDate, values.dueDate ?? values.startDate)
    : values.dueDate
      ? format.dayLabel(values.dueDate)
      : null;

  return (
    <div className={styles.fields}>
      <Row icon={<Folder />} label={t.tasks.project}>
        <ProjectTaskPicker
          projectsOnly
          value={{ projectId: values.projectId, taskId: null }}
          onChange={({ projectId }) => onChange({ projectId })}
          trigger={({ ref, getProps }) => (
            <button ref={ref} type="button" className={pickerStyles.trigger} disabled={values.parentId !== null} {...getProps()}>
              {project ? <ProjectLabel name={project.name} color={project.color} /> : <Empty />}
            </button>
          )}
        />
      </Row>

      <Row icon={<Calendar />} label={t.tasks.dates}>
        {isSummary ? (
          <span className={styles.readonly} title={t.gantt.summaryLocked}>
            {dateLabel ?? t.tasks.noDates}
          </span>
        ) : (
          <DateRangePicker
            start={values.startDate}
            end={values.dueDate}
            single={values.isMilestone}
            onChange={(startDate, dueDate) => onChange({ startDate, dueDate })}
            trigger={({ ref, getProps }) => (
              <button ref={ref} type="button" className={pickerStyles.trigger} {...getProps()}>
                {dateLabel ?? <Empty />}
              </button>
            )}
          />
        )}
      </Row>

      <Row icon={<Clock />} label={t.tasks.estimate}>
        <div className={styles.estimate}>
          <DurationInput
            className={styles.estimateInput}
            seconds={values.estimateSeconds}
            display={values.estimateSeconds ? format.hours(values.estimateSeconds) : '0h'}
            bareNumberUnit="hours"
            allowEmpty
            onCommit={(estimateSeconds) => onChange({ estimateSeconds: estimateSeconds || null })}
            aria-label={t.tasks.estimate}
          />
          <select
            className={styles.inlineSelect}
            value={values.estimateMode}
            onChange={(event) => onChange({ estimateMode: event.target.value as EstimateMode })}
            aria-label={t.tasks.estimate}
          >
            <option value="total">{t.tasks.estimateTotal}</option>
            <option value="per_day">{t.tasks.estimatePerDay}</option>
          </select>
        </div>
      </Row>

      <Row icon={<BarChart3 />} label={t.tasks.priority}>
        <PriorityMenu
          value={values.priority}
          onChange={(priority) => onChange({ priority })}
          trigger={({ ref, getProps }) => (
            <button ref={ref} type="button" className={pickerStyles.trigger} {...getProps()}>
              {values.priority === 0 ? (
                <Empty />
              ) : (
                <>
                  <PriorityIcon priority={values.priority} />
                  {t.tasks.priorityLabels[PRIORITY_KEYS[values.priority]]}
                </>
              )}
            </button>
          )}
        />
      </Row>

      <Row icon={<TagIcon />} label={t.tasks.tags}>
        <TagPicker
          value={values.tagIds}
          onChange={(tagIds) => onChange({ tagIds })}
          trigger={({ ref, getProps }) => (
            <button ref={ref} type="button" className={pickerStyles.trigger} {...getProps()}>
              {selectedTags.length === 0 ? (
                <Empty />
              ) : (
                <span className={styles.chips}>
                  {selectedTags.map((tag) => (
                    <span key={tag.id} className={styles.chip}>
                      {tag.name}
                    </span>
                  ))}
                </span>
              )}
            </button>
          )}
        />
      </Row>

      <Row icon={<User />} label={t.tasks.assignee}>
        <div className={styles.assignees}>
          {assignees.map((member) => (
            <span key={member.userId} className={styles.assignee}>
              <Avatar name={member.name} color={member.avatarColor} size={18} />
              <span>{member.name.split(' ')[0]}</span>
              <button
                type="button"
                className={styles.removeAssignee}
                aria-label={t.common.remove}
                onClick={() => onChange({ assigneeIds: values.assigneeIds.filter((id) => id !== member.userId) })}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <MemberPicker
            value={values.assigneeIds}
            onChange={(assigneeIds) => onChange({ assigneeIds })}
            trigger={({ ref, getProps }) => (
              <button ref={ref} type="button" className={styles.addAssignee} aria-label={t.tasks.assignee} {...getProps()}>
                <Plus size={14} />
              </button>
            )}
          />
        </div>
      </Row>

      <Row icon={<CircleCheck />} label={t.tasks.status}>
        <StatusMenu
          value={values.status}
          onChange={(status) => onChange({ status })}
          trigger={({ ref, getProps }) => (
            <button ref={ref} type="button" className={pickerStyles.trigger} {...getProps()}>
              <StatusIcon status={values.status} />
              {t.tasks.statusLabels[values.status]}
            </button>
          )}
        />
      </Row>

      <Row icon={<Diamond />} label={t.tasks.milestone}>
        <Switch
          checked={values.isMilestone}
          disabled={isSummary}
          label={t.tasks.milestone}
          onChange={(isMilestone) => onChange({ isMilestone, ...(isMilestone && values.startDate ? { dueDate: values.startDate } : {}) })}
        />
      </Row>

      <Row icon={<CircleDollarSign />} label={t.tasks.billable}>
        <Switch checked={values.billable} label={t.tasks.billable} onChange={(billable) => onChange({ billable })} />
      </Row>

      {showProgress && (
        <Row icon={<Gauge />} label={t.tasks.progress}>
          <div className={styles.progress}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={values.progress}
              disabled={isSummary || values.status === 'done'}
              onChange={(event) => onChange({ progress: Number(event.target.value) })}
              aria-label={t.tasks.progress}
            />
            <span className="tabular">{values.progress}%</span>
          </div>
        </Row>
      )}
    </div>
  );
}
