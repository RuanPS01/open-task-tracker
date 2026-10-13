// Gera os temas de cor por workspace em apps/web/src/styles/tokens.css, um para cada cor
// de projeto (PROJECT_COLORS em packages/shared/src/constants.ts). Cada tema repete a
// derivação da paleta ciano padrão em OKLCH: os neutros mantêm a luminosidade e a
// saturação dos tokens padrão e recebem a matiz da cor escolhida; os tons da marca têm a
// luminosidade de cada papel (preenchimento, texto, linha, fundo selecionado) na matiz e na
// saturação da cor. Os contrastes mínimos são conferidos e ajustados aqui mesmo.
//
// Uso: `npm run themes` grava o trecho gerado no tokens.css; `npm run check:themes` (dentro
// de `npm run check`) falha se o tokens.css não estiver igual ao que o script geraria.
// Explicação completa em docs/03-identidade-visual.md, seção 3.8.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tokensPath = `${root}apps/web/src/styles/tokens.css`;
const constantsPath = `${root}packages/shared/src/constants.ts`;
const START = '/* <workspace-themes> */';
const END = '/* </workspace-themes> */';

// --- Cores: sRGB, OKLab e OKLCH ---------------------------------------------------------

const hexToRgb = (hex) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: hue < 0 ? hue + 360 : hue };
}

function oklchToLinear({ l: L, c, h }) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (color) => oklchToLinear(color).every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6);

/** Mantém luminosidade e matiz e reduz a saturação até a cor caber no sRGB. */
function fitGamut(color) {
  if (inGamut(color)) return color;
  let low = 0;
  let high = color.c;
  for (let step = 0; step < 32; step++) {
    const middle = (low + high) / 2;
    if (inGamut({ ...color, c: middle })) low = middle;
    else high = middle;
  }
  return { ...color, c: low };
}

function toHex(color) {
  const channels = oklchToLinear(fitGamut(color)).map((channel) => Math.min(1, Math.max(0, channel)));
  return `#${channels.map((channel) => Math.round(fromLinear(channel) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const rgbList = (hex) => hexToRgb(hex).map((channel) => Math.round(channel * 255)).join(', ');

/** Contraste WCAG entre duas cores. */
function contrast(first, second) {
  const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// --- Papéis da paleta ---------------------------------------------------------------------

// Tokens neutros do tema padrão (tokens.css). Cada tema troca só a matiz.
const NEUTRALS = {
  dark: {
    '--bg-app': '#181c1c',
    '--bg-elevated': '#1d2424',
    '--bg-hover': '#222929',
    '--bg-active': '#293232',
    '--bg-input': '#181c1c',
    '--bg-muted': '#111414',
    '--bg-weekend': '#111414',
    '--sidebar-hover': '#0f1718',
    '--sidebar-text': '#e9f2f2',
    '--sidebar-text-muted': '#97a7a8',
    '--sidebar-section': '#7a8b8c',
    '--sidebar-border': '#151b1b',
    '--border': '#333737',
    '--border-subtle': '#252929',
    '--border-strong': '#424c4c',
    '--text': '#f0f5f5',
    '--text-secondary': '#bdc8c8',
    '--text-muted': '#839090',
    '--text-faint': '#5e6a6b',
    '--gantt-summary': '#cbd7d8',
    '--gantt-dependency': '#7c8989',
  },
  light: {
    '--bg-hover': '#eef6f6',
    '--bg-active': '#dceced',
    '--bg-muted': '#f4f9f9',
    '--bg-weekend': '#f1f7f7',
    '--sidebar-text': '#f3fafb',
    '--sidebar-text-muted': '#a6c9ca',
    '--sidebar-section': '#78a6a8',
    '--border': '#d5e3e4',
    '--border-subtle': '#e5eeef',
    '--border-strong': '#b7cdce',
    '--text-secondary': '#395556',
    '--text-muted': '#64797b',
    '--text-faint': '#97acad',
    '--gantt-dependency': '#819a9b',
  },
};

// Saturação de referência: acima dela a cor conta como "viva" e os tons derivados ficam
// iguais aos do ciano; abaixo (ardósia, oliva, salmão) os tons ficam proporcionalmente
// mais acinzentados, como a própria cor.
const VIVID_CHROMA = 0.14;
// Os tons derivados nunca passam da saturação do ciano padrão, para que fundos e bordas
// de cores muito vivas (magenta, vermelho) não gritem mais que os do tema padrão.
const MAX_CHROMA = 0.16;

const WHITE = '#ffffff';

/** Ajusta a luminosidade em passos até a condição valer (contraste mínimo). */
function adjust(color, step, accept) {
  let current = color;
  for (let attempt = 0; attempt < 60 && !accept(toHex(current)); attempt++) {
    current = { ...current, l: Math.min(0.99, Math.max(0.05, current.l + step)) };
  }
  if (!accept(toHex(current))) throw new Error(`Contraste não atingido para ${toHex(color)}`);
  return current;
}

function buildTheme(hex) {
  const source = hexToOklch(hex);
  const { h } = source;
  const vivid = Math.min(1, source.c / VIVID_CHROMA);
  const base = Math.min(source.c, MAX_CHROMA);
  // Tom da marca com a luminosidade do papel e uma fração da saturação da cor.
  const tone = (l, ratio) => ({ l, c: base * ratio, h });
  const neutral = (reference) => {
    const { l, c } = hexToOklch(reference);
    return toHex({ l, c: c * vivid, h });
  };

  // Preenchimento: a cor clareada até ter contraste alto com a tinta escura (como o ciano,
  // que é claro e leva texto escuro nos dois temas). Cores já claras ficam como são.
  const ink = toHex(tone(0.194, 0.21));
  const fill = adjust({ l: Math.min(0.8, Math.max(0.7, source.l)), c: source.c, h }, 0.01, (value) => contrast(value, ink) >= 6.5);
  const fillHex = toHex(fill);

  const darkBg = neutral(NEUTRALS.dark['--bg-app']);
  const darkText = neutral(NEUTRALS.dark['--text']);
  const darkAccentText = toHex(adjust(tone(0.84, 0.9), 0.01, (value) => contrast(value, darkBg) >= 7));
  const darkInverse = toHex(adjust(tone(0.523, 1), -0.01, (value) => contrast(value, darkText) >= 4.5));
  const darkSubtle = toHex(tone(0.278, 0.3));

  const lightSubtle = toHex(tone(0.95, 0.19));
  const lightAccentText = toHex(
    adjust(tone(0.523, 1), -0.01, (value) => contrast(value, WHITE) >= 4.8 && contrast(value, lightSubtle) >= 4.5),
  );
  const lightStrong = toHex(adjust(tone(0.624, 1), -0.01, (value) => contrast(value, WHITE) >= 3));
  const lightSidebar = toHex(adjust(tone(0.257, 0.28), -0.01, (value) => contrast(value, neutral(NEUTRALS.light['--sidebar-text'])) >= 12));

  const brand = {
    '--brand-deep': toHex(tone(0.491, 0.3)),
    '--brand-light': toHex(tone(0.81, 0.59)),
  };

  const dark = {
    ...Object.fromEntries(Object.entries(NEUTRALS.dark).map(([name, value]) => [name, neutral(value)])),
    '--sidebar-active': darkSubtle,
    '--accent': fillHex,
    '--accent-hover': toHex({ l: Math.min(0.95, fill.l + 0.05), c: source.c * 0.75, h }),
    '--accent-text': darkAccentText,
    '--accent-contrast': ink,
    '--accent-subtle': darkSubtle,
    '--accent-subtle-border': toHex(tone(0.389, 0.43)),
    '--accent-strong': fillHex,
    '--accent-inverse': darkInverse,
    '--now-line': fillHex,
    '--focus-ring': `0 0 0 2px rgba(${rgbList(fillHex)}, 0.5)`,
    ...brand,
  };

  const light = {
    ...Object.fromEntries(Object.entries(NEUTRALS.light).map(([name, value]) => [name, neutral(value)])),
    '--bg-overlay': `rgba(${rgbList(lightSidebar)}, 0.35)`,
    '--sidebar-bg': lightSidebar,
    '--sidebar-hover': toHex(tone(0.307, 0.34)),
    '--sidebar-active': toHex(tone(0.386, 0.43)),
    '--sidebar-border': toHex(tone(0.307, 0.34)),
    '--text': lightSidebar,
    '--accent': fillHex,
    '--accent-hover': toHex({ l: fill.l - 0.05, c: source.c * 0.93, h }),
    '--accent-text': lightAccentText,
    '--accent-contrast': ink,
    '--accent-subtle': lightSubtle,
    '--accent-subtle-border': toHex(tone(0.871, 0.48)),
    '--accent-strong': lightStrong,
    '--accent-inverse': fillHex,
    '--gantt-summary': toHex(tone(0.32, 0.35)),
    '--now-line': lightStrong,
    '--shadow-popover': `0 12px 32px rgba(${rgbList(lightSidebar)}, 0.16), 0 0 0 1px var(--border)`,
    '--shadow-panel': `-12px 0 32px rgba(${rgbList(lightSidebar)}, 0.14)`,
    '--focus-ring': `0 0 0 2px rgba(${rgbList(lightStrong)}, 0.45)`,
    ...brand,
  };

  // Conferência final dos pares que a interface usa (texto sobre fundo, tinta sobre o
  // preenchimento, linha sobre o fundo). Falhar aqui é defeito do gerador, não da cor.
  const checks = [
    ['tinta sobre o preenchimento', contrast(ink, fillHex), 6.5],
    ['texto de destaque no escuro', contrast(darkAccentText, darkBg), 7],
    ['linha de destaque no escuro', contrast(fillHex, darkBg), 3],
    ['destaque no aviso do escuro', contrast(darkInverse, darkText), 4.5],
    ['texto de destaque no claro', contrast(lightAccentText, WHITE), 4.8],
    ['texto de destaque sobre o selecionado no claro', contrast(lightAccentText, lightSubtle), 4.5],
    ['linha de destaque no claro', contrast(lightStrong, WHITE), 3],
    ['texto principal no claro', contrast(lightSidebar, WHITE), 12],
    ['destaque no aviso do claro', contrast(fillHex, lightSidebar), 4.5],
  ];
  for (const [label, value, minimum] of checks) {
    if (value < minimum) throw new Error(`${hex}: ${label} com contraste ${value.toFixed(2)} (mínimo ${minimum})`);
  }

  return { dark, light };
}

// --- Saída --------------------------------------------------------------------------------

function projectColors() {
  const source = readFileSync(constantsPath, 'utf8');
  const block = source.match(/PROJECT_COLORS = \[([\s\S]*?)\] as const/);
  if (!block) throw new Error('PROJECT_COLORS não encontrado em constants.ts');
  return [...block[1].matchAll(/'(#[0-9a-f]{6})'/gi)].map((match) => match[1].toLowerCase());
}

const declarations = (tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

function generate() {
  const parts = [
    [
      START,
      '/*',
      ' * Temas de cor por workspace (atributo data-accent no <html>, a cor sem o #). Gerado',
      ' * por scripts/workspace-themes.mjs a partir de PROJECT_COLORS: não edite à mão, rode',
      ' * `npm run themes`. Sem data-accent vale a paleta ciano padrão acima.',
      ' */',
    ].join('\n'),
  ];
  for (const hex of projectColors()) {
    const key = hex.slice(1);
    const { dark, light } = buildTheme(hex);
    parts.push(`:root[data-accent='${key}']:not([data-theme='light']) {\n${declarations(dark)}\n}`);
    parts.push(`:root[data-accent='${key}'][data-theme='light'] {\n${declarations(light)}\n}`);
  }
  parts.push(END);
  return parts.join('\n\n');
}

const current = readFileSync(tokensPath, 'utf8');
const start = current.indexOf(START);
const end = current.indexOf(END);
const generated = generate();
const next =
  start === -1 || end === -1
    ? `${current.trimEnd()}\n\n${generated}\n`
    : `${current.slice(0, start)}${generated}${current.slice(end + END.length)}`;

if (process.argv.includes('--check')) {
  if (next !== current) {
    console.error('tokens.css está diferente dos temas gerados. Rode `npm run themes` e confira o resultado.');
    process.exit(1);
  }
  console.log('Temas de workspace em dia com PROJECT_COLORS.');
} else {
  writeFileSync(tokensPath, next);
  console.log(`Temas de workspace gravados em ${tokensPath.slice(root.length)}.`);
}
