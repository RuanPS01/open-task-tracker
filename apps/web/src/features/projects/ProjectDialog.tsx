// Criar ou editar projeto: nome, cor, cliente, faturável, valor/hora, estimativa e período.
import { PROJECT_COLORS, type Id, type Project } from '@ott/shared';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useCreateProject, useUpdateProject } from '../../data/projects';
import { useClients, useCreateClient } from '../../data/workspace';
import { useWorkspace } from '../../app/session';
import { DateRangePicker } from '../../components/pickers/DateRangePicker';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Switch } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import styles from './ProjectDialog.module.css';

const NEW_CLIENT = '__new__';

export function ProjectDialog({
  project,
  onClose,
  onCreated,
}: {
  project?: Project;
  onClose: () => void;
  onCreated?: (project: Project) => void;
}) {
  const t = useT();
  const format = useFormat();
  const workspace = useWorkspace();
  const { data: clients = [] } = useClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createClient = useCreateClient();
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [clientId, setClientId] = useState<Id | null>(project?.clientId ?? null);
  const [newClient, setNewClient] = useState<string | null>(null);
  const [billable, setBillable] = useState(project?.billable ?? false);
  const [rate, setRate] = useState(project?.hourlyRate?.toString() ?? '');
  const [estimate, setEstimate] = useState(project?.estimateSeconds ? String(project.estimateSeconds / 3600) : '');
  const [startDate, setStartDate] = useState(project?.startDate ?? null);
  const [endDate, setEndDate] = useState(project?.endDate ?? null);
  const pending = createProject.isPending || updateProject.isPending || createClient.isPending;

  const submit = async () => {
    if (!name.trim()) return;
    let finalClientId = clientId;
    if (newClient !== null && newClient.trim()) {
      finalClientId = (await createClient.mutateAsync({ name: newClient.trim() })).id;
    }
    const estimateHours = Number.parseFloat(estimate.replace(',', '.'));
    const rateValue = Number.parseFloat(rate.replace(',', '.'));
    const payload = {
      name: name.trim(),
      color,
      clientId: finalClientId,
      billable,
      hourlyRate: Number.isFinite(rateValue) ? rateValue : null,
      estimateSeconds: Number.isFinite(estimateHours) ? Math.round(estimateHours * 3600) : null,
      startDate,
      endDate,
    };
    if (project) {
      updateProject.mutate({ id: project.id, ...payload }, { onSuccess: onClose });
    } else {
      createProject.mutate(payload, {
        onSuccess: (created) => {
          toast.success(t.projects.created);
          onCreated?.(created);
          onClose();
        },
      });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      persistent
      title={project ? t.projects.edit : t.projects.new}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!name.trim()} loading={pending}>
            {project ? t.common.save : t.common.create}
          </Button>
        </>
      }
    >
      <Field label={t.projects.name}>
        {(id) => (
          <Input id={id} value={name} onChange={(event) => setName(event.target.value)} autoFocus onKeyDown={(event) => event.key === 'Enter' && void submit()} />
        )}
      </Field>
      <Field label={t.projects.color}>
        {() => (
          <div className={styles.colors} role="radiogroup" aria-label={t.projects.color}>
            {PROJECT_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={swatch === color}
                aria-label={swatch}
                className={clsx(styles.swatch, swatch === color && styles.swatchActive)}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
              >
                {swatch === color && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </Field>
      <div className={styles.grid}>
        <Field label={t.projects.client}>
          {(id) =>
            newClient === null ? (
              <Select
                id={id}
                value={clientId ?? ''}
                onChange={(event) => {
                  if (event.target.value === NEW_CLIENT) setNewClient('');
                  else setClientId(event.target.value || null);
                }}
              >
                <option value="">{t.projects.noClient}</option>
                {clients
                  .filter((client) => !client.archived || client.id === clientId)
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                <option value={NEW_CLIENT}>+ {t.projects.newClient}</option>
              </Select>
            ) : (
              <Input id={id} value={newClient} placeholder={t.clients.name} onChange={(event) => setNewClient(event.target.value)} autoFocus />
            )
          }
        </Field>
        <Field label={t.projects.timeframe}>
          {() => (
            <DateRangePicker
              start={startDate}
              end={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
              trigger={({ ref, getProps }) => (
                <button ref={ref} type="button" className={styles.dateButton} {...getProps()}>
                  {startDate && endDate ? format.range(startDate, endDate) : <span className={styles.placeholder}>{t.common.empty}</span>}
                </button>
              )}
            />
          )}
        </Field>
        <Field label={t.projects.estimate}>
          {(id) => <Input id={id} inputMode="decimal" value={estimate} onChange={(event) => setEstimate(event.target.value)} placeholder="0" />}
        </Field>
        <Field label={`${t.projects.hourlyRate} (${workspace.currency})`}>
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              placeholder={workspace.defaultHourlyRate?.toString() ?? '0'}
            />
          )}
        </Field>
      </div>
      <Field label={t.projects.billable} inline>
        {(id) => <Switch id={id} checked={billable} onChange={setBillable} label={t.projects.billable} />}
      </Field>
    </Modal>
  );
}
