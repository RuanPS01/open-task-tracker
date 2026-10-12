// Empacota a API num único arquivo ESM. O pacote @ott/shared entra no pacote (é
// código-fonte TypeScript); as dependências de node_modules ficam externas.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
  // Mantém @ott/shared dentro do pacote, apesar de estar em node_modules via workspace.
  plugins: [
    {
      name: 'bundle-shared',
      setup(builder) {
        builder.onResolve({ filter: /^@ott\/shared$/ }, async () => ({
          path: new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
        }));
      },
    },
  ],
  logLevel: 'info',
});
