import { CURRENCIES, type Currency } from '@ott/shared';
import clsx from 'clsx';
import { useState } from 'react';
import { useUpdateWorkspace } from '../../data/workspace';
import { useIsAdmin, useWorkspace } from '../../app/session';
import { ColorSwatches } from '../../components/pickers/ColorSwatches';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Switch } from '../../components/ui/Field';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { useFormat } from '../../lib/format';
import { DeleteWorkspaceSection } from './DeleteWorkspaceSection';
import { HolidaysSection } from './HolidaysSection';
import styles from './Settings.module.css';

// 2023-01-01 foi domingo: base para nomear os dias da semana no idioma atual.
const WEEKDAY_SAMPLE = (day: number) => `2023-01-0${day + 1}`;

export function WorkspaceSettingsPage() {
  const t = useT();
  const format = useFormat();
  const workspace = useWorkspace();
  const isAdmin = useIsAdmin();
  const update = useUpdateWorkspace();
  const [name, setName] = useState(workspace.name);
  const [currency, setCurrency] = useState<Currency>(workspace.currency);
  const [rate, setRate] = useState(workspace.defaultHourlyRate?.toString() ?? '');
  const [workingDays, setWorkingDays] = useState(workspace.workingDays);

  const save = () => {
    const parsed = Number.parseFloat(rate.replace(',', '.'));
    update.mutate(
      {
        name: name.trim(),
        currency,
        defaultHourlyRate: rate.trim() && Number.isFinite(parsed) ? parsed : null,
        workingDays,
      },
      { onSuccess: () => toast.success(t.common.saved) },
    );
  };

  const toggleDay = (day: number) =>
    setWorkingDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));

  return (
    <>
      <PageHeader title={t.settings.workspaceTitle} subtitle={workspace.name} />
      <div className={styles.body}>
        {!isAdmin && <p className={styles.notice}>{t.settings.adminOnly}</p>}
        <fieldset disabled={!isAdmin} style={{ border: 0, padding: 0, margin: 0 }}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.settings.general}</h2>
            <Field label={t.settings.workspaceName}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <div className={styles.grid}>
              <Field label={t.settings.currency}>
                {(id) => (
                  <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={`${t.settings.defaultRate} (${currency})`}>
                {(id) => <Input id={id} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />}
              </Field>
            </div>
            <Field label={t.settings.workingDays} hint={`${t.settings.workingDaysHint} ${t.settings.weekendHint}`}>
              {() => (
                <div className={styles.days}>
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={clsx(styles.day, workingDays.includes(day) && styles.dayOn)}
                      aria-pressed={workingDays.includes(day)}
                      onClick={() => toggleDay(day)}
                    >
                      {format.weekdayShort(WEEKDAY_SAMPLE(day))}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <div className={styles.actions}>
              <Button variant="primary" onClick={save} loading={update.isPending} disabled={!name.trim() || workingDays.length === 0}>
                {t.common.save}
              </Button>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.settings.color}</h2>
            <p className={styles.sectionHint}>{t.settings.colorHint}</p>
            <ColorSwatches
              value={workspace.color}
              onChange={(color) => update.mutate({ color }, { onSuccess: () => toast.success(t.common.saved) })}
              label={t.settings.color}
              withDefault
              disabled={!isAdmin}
            />
          </section>

          <HolidaysSection disabled={!isAdmin} />

          <section className={styles.section}>
            <div className={styles.switchRow}>
              <div>
                <div className={styles.switchLabel}>{t.settings.autoSchedule}</div>
                <p>{t.settings.autoScheduleHint}</p>
              </div>
              <Switch
                checked={workspace.autoSchedule}
                onChange={(autoSchedule) => update.mutate({ autoSchedule }, { onSuccess: () => toast.success(t.common.saved) })}
                label={t.settings.autoSchedule}
                disabled={!isAdmin}
              />
            </div>
          </section>
        </fieldset>
        {isAdmin && <DeleteWorkspaceSection />}
      </div>
    </>
  );
}
