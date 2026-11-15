import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { faviconSvg } from './favicon';

describe('favicon na cor do tema', () => {
  it('com as cores padrão é igual ao public/favicon.svg', () => {
    const file = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8').trim();
    const brand = /fill="(#[0-9a-f]{6})"/.exec(file)?.[1] ?? '';
    const ink = /stroke="(#[0-9a-f]{6})"/.exec(file)?.[1] ?? '';
    expect(faviconSvg(brand, ink)).toBe(file);
  });

  it('troca o preenchimento e a tinta', () => {
    const svg = faviconSvg('#c9a5ff', '#1a0d2a');
    expect(svg).toContain('fill="#c9a5ff"');
    expect(svg.match(/stroke="#1a0d2a"/g)).toHaveLength(3);
  });
});
