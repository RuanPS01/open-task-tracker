// Importação de várias tarefas por JSON, aberta pelo Gantt, pelas tarefas do projeto e
// pela tela de Tarefas. Dois passos: colar ou carregar o arquivo (com o prompt para IA
// e um exemplo), depois revisar exatamente o que vai entrar e confirmar. A validação,
// a resolução de nomes e a cascata são da camada de dados (tasks.previewImport).
import {
  PRIORITY_KEYS,
  toIsoDate,
  type Id,
  type TaskImportIssue,
  type TaskImportPreview,
  type TaskImportRow,
} from '@ott/shared';
import clsx from 'clsx';
import { CalendarClock, CircleAlert, Diamond, FileBraces, Sparkles, TriangleAlert, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../app/session';
import { useProjectMap } from '../../data/projects';
import { useImportTasks, usePreviewTaskImport, useTasks } from '../../data/tasks';
import { useHolidays, useMembers, useTags } from '../../data/workspace';
import { PriorityIcon, StatusIcon } from '../../components/pickers/TaskIcons';
import { AvatarStack } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { ColorDot } from '../../components/ui/ProjectLabel';
import { toast } from '../../components/ui/Toast';
import { useLocale, useT } from '../../i18n';
import { useWorkCalendar } from '../../lib/calendar';
import { useErrorMessage, useFormat } from '../../lib/format';
import { exampleDates, promptContext } from './taskImportModel';
import styles from './TaskImportDialog.module.css';

const NO_ROWS: readonly TaskImportRow[] = [];

/** Copia texto com a API do navegador e, sem ela (página sem HTTPS), pelo jeito antigo. */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy');
}

export function TaskImportButton({ projectId = null, size = 'md' }: { projectId?: Id | null; size?: 'sm' | 'md' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} icon={<FileBraces />} onClick={() => setOpen(true)}>
        {t.taskImport.button}
      </Button>
      {open && <TaskImportDialog projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function TaskImportDialog({ projectId, onClose }: { projectId: Id | null; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const workspace = useWorkspace();
  const projects = useProjectMap();
  const { data: tasks = [] } = useTasks();
  const { data: members = [] } = useMembers();
  const { data: tags = [] } = useTags();
  const { data: holidays = [] } = useHolidays();
  const { calendar } = useWorkCalendar();
  const preview = usePreviewTaskImport();
  const importTasks = useImportTasks();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<TaskImportPreview | null>(null);
  // Problemas de um arquivo que nem chegou a virar tarefas (JSON quebrado, fora do formato).
  const [inputIssues, setInputIssues] = useState<TaskImportIssue[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const issueText = useIssueText(NO_ROWS);

  const project = projectId ? projects.get(projectId) : undefined;
  const example = () => t.taskImport.example(exampleDates(toIsoDate(new Date()), calendar));

  const copyPrompt = () => {
    const today = toIsoDate(new Date());
    // Nome do dia como no meio de uma frase ("segunda-feira", "Monday").
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
    const context = promptContext({
      today,
      weekdayName: (iso) => weekday.format(new Date(`${iso}T12:00:00Z`)),
      workingDays: workspace.workingDays,
      holidays,
      autoSchedule: workspace.autoSchedule,
      projects: [...projects.values()],
      currentProjectId: projectId,
      members,
      tags,
      tasks,
      example: example(),
    });
    copyText(t.taskImport.aiPrompt(context)).then(
      () => toast.success(t.taskImport.promptCopied),
      () => toast.error(t.taskImport.copyFailed),
    );
  };

  const changeText = (value: string) => {
    setText(value);
    setInputIssues([]);
    setFailure(null);
  };

  const loadFile = async (file: File | undefined) => {
    if (file) changeText(await file.text());
  };

  const review = () => {
    setFailure(null);
    preview.mutate(
      { text, defaultProjectId: projectId },
      {
        onSuccess: (data) => (data.rows.length > 0 ? setResult(data) : setInputIssues(data.issues)),
        onError: (error) => setFailure(errorMessage(error)),
      },
    );
  };

  const confirm = () =>
    importTasks.mutate(
      { text, defaultProjectId: projectId },
      {
        onSuccess: ({ created }) => {
          toast.success(t.taskImport.imported(created));
          onClose();
        },
      },
    );

  if (result) {
    return (
      <Modal
        open
        onClose={onClose}
        persistent
        title={t.taskImport.reviewTitle}
        width={1080}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResult(null)}>
              {t.taskImport.back}
            </Button>
            <Button variant="primary" disabled={!result.canImport} loading={importTasks.isPending} onClick={confirm}>
              {t.taskImport.confirm(result.rows.length)}
            </Button>
          </>
        }
      >
        <ImportReview preview={result} />
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      persistent
      title={t.taskImport.title}
      width={760}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" disabled={!text.trim()} loading={preview.isPending} onClick={review}>
            {t.taskImport.review}
          </Button>
        </>
      }
    >
      <p className={styles.intro}>
        {t.taskImport.intro} {project ? t.taskImport.intoProject(project.name) : t.taskImport.noDefaultProject}
      </p>
      <div className={styles.prompt}>
        <Sparkles size={18} aria-hidden />
        <p>{t.taskImport.promptHint}</p>
        <Button size="sm" variant="primary" onClick={copyPrompt}>
          {t.taskImport.copyPrompt}
        </Button>
      </div>
      <TextArea
        className={styles.editor}
        value={text}
        onChange={(event) => changeText(event.target.value)}
        placeholder={t.taskImport.placeholder}
        spellCheck={false}
        aria-label={t.taskImport.title}
      />
      <div className={styles.inputActions}>
        <Button size="sm" icon={<Upload />} onClick={() => fileInput.current?.click()}>
          {t.taskImport.loadFile}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => changeText(example())}>
          {t.taskImport.insertExample}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void loadFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {inputIssues.length > 0 && (
        <div className={styles.inputIssues}>
          <IssueList kind="error" title={t.taskImport.errors(inputIssues.length)} items={inputIssues.map(issueText)} />
        </div>
      )}
      {failure && (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}
    </Modal>
  );
}

/** Texto de um problema da importação, com a tarefa a que ele se refere. */
function useIssueText(rows: readonly TaskImportRow[]) {
  const t = useT();
  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);
  return (issue: TaskImportIssue) => {
    const message = t.taskImport.issues[issue.code as keyof typeof t.taskImport.issues]?.({ ...issue.params, path: issue.path });
    const row = issue.taskKey ? rowsByKey.get(issue.taskKey) : undefined;
    const text = message ?? issue.code;
    return row ? `${t.taskImport.taskLabel(row.key, row.name)}: ${text}` : text;
  };
}

function ImportReview({ preview }: { preview: TaskImportPreview }) {
  const t = useT();
  const format = useFormat();
  const projects = useProjectMap();
  const { data: memberList = [] } = useMembers();
  const members = useMemo(() => new Map(memberList.map((member) => [member.userId, member])), [memberList]);
  const issueText = useIssueText(preview.rows);
  const errors = preview.issues.filter((issue) => issue.level === 'error');
  const warnings = preview.issues.filter((issue) => issue.level === 'warning');
  const errorKeys = new Set(errors.map((issue) => issue.taskKey));
  const subtasks = preview.rows.filter((row) => row.parentKey !== null).length;

  const dates = (row: TaskImportRow) => {
    if (!row.startDate || !row.dueDate) return '-';
    return row.startDate === row.dueDate ? format.dayMonth(`${row.startDate}T12:00:00`) : format.range(`${row.startDate}T12:00:00`, `${row.dueDate}T12:00:00`);
  };

  return (
    <div className={styles.review}>
      <p className={styles.summary}>
        <strong>{t.taskImport.summaryTasks(preview.rows.length, subtasks)}</strong>
        {preview.dependencyCount > 0 && <span>{t.taskImport.summaryDependencies(preview.dependencyCount)}</span>}
        {preview.newTags.length > 0 && <span>{t.taskImport.summaryNewTags(preview.newTags.join(', '))}</span>}
      </p>
      {errors.length > 0 && (
        <IssueList kind="error" title={t.taskImport.errors(errors.length)} items={errors.map(issueText)} />
      )}
      {warnings.length > 0 && (
        <IssueList kind="warning" title={t.taskImport.warnings(warnings.length)} items={warnings.map(issueText)} />
      )}
      {preview.rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.taskImport.columns.task}</th>
                <th>{t.taskImport.columns.project}</th>
                <th>{t.taskImport.columns.dates}</th>
                <th>{t.taskImport.columns.estimate}</th>
                <th>{t.taskImport.columns.assignees}</th>
                <th>{t.taskImport.columns.priority}</th>
                <th>{t.taskImport.columns.dependsOn}</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => {
                const project = row.projectId ? projects.get(row.projectId) : undefined;
                const people = row.assigneeIds
                  .map((id) => members.get(id))
                  .filter((member) => member !== undefined)
                  .map((member) => ({ id: member.userId, name: member.name, avatarColor: member.avatarColor }));
                return (
                  <tr key={row.key} className={clsx(errorKeys.has(row.key) && styles.rowError)}>
                    <td>
                      <div className={styles.taskCell} style={{ paddingLeft: row.depth * 20 }}>
                        <span className={styles.key}>{row.key}</span>
                        {row.isMilestone ? <Diamond size={14} className={styles.milestone} aria-hidden /> : <StatusIcon status={row.status} size={14} />}
                        <span className={clsx(styles.name, row.parentKey === null && preview.rows.some((r) => r.parentKey === row.key) && styles.parent)}>
                          {row.name}
                        </span>
                      </div>
                      {row.tagNames.length > 0 && (
                        <div className={styles.tags} style={{ paddingLeft: row.depth * 20 + 26 }}>
                          {row.tagNames.map((name) => (
                            <span key={name} className={styles.tag}>
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {project ? (
                        <span className={styles.project}>
                          <ColorDot color={project.color} />
                          {project.name}
                        </span>
                      ) : (
                        <span className={styles.muted}>{t.tasks.noProject}</span>
                      )}
                    </td>
                    <td className={styles.nowrap}>
                      <span className={styles.dates}>
                        {dates(row)}
                        {row.rescheduled && (
                          <span className={styles.rescheduled} title={t.taskImport.rescheduled}>
                            <CalendarClock size={14} aria-label={t.taskImport.rescheduled} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={styles.nowrap}>
                      {row.estimateSeconds !== null
                        ? `${format.hours(row.estimateSeconds)}${row.estimateMode === 'per_day' ? ` ${t.taskImport.perDay}` : ''}`
                        : '-'}
                    </td>
                    <td>{people.length > 0 ? <AvatarStack people={people} size={20} /> : <span className={styles.muted}>-</span>}</td>
                    <td className={styles.nowrap}>
                      <span className={styles.priority}>
                        <PriorityIcon priority={row.priority} size={14} />
                        {t.tasks.priorityLabels[PRIORITY_KEYS[row.priority]]}
                      </span>
                    </td>
                    <td className={styles.deps}>
                      {row.dependencies.length > 0
                        ? row.dependencies
                            .map((dep) => `${dep.name}${dep.type !== 'FS' || dep.lagDays !== 0 ? ` (${dep.type}${dep.lagDays ? ` ${dep.lagDays > 0 ? '+' : ''}${dep.lagDays}` : ''})` : ''}`)
                            .join(', ')
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IssueList({ kind, title, items }: { kind: 'error' | 'warning'; title: string; items: string[] }) {
  return (
    <div className={clsx(styles.issues, kind === 'error' ? styles.issuesError : styles.issuesWarning)} role={kind === 'error' ? 'alert' : undefined}>
      <p className={styles.issuesTitle}>
        {kind === 'error' ? <CircleAlert size={16} aria-hidden /> : <TriangleAlert size={16} aria-hidden />}
        {title}
      </p>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
