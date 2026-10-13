import type { Theme } from '@ott/shared';

/** Barra do sistema (celular e app instalado) na cor do fundo do tema e do workspace em uso. */
function syncThemeColor(): void {
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim();
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}

function remember(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento: a escolha volta ao padrão na próxima carga.
  }
}

/** Aplica o tema no <html> e lembra a escolha para a próxima carga (evita piscar). */
export function applyTheme(theme: Theme): void {
  const resolved =
    theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved;
  syncThemeColor();
  remember('ott.theme', theme);
}

/**
 * Aplica o tema de cor do workspace (`Workspace.color`) no <html>: `data-accent` com a cor
 * sem o #, que escolhe a paleta gerada em tokens.css. Nulo volta à paleta ciano padrão. A
 * última cor fica em `ott.accent` para o index.html aplicar antes do React.
 */
export function applyAccent(color: string | null): void {
  const accent = color ? color.slice(1).toLowerCase() : null;
  if (accent) document.documentElement.dataset.accent = accent;
  else delete document.documentElement.dataset.accent;
  syncThemeColor();
  remember('ott.accent', accent);
}
