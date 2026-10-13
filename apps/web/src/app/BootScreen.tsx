// Telas da abertura, antes de a camada de dados estar escolhida (main.tsx): carregando
// enquanto o Firebase é testado, e erro quando o Firebase é obrigatório e falhou.
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/EmptyState';
import { guessLocale, I18nProvider, useT } from '../i18n';
import { LogoMark } from '../layout/Logo';
import styles from './BootScreen.module.css';

function Loading() {
  const t = useT();
  return (
    <main className={styles.screen} aria-busy="true">
      <LogoMark size={40} />
      <Spinner size={22} />
      <p className={styles.text}>{t.boot.connecting}</p>
    </main>
  );
}

function Failure({ code }: { code: string }) {
  const t = useT();
  const message = code in t.errors ? t.errors[code as keyof typeof t.errors] : t.errors.UNKNOWN;
  return (
    <main className={styles.screen} role="alert">
      <LogoMark size={40} />
      <h1 className={styles.title}>{t.boot.failedTitle}</h1>
      <p className={styles.text}>{message}</p>
      <Button variant="primary" onClick={() => window.location.reload()}>
        {t.boot.reload}
      </Button>
    </main>
  );
}

export function BootScreen() {
  // O idioma da sessão ainda não existe: usa o último deste navegador ou o do sistema.
  const [locale] = useState(guessLocale);
  return (
    <I18nProvider locale={locale}>
      <Loading />
    </I18nProvider>
  );
}

export function BootError({ code }: { code: string }) {
  const [locale] = useState(guessLocale);
  return (
    <I18nProvider locale={locale}>
      <Failure code={code} />
    </I18nProvider>
  );
}
