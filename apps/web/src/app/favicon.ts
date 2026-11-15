// Ícone da aba na cor do tema do workspace. O desenho é o mesmo de public/favicon.svg
// (relógio sobre o círculo), só com o preenchimento e a tinta trocados pelos tokens
// --accent e --accent-contrast do tema em uso. O teste ao lado confere que, com as cores
// padrão, o resultado é idêntico ao arquivo: mudou o logotipo, mude os dois.

/** SVG do favicon com as cores pedidas (texto, sem quebras de linha nas pontas). */
export function faviconSvg(fill: string, ink: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    `  <circle cx="16" cy="16" r="16" fill="${fill}"/>`,
    `  <circle cx="16" cy="17" r="8.5" fill="none" stroke="${ink}" stroke-width="2.6"/>`,
    `  <path d="M16 11.5v5.5l3.5 2.2" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    `  <path d="M13 5.5h6" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,
    '</svg>',
  ].join('\n');
}

/**
 * Troca o ícone da aba pelo desenho com as cores do tema aplicado no <html>. Sem os
 * tokens (CSS ainda não carregou), mantém o ícone do arquivo.
 */
export function syncFavicon(): void {
  const style = getComputedStyle(document.documentElement);
  const fill = style.getPropertyValue('--accent').trim();
  const ink = style.getPropertyValue('--accent-contrast').trim();
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link || !fill || !ink) return;
  const href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(fill, ink))}`;
  if (link.href !== href) link.href = href;
}
