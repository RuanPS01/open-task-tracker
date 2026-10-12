import type { Locale } from '@ott/shared';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { en } from './en';
import { ptBR, type Messages } from './pt-BR';

const DICTIONARIES: Record<Locale, Messages> = { 'pt-BR': ptBR, en };

interface I18nValue {
  locale: Locale;
  t: Messages;
}

const I18nContext = createContext<I18nValue>({ locale: 'pt-BR', t: ptBR });

/** Idioma antes do login: o último usado neste navegador ou o do sistema. */
export function guessLocale(): Locale {
  try {
    const stored = localStorage.getItem('ott.locale');
    if (stored === 'pt-BR' || stored === 'en') return stored;
  } catch {
    // Armazenamento bloqueado: segue para o idioma do navegador.
  }
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: DICTIONARIES[locale] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Messages {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export type { Messages };
