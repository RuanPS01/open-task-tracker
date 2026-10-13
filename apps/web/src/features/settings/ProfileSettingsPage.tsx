import { DURATION_FORMATS, LOCALES, THEMES, TIME_FORMATS, type DurationFormat, type Locale, type Theme, type TimeFormat } from '@ott/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { backend } from '../../data/backend';
import { useChangePassword, useUpdateProfile } from '../../data/session';
import { usePwa } from '../../app/pwa';
import { useCurrentUser } from '../../app/session';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import styles from './Settings.module.css';

/** Fusos para escolher: os do navegador quando disponível, senão uma lista curta. */
function timezones(current: string): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone');
  const list = supported ?? ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'America/New_York', 'Europe/Lisbon', 'UTC'];
  return list.includes(current) ? list : [current, ...list];
}

export function ProfileSettingsPage() {
  const t = useT();
  const user = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const canChangeEmail = backend().canChangeEmail;
  // Quem entrou só pelo Google não tem senha aqui: a senha é a da conta Google.
  const hasPassword = backend().hasPassword();
  const pwa = usePwa();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const prefs = user.preferences;
  const setPreference = (change: Partial<typeof prefs>) =>
    updateProfile.mutate({ preferences: change }, { onSuccess: () => toast.success(t.common.saved) });

  const themeLabels: Record<Theme, string> = { dark: t.nav.themeDark, light: t.nav.themeLight, system: t.nav.themeSystem };
  const durationLabels: Record<DurationFormat, string> = {
    improved: t.settings.durationImproved,
    classic: t.settings.durationClassic,
    decimal: t.settings.durationDecimal,
  };
  const timeLabels: Record<TimeFormat, string> = { '24h': t.settings.time24, '12h': t.settings.time12 };

  return (
    <>
      <PageHeader title={t.settings.profileTitle} leading={<Avatar name={user.name} color={user.avatarColor} size={32} />} />
      <div className={styles.body}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.settings.account}</h2>
          <div className={styles.grid}>
            <Field label={t.settings.name}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label={t.settings.email} hint={canChangeEmail ? undefined : t.settings.emailLocked}>
              {(id) => (
                <Input id={id} type="email" value={email} disabled={!canChangeEmail} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
          </div>
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={!name.trim() || (name === user.name && email === user.email)}
              loading={updateProfile.isPending}
              onClick={() =>
                updateProfile.mutate(
                  { name: name.trim(), ...(canChangeEmail ? { email: email.trim() } : {}) },
                  { onSuccess: () => toast.success(t.common.saved) },
                )
              }
            >
              {t.common.save}
            </Button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.settings.preferences}</h2>
          <div className={styles.grid}>
            <Field label={t.settings.theme}>
              {(id) => (
                <Select id={id} value={prefs.theme} onChange={(e) => setPreference({ theme: e.target.value as Theme })}>
                  {THEMES.map((theme) => (
                    <option key={theme} value={theme}>
                      {themeLabels[theme]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.settings.language}>
              {(id) => (
                <Select id={id} value={prefs.locale} onChange={(e) => setPreference({ locale: e.target.value as Locale })}>
                  {LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {t.settings.languages[locale]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.settings.weekStart}>
              {(id) => (
                <Select id={id} value={prefs.weekStart} onChange={(e) => setPreference({ weekStart: Number(e.target.value) as 0 | 1 })}>
                  <option value={1}>{t.settings.monday}</option>
                  <option value={0}>{t.settings.sunday}</option>
                </Select>
              )}
            </Field>
            <Field label={t.settings.timeFormat}>
              {(id) => (
                <Select id={id} value={prefs.timeFormat} onChange={(e) => setPreference({ timeFormat: e.target.value as TimeFormat })}>
                  {TIME_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {timeLabels[format]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.settings.durationFormat}>
              {(id) => (
                <Select id={id} value={prefs.durationFormat} onChange={(e) => setPreference({ durationFormat: e.target.value as DurationFormat })}>
                  {DURATION_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {durationLabels[format]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.settings.timezone}>
              {(id) => (
                <Select id={id} value={prefs.timezone} onChange={(e) => setPreference({ timezone: e.target.value })}>
                  {timezones(prefs.timezone).map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.pwa.section}</h2>
          {pwa.standalone ? (
            <p className={styles.sectionHint}>{t.pwa.installed}</p>
          ) : (
            <>
              <p className={styles.sectionHint}>{t.pwa.hint}</p>
              {pwa.install && (
                <div className={styles.actions}>
                  <Button icon={<Download />} onClick={() => void pwa.install?.()}>
                    {t.pwa.install}
                  </Button>
                </div>
              )}
              <p className={styles.sectionHint}>{t.pwa.ios}</p>
              {!pwa.install && <p className={styles.sectionHint}>{t.pwa.other}</p>}
            </>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.settings.password}</h2>
          {!hasPassword ? (
            <p className={styles.sectionHint}>{t.settings.passwordGoogle}</p>
          ) : (
            <>
              <div className={styles.grid}>
                <Field label={t.settings.currentPassword}>
                  {(id) => <Input id={id} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />}
                </Field>
                <Field label={t.settings.newPassword} hint={t.auth.passwordHint}>
                  {(id) => <Input id={id} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />}
                </Field>
              </div>
              <div className={styles.actions}>
                <Button
                  disabled={!currentPassword || newPassword.length < 8}
                  loading={changePassword.isPending}
                  onClick={() =>
                    changePassword.mutate(
                      { currentPassword, newPassword },
                      {
                        onSuccess: () => {
                          toast.success(t.settings.passwordChanged);
                          setCurrentPassword('');
                          setNewPassword('');
                        },
                      },
                    )
                  }
                >
                  {t.settings.changePassword}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
