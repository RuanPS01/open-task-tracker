// Verifica a regra 3 de docs/00-regras-para-ia.md: nenhum travessão, meia-risca,
// caractere de seta ou emoji em arquivos versionados de texto.
// Roda no CI local (npm run check) porque revisão humana não pega esses caracteres
// com confiabilidade: eles parecem hífens comuns na maioria das fontes.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Os caracteres são montados por código para que este arquivo não acuse a si mesmo.
const FORBIDDEN = [
  { code: 0x2014, name: 'travessão' },
  { code: 0x2013, name: 'meia-risca' },
  { code: 0x2192, name: 'seta para a direita' },
  { code: 0x2190, name: 'seta para a esquerda' },
  { code: 0x2194, name: 'seta dupla' },
  { code: 0x21d2, name: 'seta dupla para a direita' },
  { code: 0x27f6, name: 'seta longa' },
  { code: 0x2b05, name: 'seta para a esquerda (emoji)' },
  { code: 0x279c, name: 'seta curva' },
].map(({ code, name }) => ({ char: String.fromCodePoint(code), name }));
const EMOJI = /\p{Extended_Pictographic}/u;
const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|json|md|css|html|svg|yml|yaml|txt|example)$/;
// Arquivos gerados ou de terceiros ficam de fora.
const IGNORED = [/^package-lock\.json$/, /(^|\/)node_modules\//, /(^|\/)dist\//];

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file && TEXT_FILE.test(file) && !IGNORED.some((re) => re.test(file)));

const problems = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  content.split('\n').forEach((line, index) => {
    for (const { char, name } of FORBIDDEN) {
      if (line.includes(char)) problems.push(`${file}:${index + 1}: ${name}`);
    }
    if (EMOJI.test(line)) problems.push(`${file}:${index + 1}: emoji`);
  });
}

if (problems.length > 0) {
  console.error('Caracteres proibidos encontrados (ver docs/00-regras-para-ia.md, regra 3):');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.info(`check-text: ${files.length} arquivos verificados, nenhum caractere proibido.`);
