import type { Theme } from '@ott/shared';

/** Aplica o tema no <html> e lembra a escolha para a próxima carga (evita piscar). */
export function applyTheme(theme: Theme): void {
  const resolved =
    theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved;
  // Barra do sistema (celular e app instalado) na cor do fundo do tema.
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim();
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  try {
    localStorage.setItem('ott.theme', theme);
  } catch {
    // Sem armazenamento: o tema volta ao padrão na próxima carga.
  }
}
