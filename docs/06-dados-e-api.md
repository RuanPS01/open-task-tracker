# 6. Dados e API

> Fonte da verdade: `apps/api/src/db/migrations.ts` (esquema), `packages/shared/src/entities.ts`
> (formato JSON), `packages/shared/src/schemas.ts` (entradas aceitas). Mudou um deles?
> Atualize este documento no mesmo commit.

## 6.1 Persistência

- Um arquivo SQLite (padrão `apps/api/data/ott.sqlite` quando a API roda pelos scripts do
  npm). Modo WAL, `foreign_keys` ligado, `busy_timeout` de 5 s.
- Migrações versionadas, aplicadas em ordem na partida e registradas em
  `schema_migrations`:

| Versão | Nome | Conteúdo |
|---|---|---|
| 1 | esquema inicial | Todas as tabelas da seção 6.2 exceto `holidays` |
| 2 | feriados e tarefas em dias não úteis | `tasks.allow_non_working_days` e tabela `holidays` |

- Transações com `db.transaction()`; chamadas aninhadas viram `SAVEPOINT`.

## 6.2 Tabelas

### `workspaces`
| Coluna | Tipo | Observação |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| currency | TEXT | `BRL`, `USD` ou `EUR` (padrão `BRL`) |
| default_hourly_rate | REAL nulo | Valor/hora padrão |
| working_days | TEXT | Dias úteis da semana, "1,2,3,4,5" (0 = domingo) |
| auto_schedule | INTEGER | 1 liga a cascata de dependências |
| created_at | TEXT | ISO UTC |

### `users`
| Coluna | Tipo | Observação |
|---|---|---|
| id | INTEGER PK | |
| name, email | TEXT | e-mail único sem diferenciar maiúsculas |
| password_hash | TEXT | `scrypt$N$r$p$sal$hash` |
| avatar_color | TEXT | Cor estável derivada do e-mail |
| current_workspace_id | INTEGER nulo | Workspace aberto por último |
| preferences | TEXT (JSON) | tema, idioma, início da semana, formatos, fuso |
| created_at | TEXT | |

### `sessions`
`id` (SHA-256 do token, PK), `user_id`, `created_at`, `expires_at`.

### `workspace_members`
PK (`workspace_id`, `user_id`); `role` (`admin` ou `member`), `weekly_capacity_hours`
(padrão 40), `hourly_rate` nulo, `active`, `joined_at`.

### `clients`
`id`, `workspace_id`, `name` (único no workspace), `archived`, `created_at`.

### `tags`
`id`, `workspace_id`, `name` (único no workspace, sem diferenciar maiúsculas), `created_at`.

### `holidays`
`id`, `workspace_id`, `date` (`AAAA-MM-DD`, única no workspace), `name`, `created_at`.

### `projects`
`id`, `workspace_id`, `client_id` (nulo; vira nulo se o cliente for excluído), `name`,
`color` (`#rrggbb`), `billable`, `estimate_seconds`, `hourly_rate`, `start_date`,
`end_date`, `archived`, `created_at`, `updated_at`.

### `project_pins`
PK (`user_id`, `project_id`). Fixar é preferência individual, como no Toggl.

### `tasks`
| Coluna | Tipo | Observação |
|---|---|---|
| id | INTEGER PK | |
| workspace_id | INTEGER | |
| project_id | INTEGER nulo | Excluir o projeto exclui as tarefas |
| parent_id | INTEGER nulo | Subtarefa; excluir a mãe exclui as filhas |
| name, description, notes | TEXT | |
| status | TEXT | `todo`, `in_progress`, `done` |
| priority | INTEGER | 0 (nenhuma) a 4 (urgente) |
| start_date, due_date | TEXT nulo | `AAAA-MM-DD`, sem fuso |
| estimate_seconds | INTEGER nulo | |
| estimate_mode | TEXT | `total` ou `per_day` |
| progress | INTEGER | 0 a 100 |
| is_milestone | INTEGER | Marco: início igual ao fim |
| allow_non_working_days | INTEGER | Liberada para fins de semana e feriados |
| billable | INTEGER | |
| position | REAL | Ordem entre irmãs |
| created_by, created_at, updated_at, completed_at | | |

### `task_assignees`, `task_tags`
Tabelas de ligação (`task_id`, `user_id`) e (`task_id`, `tag_id`).

### `task_dependencies`
`id`, `workspace_id`, `predecessor_id`, `successor_id` (par único), `type` (`FS`, `SS`,
`FF`, `SF`), `lag_days` (dias úteis, pode ser negativo), `created_at`.

### `time_entries`
| Coluna | Tipo | Observação |
|---|---|---|
| id | INTEGER PK | |
| workspace_id, user_id | INTEGER | |
| project_id, task_id | INTEGER nulo | Viram nulo se o projeto ou a tarefa forem excluídos |
| description | TEXT | |
| start | TEXT | ISO UTC (`2026-10-12T14:00:00.000Z`) |
| stop | TEXT nulo | Nulo enquanto o cronômetro roda |
| billable | INTEGER | |
| created_at, updated_at | TEXT | |

Índice único parcial `time_entries_one_running` em `user_id` onde `stop IS NULL`: no
máximo um cronômetro rodando por pessoa, garantido pelo banco.

### `time_entry_tags`
Ligação (`time_entry_id`, `tag_id`).

## 6.3 Entidades JSON

Definidas em `packages/shared/src/entities.ts`. Campos calculados pela API:

| Entidade | Campo calculado | Como |
|---|---|---|
| `Project` | `trackedSeconds`, `taskCount`, `doneTaskCount`, `memberIds`, `pinned` | Subconsultas; apontamento rodando conta até agora |
| `Task` | `assigneeIds`, `tagIds`, `trackedSeconds` | Subconsultas |
| `TimeEntry` | `duration` | `stop - start`, ou até agora se rodando |
| `Client` | `projectCount` | Projetos ativos do cliente |
| `Workspace` | `role` | Papel de quem pediu |

## 6.4 Rotas

Prefixo `/api`. Autenticação por cookie `ott_session`. Corpos sempre JSON. Rotas com
`:workspaceId` exigem ser membro ativo (senão 404). "admin" indica que só
administradores podem chamar.

### Sessão e perfil
| Método e rota | Descrição |
|---|---|
| `POST /auth/signup` | Cria usuário, workspace padrão e sessão; devolve `SessionResponse` |
| `POST /auth/login` | Abre sessão; 401 `UNAUTHORIZED` se e-mail ou senha não conferem |
| `POST /auth/logout` | Encerra a sessão |
| `GET /auth/session` | Usuário e workspaces (401 sem sessão) |
| `PATCH /me` | Nome, e-mail, preferências |
| `POST /me/password` | Troca senha e derruba as outras sessões |
| `POST /me/workspace` | Troca o workspace atual |
| `GET /me/timer` | `{ entry }`: cronômetro rodando em qualquer workspace, ou nulo |
| `GET /workspaces`, `POST /workspaces` | Listar e criar workspace (quem cria vira admin) |

### Dentro de `/workspaces/:workspaceId`
| Método e rota | Descrição |
|---|---|
| `GET /`, `PATCH /` (admin) | Ler e alterar nome, moeda, valor/hora, dias úteis, agendamento automático |
| `GET /members`, `POST /members` (admin) | Listar; adicionar (cria conta com senha temporária se o e-mail não existir) |
| `PATCH /members/:userId`, `DELETE /members/:userId` (admin) | Papel, capacidade, valor, ativo; remover |
| `GET/POST /clients`, `PATCH/DELETE /clients/:id` | Clientes |
| `GET/POST /tags`, `PATCH/DELETE /tags/:id` | Tags |
| `GET /holidays`, `POST /holidays` (admin), `DELETE /holidays/:id` (admin) | Feriados |
| `POST /holidays/import` (admin) | `{ year, includeOptional }`: importa feriados nacionais do Brasil; devolve `{ created, holidays }` |
| `GET/POST /projects`, `GET/PATCH /projects/:id`, `DELETE /projects/:id` (admin) | Projetos (`pinned` e `archived` no PATCH) |
| `GET /tasks?projectId=&assigneeId=`, `POST /tasks`, `GET/PATCH/DELETE /tasks/:id` | Tarefas |
| `POST /tasks/schedule` | `{ updates: [{ id, startDate, dueDate }] }` do Gantt; devolve `{ tasks }` com tudo que mudou, inclusive pela cascata |
| `GET /dependencies?projectId=`, `POST /dependencies`, `PATCH/DELETE /dependencies/:id` | Dependências |
| `GET /time-entries?from=&to=` | Apontamentos da própria pessoa que tocam o intervalo |
| `POST /time-entries` | Apontamento manual (`start` e `stop` obrigatórios) |
| `POST /time-entries/start` | Inicia cronômetro (para o anterior) |
| `PATCH /time-entries/:id`, `POST /time-entries/:id/stop`, `DELETE /time-entries/:id` | Só os próprios apontamentos |
| `GET /reports/summary`, `GET /reports/detailed`, `GET /reports/detailed.csv` | Relatórios (seção 6.6) |

`GET /api/health` responde `{ ok: true }` sem sessão.

## 6.5 Datas, horas e fusos

- Datas de tarefa, projeto e feriado: `AAAA-MM-DD`, sem fuso. Toda conta usa
  `packages/shared/src/dates.ts`, que trabalha em UTC internamente.
- Instantes (apontamentos, `createdAt`): ISO 8601. A API aceita qualquer fuso na entrada e
  grava sempre em UTC (`toISOString`), o que mantém a comparação como texto correta.
- Relatórios recebem `tz` (fuso IANA da pessoa, por exemplo `America/Sao_Paulo`): o dia de
  um apontamento é o dia local em que começou. Fuso inválido responde `INVALID_TIMEZONE`.
- O cronômetro da web calcula semana e dias no fuso do navegador.

## 6.6 Relatórios

Consulta comum (`reportQuerySchema`): `start`, `end`, `tz`, e filtros opcionais
`userIds`, `projectIds`, `clientIds`, `tagIds`, `taskIds` (listas separadas por vírgula;
`0` significa "sem projeto", "sem cliente", "sem tag", "sem tarefa"), `billable`
(`true` ou `false`) e `description` (contém, sem diferenciar maiúsculas).

- **Valor faturável**: só apontamentos faturáveis; valor/hora do projeto, senão o do
  membro, senão o padrão do workspace.
- **Resumo** (`ReportSummary`): totais, `byDay` (todos os dias do período, inclusive
  zerados), `byProject` com subgrupos por descrição, `byUser`, `byClient`.
- **Detalhado** (`ReportDetailed`): uma linha por apontamento com data local e valor.
- **CSV**: colunas Usuário, E-mail, Cliente, Projeto, Tarefa, Descrição, Faturável, datas e
  horas de início e fim, Duração, Tags, Valor. Em pt-BR usa `;` como separador e vírgula
  decimal; começa com BOM para o Excel reconhecer UTF-8; células iniciadas por `=`, `+`,
  `-` ou `@` recebem apóstrofo (proteção contra fórmula).

## 6.7 Erros

Formato: `{ "error": { "code": "...", "message": "...", "details": ... } }`. A web
traduz pelo `code` (`errors.<CODE>` nos dicionários).

| Código | Status | Quando |
|---|---|---|
| `UNAUTHORIZED` | 401 | Sem sessão, sessão vencida, login inválido |
| `FORBIDDEN` | 403 | Falta permissão (admin) ou apontamento de outra pessoa |
| `NOT_FOUND` | 404 | Recurso ou workspace inexistente ou de outra pessoa |
| `VALIDATION` | 400 | Corpo ou consulta fora do esquema (`details` lista os campos) |
| `EMAIL_TAKEN`, `NAME_TAKEN`, `DATE_TAKEN` | 409 | Duplicidade |
| `INVALID_DATES`, `INVALID_RANGE`, `INVALID_PARENT`, `INVALID_ASSIGNEE`, `INVALID_TIMEZONE` | 400 | Regra de dado |
| `DEPENDENCY_SELF`, `DEPENDENCY_HIERARCHY`, `DEPENDENCY_DUPLICATE`, `DEPENDENCY_CYCLE` | 409 | Dependência recusada |
| `LAST_ADMIN`, `REMOVE_SELF`, `ALREADY_MEMBER`, `WRONG_PASSWORD` | 400 ou 409 | Membros e senha |
| `INTERNAL` | 500 | Falha inesperada (detalhe só no log) |

## 6.8 Dados guardados no navegador

Só conveniências por pessoa, com prefixo `ott.`: `ott.theme`, `ott.locale`,
`ott.sidebarCollapsed`, `ott.timerView`, `ott.timerSpan`, `ott.timerMode`,
`ott.showWeekends`, `ott.tasksView`, `ott.tasksAssignee`, `ott.tasksGroup`,
`ott.tasksSort`, `ott.tasksDesc`, `ott.tasksShowDone`, `ott.projectsStatus`,
`ott.projectTasks*`, `ott.ganttZoom`, `ott.ganttCritical`, `ott.ganttCompact`,
`ott.timelineGroup`, `ott.timelinePeriod`, `ott.timelineZoom`, `ott.reportsView`.
Perder qualquer uma delas só volta a tela ao padrão.

## 6.9 Dados de demonstração

`npm run seed` cria, relativo à data de hoje: workspace "Estúdio Aurora", quatro pessoas
(`demo@exemplo.com`, `bruno@`, `carla@`, `diego@exemplo.com`, todas com senha `demo1234`),
dois clientes, cinco tags, quatro projetos com tarefas hierárquicas e 18 dependências,
os feriados nacionais do ano atual e do seguinte, uma tarefa liberada para o fim de
semana e duas semanas de apontamentos. O seed usa os mesmos serviços das rotas.
