// Plugin do Vite que gera o sw.js do PWA no fim do build: lê o modelo
// (service-worker.js), lista os arquivos publicados e calcula a versão pelo conteúdo.
// Sem dependência extra: o service worker é pequeno e fica no repositório.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Fora do cache inicial: mapas de código (grandes e só para depuração) e o próprio sw.js. */
const SKIP = [/\.map$/, /^sw\.js$/, /^404\.html$/];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

export function serviceWorker(): Plugin {
  let outDir = '';
  return {
    name: 'ott-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((path) => relative(outDir, path).split('\\').join('/'))
        .filter((name) => !SKIP.some((pattern) => pattern.test(name)))
        .sort();
      const hash = createHash('sha256');
      for (const name of files) hash.update(name).update(readFileSync(join(outDir, name)));
      const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
      const version = `const VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 12))};`;
      const precache = `const PRECACHE = ${JSON.stringify(files)};`;
      const source = template.replace('const VERSION = __VERSION__;', version).replace('const PRECACHE = __PRECACHE__;', precache);
      if (source.includes('= __VERSION__') || source.includes('= __PRECACHE__')) {
        throw new Error('Modelo do service worker sem os marcadores esperados (pwa/service-worker.js).');
      }
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}
