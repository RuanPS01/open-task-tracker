# 5. Padrões de código e nomes

## 5.1 Idioma

| O quê | Idioma |
|---|---|
| Comentários, documentação, mensagens de commit, mensagens de erro da API | Português do Brasil |
| Identificadores (variáveis, funções, tipos, arquivos, rotas, colunas) | Inglês |
| Textos da interface | `pt-BR.ts` (referência) e `en.ts` |
| Dados de demonstração | Português do Brasil |

Todo texto em português usa acentos e cedilha corretos. Nada de travessão, seta ou
emoji (regra 3 do [documento 00](00-regras-para-ia.md)).

## 5.2 Arquivos e pastas

| Tipo | Padrão | Exemplo |
|---|---|---|
| Componente React | `PascalCase.tsx`, um componente principal por arquivo | `TaskPanel.tsx` |
| Estilo do componente | mesmo nome com `.module.css` | `TaskPanel.module.css` |
| Lógica pura de uma tela | `camelCase.ts` ao lado da tela | `ganttModel.ts`, `taskGrouping.ts` |
| Teste | mesmo nome com `.test.ts` (web) ou em `test/` (api, shared) | `ganttModel.test.ts`, `test/tasks.test.ts` |
| Módulo da API | `modules/<recurso-no-plural>/{repo,service,routes}.ts` | `modules/time-entries/service.ts` |
| Pasta de tela | `features/<tela>` em inglês | `features/timeline` |

## 5.3 Código TypeScript

| Elemento | Padrão | Exemplo |
|---|---|---|
| Componente, tipo, interface | `PascalCase` | `GanttChartProps`, `TaskDraft` |
| Função, variável, hook | `camelCase`; hooks começam com `use` | `computeAllocations`, `useWorkCalendar` |
| Constante de módulo | `UPPER_SNAKE_CASE` | `ROW_HEIGHT`, `PROJECT_COLORS` |
| Lista fechada de valores | `as const` + tipo derivado | `TASK_STATUSES`, `TaskStatus` |
| Booleano | prefixo `is`, `has`, `allow`, `show` | `isMilestone`, `allowNonWorkingDays` |
| Data de calendário | tipo `IsoDate`, nome terminando em `Date` | `startDate`, `dueDate` |
| Instante | tipo `IsoDateTime`, nome sem `Date` | `start`, `stop`, `createdAt` |
| Duração | sempre em segundos inteiros, nome com `Seconds` | `estimateSeconds`, `trackedSeconds` |

- Importações de tipo com `import type` (o ESLint exige).
- Sem `any`. Para dado externo, valide com zod; para JSON do banco, converta no `repo.ts`.
- Funções puras e testáveis ficam fora dos componentes (`*Model.ts`, `shared`).

## 5.4 Banco, API e textos

| Elemento | Padrão | Exemplo |
|---|---|---|
| Tabela | `snake_case` no plural | `time_entries`, `task_dependencies` |
| Coluna | `snake_case` | `allow_non_working_days` |
| Booleano no banco | `INTEGER` 0 ou 1 (o `node:sqlite` não aceita `boolean`); converter com `bool()` | `billable` |
| JSON da API | `camelCase` | `allowNonWorkingDays` |
| Rota | substantivo no plural, minúsculas, hífen | `/time-entries/:id/stop` |
| Código de erro | `UPPER_SNAKE_CASE`, estável | `DEPENDENCY_CYCLE` |
| Chave de tradução | caminho por tela, `camelCase` | `t.tasks.nonWorkingDays` |
| Texto com número | função no dicionário, com plural | `t.tasks.count(n)` |
| Chave do navegador | prefixo `ott.` | `ott.ganttZoom` |
| Chave do React Query | fábrica em `api/keys.ts` | `keys.tasks(wid)` |

## 5.5 Granularidade

- Componente com mais de ~300 linhas ou mais de uma responsabilidade visual: quebre em
  arquivos na mesma pasta (veja como o painel de tarefa foi dividido em `TaskFields`,
  `SubtaskSection`, `DependencySection`, `AllocationSection`).
- Lógica que não depende de React vai para um `*.ts` puro com teste.
- Regra usada pela API e pela web vai para `packages/shared`.
- Um hook de dados por operação; nada de "hook genérico que faz tudo".
- Estado de tela local com `useState`; estado que outras telas precisam vai para contexto
  (como o painel de tarefa) ou para o cache do React Query.

## 5.6 Comentários

Comente o **porquê**, não o **o quê**. Bons comentários explicam a decisão e o defeito
que ela evita:

```ts
// Datas de tarefa e de Gantt não são instantes: "dia 12" é dia 12 em qualquer fuso.
// Por isso toda conta aqui usa UTC internamente, o que evita o defeito clássico de
// horário de verão em que somar 1 dia a meia-noite local cai no mesmo dia.
```

Cada arquivo com regra não óbvia começa com um comentário de duas a quatro linhas
dizendo o que ele resolve. Não deixe código comentado nem `TODO` sem dono: registre o
item como `[planejado]` no [documento 09](09-contexto-do-produto.md).

## 5.7 Testes

| Pacote | Onde | Como |
|---|---|---|
| `shared` | `packages/shared/test/*.test.ts` | Unitários, datas fixas (nunca "hoje") |
| `api` | `apps/api/test/*.test.ts` | Integração com `buildApp` + banco `:memory:` + `app.inject`; helpers em `test/helpers.ts` |
| `web` | `src/**/*.test.ts` | Unitários da lógica pura das telas (sem DOM) |

Nome do caso de teste em português, descrevendo o comportamento ("empurra a sucessora
preservando dias úteis"). Bug corrigido ganha teste que falharia antes da correção.

## 5.8 Git

- Nunca commit direto na `main`; branch por trabalho.
- Mensagem de commit em português: título no imperativo até ~60 caracteres, linha em
  branco, corpo explicando o porquê. Sem travessão, seta ou emoji.
- Antes de cada commit: `npm run check`.
