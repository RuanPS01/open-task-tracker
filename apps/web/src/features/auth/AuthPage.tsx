import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DataModeNote } from '../../components/DataModeNotice';
import { backend } from '../../data/backend';
import { useLogin, useSignup, useStartDemo } from '../../data/session';
import { Button } from '../../components/ui/Button';
import { Illustration } from '../../components/ui/EmptyState';
import { Field, Input } from '../../components/ui/Field';
import { useLocale, useT } from '../../i18n';
import { useErrorMessage } from '../../lib/format';
import { LogoMark } from '../../layout/Logo';
import styles from './AuthPage.module.css';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const location = useLocation();
  const login = useLogin();
  const signup = useSignup();
  const demo = useStartDemo();
  const isLocal = backend().mode === 'local';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = login.isPending || signup.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const onError = (err: unknown) => setError(errorMessage(err));
    if (mode === 'login') {
      login.mutate({ email, password }, { onError });
    } else {
      signup.mutate(
        {
          name,
          email,
          password,
          workspaceName: workspaceName.trim() || undefined,
          locale,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        { onError },
      );
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <div className={styles.brandTop}>
          <LogoMark size={36} />
          <span className={styles.brandName}>Open Task Tracker</span>
        </div>
        <div className={styles.brandArt}>
          <Illustration kind="shapes" />
        </div>
        <p className={styles.tagline}>{t.auth.loginSubtitle}</p>
      </aside>
      <main className={styles.main}>
        <form className={styles.card} onSubmit={submit} noValidate>
          <h1 className={styles.title}>{mode === 'login' ? t.auth.loginTitle : t.auth.signupTitle}</h1>
          <p className={styles.subtitle}>{mode === 'login' ? t.auth.loginSubtitle : t.auth.signupSubtitle}</p>
          {mode === 'signup' && (
            <Field label={t.auth.name}>
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus />}
            </Field>
          )}
          <Field label={t.auth.email}>
            {(id) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus={mode === 'login'}
              />
            )}
          </Field>
          <Field label={t.auth.password} hint={mode === 'signup' ? t.auth.passwordHint : undefined}>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            )}
          </Field>
          {mode === 'signup' && (
            <Field label={t.auth.workspaceName}>
              {(id) => <Input id={id} value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />}
            </Field>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" loading={pending} className={styles.submit}>
            {mode === 'login' ? t.auth.login : t.auth.signup}
          </Button>
          <p className={styles.switch}>
            {mode === 'login' ? t.auth.noAccount : t.auth.haveAccount}{' '}
            {/* Leva junto o destino (por exemplo, o link de convite) para depois do login. */}
            <Link to={mode === 'login' ? '/signup' : '/login'} state={location.state}>
              {mode === 'login' ? t.auth.signup : t.auth.login}
            </Link>
          </p>
          {mode === 'login' && isLocal && (
            <div className={styles.demo}>
              <Button
                type="button"
                icon={<Sparkles />}
                loading={demo.isPending}
                onClick={() => demo.mutate(undefined, { onError: (err) => setError(errorMessage(err)) })}
              >
                {t.auth.demoButton}
              </Button>
              <span>{t.auth.demoHint}</span>
            </div>
          )}
          <DataModeNote />
        </form>
      </main>
    </div>
  );
}
