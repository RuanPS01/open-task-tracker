# 2. Tecnologias

## 2.1 Requisitos

- **Node.js 22.13 ou mais novo** para desenvolver e gerar o build (o arquivo `.nvmrc`
  fixa a linha 22). O site publicado é estático: não há servidor Node em produção.
- npm 10 (vem com o Node 22). O monorepo usa workspaces do npm.
- **Java 21**, só para rodar os testes no emulador do Firebase (`npm run test:firebase`).
  O `firebase-tools` não é dependência do projeto: o script baixa a versão fixada pelo
  `npx`.

## 2.2 Dependências e versões

Versões fixas (sem `^`) para o build ser reproduzível. Ao trocar uma versão, atualize
esta tabela.

### Raiz (ferramentas)

| Pacote | Versão | Uso |
|---|---|---|
| typescript | 5.9.3 | Verificação de tipos (`tsc --noEmit`) em todos os pacotes |
| vitest | 4.1.11 | Testes unitários e das suítes da camada de dados |
| vite | 7.3.6 | Também fixado na raiz por `overrides` (ver 2.8) |
| eslint, @eslint/js | 9.39.5 | Lint com configuração plana (`eslint.config.js`) |
| typescript-eslint | 8.70.1 | Regras de TypeScript |
| eslint-plugin-react-hooks | 5.2.0 | Regras de hooks do React |
| globals | 16.5.0 | Globais de navegador e Node para o ESLint |
| @types/node | 22.20.4 | Tipos do Node 22 (scripts e testes) |

### `@ott/shared`

| Pacote | Versão | Uso |
|---|---|---|
| zod | 4.6.5 | Esquemas de entrada, compartilhados pela camada de dados e pela web |

### `@ott/data`

| Pacote | Versão | Uso |
|---|---|---|
| firebase | 12.19.0 | Authentication (e-mail e senha) e Cloud Firestore no modo Firebase |
| lowdb | 7.0.1 | Armazenamento do modo local (`localStorage` no navegador, memória nos testes) |
| zod | 4.6.5 | Validação das entradas dos serviços |
| Web Crypto | (navegador e Node) | PBKDF2 das senhas do modo local e ids aleatórios |

### `@ott/web`

| Pacote | Versão | Uso |
|---|---|---|
| react, react-dom | 19.3.0 | Interface |
| react-router-dom | 7.18.4 | Rotas (com `basename` para o subcaminho do GitHub Pages) |
| @tanstack/react-query | 5.103.2 | Cache dos dados lidos pela camada de dados |
| @floating-ui/react | 0.27.20 | Popovers, menus, modais, painel e dicas (posição, foco, Esc) |
| lucide-react | 0.577.0 | Ícones |
| date-fns | 4.4.0 | Aritmética de datas locais no cronômetro |
| clsx | 2.1.1 | Composição de classes CSS |
| @fontsource-variable/inter | 5.3.0 | Fonte Inter embutida (funciona sem internet) |
| vite | 7.3.6 | Servidor de desenvolvimento e build |
| @vitejs/plugin-react | 5.2.0 | JSX e Fast Refresh |

### Ferramentas externas (sem instalar)

| Ferramenta | Versão | Uso |
|---|---|---|
| firebase-tools (via `npx`) | 15.31.0 | Emuladores nos testes e publicação de regras e índices no deploy |
| actions/checkout, actions/setup-node | v5 | Workflows do GitHub Actions |
| actions/setup-java | v5 | Java 21 para os emuladores no CI |
| actions/configure-pages, upload-pages-artifact, deploy-pages | v5, v4, v4 | Publicação no GitHub Pages |

Gráficos, Gantt, calendário e linha do tempo são feitos à mão em SVG e CSS, sem
biblioteca: o Gantt precisa de interações específicas (cascata durante o arraste,
dependências por arraste) que bibliotecas prontas não oferecem do jeito do Toggl.

## 2.3 Scripts

| Comando | O que faz |
|---|---|
| `npm install` | Instala tudo (workspaces) |
| `npm run dev` | Sobe a web no Vite (porta 5173). Sem `.env`, abre no modo local |
| `npm run build` | Gera o site estático em `apps/web/dist` |
| `npm run preview` | Serve o build localmente para conferência |
| `npm test` | Testes dos três pacotes (a camada de dados roda no lowdb em memória) |
| `npm run test:firebase` | Sobe os emuladores do Firebase (Auth e Firestore, com `firestore.rules`) e roda as mesmas suítes mais os testes de regras |
| `npm run typecheck` | `tsc --noEmit` nos três pacotes |
| `npm run lint` | ESLint no repositório |
| `npm run check:text` | Procura travessão, seta e emoji em arquivos versionados |
| `npm run check` | Texto, lint, tipos e testes, nessa ordem |

Não existe mais `npm run seed` nem `npm start`: a demonstração é criada pela própria
interface (botão "Explorar com dados de exemplo" no modo local, ou "Preencher com dados
de exemplo" ao criar um workspace) e o site publicado é estático.

## 2.4 Variáveis de ambiente

Modelo em `.env.example`. O Vite lê o `.env` da **raiz** do repositório (`envDir`), e
toda variável precisa do prefixo `VITE_` para chegar à web. No GitHub Actions elas vêm
dos secrets (seção 2.6).

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | vazio | Configuração do app web do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | vazio | Idem (normalmente `projeto.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | vazio | Idem |
| `VITE_FIREBASE_APP_ID` | vazio | Idem |
| `VITE_FIREBASE_STORAGE_BUCKET` | vazio | Opcional |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | vazio | Opcional |
| `VITE_DATA_MODE` | `auto` | `auto`: Firebase se configurado e respondendo, senão local. `firebase`: só Firebase. `local`: sempre local |
| `VITE_FIREBASE_EMULATOR_HOST` | vazio | Em desenvolvimento, aponta para os emuladores (Auth na 9099, Firestore na 8080) |
| `VITE_BASE_PATH` | `/` | Subcaminho de publicação; o workflow do Pages preenche sozinho |

As quatro primeiras são obrigatórias para o modo Firebase; sem qualquer uma delas o app
usa o modo local. Essa configuração **não é segredo** (vai dentro do JavaScript
publicado); quem protege os dados é `firestore.rules`.

## 2.5 TypeScript e build

- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `moduleResolution: Bundler`, `noEmit`. Nenhum pacote emite JavaScript pelo `tsc`.
- `@ott/shared` e `@ott/data` são consumidos como código-fonte TypeScript (`exports`
  aponta para `src/index.ts`); o Vite compila junto com a web.
- O módulo `packages/data/src/firebase` é carregado por import dinâmico, então o build
  gera um pedaço separado com o SDK do Firebase (cerca de 165 kB comprimido) que só é
  baixado quando o modo Firebase é tentado.
- A web usa CSS Modules (`*.module.css`) mais os tokens globais.

## 2.6 Publicação no GitHub Pages

O workflow `.github/workflows/deploy.yml` roda a cada push na `main` (e pelo botão "Run
workflow"). Ele faz `npm run check`, gera o build com o subcaminho do Pages e a
configuração do Firebase, cria o `404.html` para as rotas do React Router, publica no
Pages e, se houver conta de serviço, publica as regras e os índices do Firestore.

Passo a passo para ligar:

1. **Firebase.** No [console](https://console.firebase.google.com), crie o projeto,
   ative **Authentication** com o provedor **E-mail/senha**, crie o banco do **Cloud
   Firestore** (modo de produção) e registre um **app da Web** para obter a
   configuração (`apiKey`, `authDomain`, `projectId`, `appId`...).
2. **Domínio autorizado.** Em Authentication, Configurações, Domínios autorizados,
   acrescente `seu-usuario.github.io` (ou o domínio próprio).
3. **Secrets do repositório** (Settings, Secrets and variables, Actions, aba Secrets):

   | Secret | Obrigatório | Conteúdo |
   |---|---|---|
   | `FIREBASE_API_KEY` | sim | `apiKey` |
   | `FIREBASE_AUTH_DOMAIN` | sim | `authDomain` |
   | `FIREBASE_PROJECT_ID` | sim | `projectId` |
   | `FIREBASE_APP_ID` | sim | `appId` |
   | `FIREBASE_STORAGE_BUCKET` | não | `storageBucket` |
   | `FIREBASE_MESSAGING_SENDER_ID` | não | `messagingSenderId` |
   | `FIREBASE_SERVICE_ACCOUNT` | não | JSON de uma conta de serviço com os papéis Firebase Rules Admin e Cloud Datastore Index Admin, para o workflow publicar `firestore.rules` e `firestore.indexes.json` |

   Variável opcional (aba Variables): `DATA_MODE` com `auto`, `firebase` ou `local`.
4. **Pages.** Em Settings, Pages, escolha **Source: GitHub Actions**.
5. **Publicar.** Faça push na `main` ou rode o workflow manualmente. O endereço aparece
   no resumo da execução (`https://seu-usuario.github.io/nome-do-repositorio/`).
6. **Sem conta de serviço**, publique as regras e o índice uma vez à mão:
   `npx firebase-tools@15.31.0 deploy --only firestore:rules,firestore:indexes --project SEU_PROJETO`
   (depois de `npx firebase-tools@15.31.0 login`), ou cole `firestore.rules` no console
   e crie o índice composto de `timeEntries` (`userId` crescente, `start` crescente).

Sem os secrets do Firebase, o site é publicado assim mesmo e funciona no modo local.

### CI de pull requests

`.github/workflows/ci.yml` roda em todo pull request dois trabalhos em paralelo:
`npm run check` com `npm run build`, e `npm run test:firebase` (Java 21 e emuladores),
que executa as suítes da camada de dados contra o Firestore e o Auth emulados, com as
regras de `firestore.rules` valendo.

## 2.7 Desenvolvimento com o Firebase

- **Modo local:** `npm run dev` sem `.env`. Tudo fica no `localStorage` do navegador
  (chave `ott.local.v1`). Para recomeçar do zero, limpe os dados do site no navegador.
- **Emuladores:** `npx firebase-tools@15.31.0 emulators:start --only auth,firestore --project demo-ott`
  em um terminal e, no `.env`, as quatro variáveis obrigatórias com valores quaisquer
  (por exemplo `demo-key`, `localhost`, `demo-ott`, `demo-app`) mais
  `VITE_FIREBASE_EMULATOR_HOST=127.0.0.1`. Projetos com prefixo `demo-` não tocam em
  nada real.
- **Projeto real:** preencha o `.env` com a configuração do app web.

## 2.8 Decisões de segurança de dependências

- `npm audit` deve terminar com zero vulnerabilidades.
- O SDK do Firebase 12 depende de `@grpc/grpc-js` 1.9, com falhas conhecidas (corrigidas
  na 1.13.6). O `overrides` da raiz fixa `@grpc/grpc-js` 1.13.6. O gRPC só é usado
  quando o SDK roda no Node (testes); no navegador o Firestore usa WebChannel. Remova o
  override quando o SDK passar a depender de uma versão corrigida.
- `firebase` fica na 12.19.0: a 13.0.0 tinha menos de duas semanas quando o projeto
  migrou. Atualize junto com os testes no emulador.
- O `overrides` de `vite` na raiz contorna um defeito do npm 10 ao resolver dependências
  opcionais do vitest 4 (erro "Cannot read properties of null (reading 'edgesOut')").
  Não remova sem testar `npm install` do zero.

## 2.9 Adicionando uma dependência

1. Prefira o que a plataforma já oferece (navegador, `Intl`, Web Crypto) e o que já
   está na tabela.
2. Fixe a versão exata e confira `npm audit`.
3. Atualize a tabela da seção 2.2 no mesmo commit.
