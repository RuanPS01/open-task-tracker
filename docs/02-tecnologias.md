# 2. Tecnologias

## 2.1 Requisitos

- **Node.js 22.13 ou mais novo.** A API usa o SQLite nativo do Node (`node:sqlite`), que
  não precisa de compilação nem de flag a partir dessa versão. O arquivo `.nvmrc` fixa a
  linha 22.
- npm 10 (vem com o Node 22). O monorepo usa workspaces do npm.

## 2.2 Dependências e versões

Versões fixas (sem `^`) para o build ser reproduzível. Ao trocar uma versão, atualize
esta tabela.

### Raiz (ferramentas)

| Pacote | Versão | Uso |
|---|---|---|
| typescript | 5.9.3 | Verificação de tipos (`tsc --noEmit`) em todos os pacotes |
| vitest | 4.1.11 | Testes unitários e de integração |
| vite | 7.3.6 | Também fixado na raiz por `overrides` (ver 2.6) |
| eslint, @eslint/js | 9.39.5 | Lint com configuração plana (`eslint.config.js`) |
| typescript-eslint | 8.70.1 | Regras de TypeScript |
| eslint-plugin-react-hooks | 5.2.0 | Regras de hooks do React |
| globals | 16.5.0 | Globais de navegador e Node para o ESLint |
| @types/node | 22.20.4 | Tipos do Node 22 |

### `@ott/shared`

| Pacote | Versão | Uso |
|---|---|---|
| zod | 4.6.5 | Esquemas de entrada, compartilhados entre API e web |

### `@ott/api`

| Pacote | Versão | Uso |
|---|---|---|
| fastify | 5.12.5 | Servidor HTTP |
| @fastify/cookie | 11.1.2 | Cookie de sessão |
| @fastify/static | 10.1.4 | Entrega da web compilada em produção |
| zod | 4.6.5 | Validação |
| tsx | 4.23.15 | Execução do TypeScript em desenvolvimento e no seed |
| esbuild | 0.25.12 | Empacotamento da API para produção |
| node:sqlite | (nativo) | Banco SQLite sem dependência nativa |
| node:crypto | (nativo) | scrypt para senhas, SHA-256 para sessões |

### `@ott/web`

| Pacote | Versão | Uso |
|---|---|---|
| react, react-dom | 19.3.0 | Interface |
| react-router-dom | 7.18.4 | Rotas |
| @tanstack/react-query | 5.103.2 | Cache de dados do servidor |
| @floating-ui/react | 0.27.20 | Popovers, menus, modais, painel e dicas (posição, foco, Esc) |
| lucide-react | 0.577.0 | Ícones |
| date-fns | 4.4.0 | Aritmética de datas locais no cronômetro |
| clsx | 2.1.1 | Composição de classes CSS |
| @fontsource-variable/inter | 5.3.0 | Fonte Inter embutida (funciona sem internet) |
| vite | 7.3.6 | Servidor de desenvolvimento e build |
| @vitejs/plugin-react | 5.2.0 | JSX e Fast Refresh |

Gráficos, Gantt, calendário e linha do tempo são feitos à mão em SVG e CSS, sem
biblioteca: o Gantt precisa de interações específicas (cascata durante o arraste,
dependências por arraste) que bibliotecas prontas não oferecem do jeito do Toggl.

## 2.3 Scripts

| Comando | O que faz |
|---|---|
| `npm install` | Instala tudo (workspaces) |
| `npm run seed` | Cria a conta `demo@exemplo.com` / `demo1234` com dados de exemplo no banco configurado |
| `npm run dev` | Sobe a API (porta 3000, recarrega ao salvar) e a web (Vite, porta 5173, encaminha `/api`) |
| `npm run build` | Compila a web e empacota a API |
| `npm start` | Sobe a versão de produção (API e web na porta 3000) |
| `npm test` | Testes dos três pacotes |
| `npm run typecheck` | `tsc --noEmit` nos três pacotes |
| `npm run lint` | ESLint no repositório |
| `npm run check:text` | Procura travessão, seta e emoji em arquivos versionados |
| `npm run check` | Tudo acima, na ordem: texto, lint, tipos, testes |

`scripts/dev.mjs` substitui o pacote `concurrently`: só precisamos de dois processos com
prefixo na saída e de encerrar ambos juntos.

## 2.4 Variáveis de ambiente

Modelo em `.env.example`. A API lê do ambiente do processo (não carrega `.env`
sozinha; use `export` ou a ferramenta de deploy).

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `HOST` | `0.0.0.0` | Interface de rede |
| `DATABASE_PATH` | `./data/ott.sqlite` (relativo à pasta onde o processo roda) | Arquivo do banco; `:memory:` só em teste |
| `COOKIE_SECURE` | `false` | `true` atrás de HTTPS |
| `WEB_DIST_PATH` | `apps/web/dist` | Pasta da web compilada; se não existir, a API serve só `/api` |
| `SESSION_DAYS` | `30` | Validade da sessão |
| `LOG_LEVEL` | `info` | Nível de log do Fastify |
| `API_URL` (web, dev) | `http://localhost:3000` | Destino do proxy `/api` do Vite |

## 2.5 TypeScript e build

- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `moduleResolution: Bundler`, `noEmit`. Nenhum pacote emite JavaScript pelo `tsc`.
- `@ott/shared` é consumido como código-fonte TypeScript (`exports` aponta para
  `src/index.ts`). O Vite e o tsx entendem direto; o `build.mjs` da API embute o pacote.
- A web usa CSS Modules (`*.module.css`) mais os tokens globais.

## 2.6 Decisões de segurança de dependências

- `npm audit` deve terminar com zero vulnerabilidades. Na criação do projeto:
  `@fastify/static` 8 tinha falhas de travessia de caminho (corrigidas na 10.1.2 ou mais
  nova), `vitest` 3 dependia de um `tinypool` vulnerável e `concurrently` de um
  `shell-quote` vulnerável. Por isso as versões acima e o `scripts/dev.mjs`.
- O `overrides` de `vite` na raiz contorna um defeito do npm 10 ao resolver dependências
  opcionais do vitest 4 (erro "Cannot read properties of null (reading 'edgesOut')").
  Não remova sem testar `npm install` do zero.

## 2.7 Adicionando uma dependência

1. Prefira o que a plataforma já oferece (Node, navegador, `Intl`) e o que já está na
   tabela.
2. Fixe a versão exata e confira `npm audit`.
3. Atualize a tabela da seção 2.2 no mesmo commit.
