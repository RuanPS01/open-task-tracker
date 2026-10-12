# 6. Dados e armazenamento

> Fonte da verdade: `packages/data/src/store/schema.ts` (caminhos e documentos),
> `firestore.rules` (acesso), `packages/shared/src/entities.ts` (formato entregue à web),
> `packages/shared/src/schemas.ts` (entradas aceitas). Mudou um deles? Atualize este
> documento no mesmo commit.

## 6.1 Persistência

Os dois modos guardam os mesmos documentos nos mesmos caminhos:

| Modo | Onde | Login |
|---|---|---|
| Firebase | Cloud Firestore (coleções e subcoleções da seção 6.2) | Firebase Authentication, e-mail e senha |
| Local | lowdb sobre o `localStorage`, chave `ott.local.v1`: um objeto por caminho de coleção, com os documentos pelo id | Contas no mesmo lowdb, senha com PBKDF2 (SHA-256, 100 mil iterações) |

- **Ids.** Texto de 20 caracteres gerado pela camada de dados (`randomId`), igual ao
  formato do Firestore. Exceções: o perfil e o membro usam o uid da pessoa (28
  caracteres no modo local); o feriado usa a própria data; o convite usa 40 caracteres
  (é o segredo do link). `NO_ID` (`"none"`) é reservado para "nenhum" (filtros e raias).
- **Gravação em lote.** Toda operação monta um `Batch` e grava tudo de uma vez
  (`commit`): no Firestore, `writeBatch` (dividido em partes de 400 operações; só a
  demonstração e exclusões grandes passam disso); no lowdb, um rascunho das coleções
  tocadas que só é salvo se todas as operações derem certo.
- **Sem migrações.** Documentos antigos continuam válidos: campo novo precisa de padrão
  na leitura. Ver a regra 7 de [00-regras-para-ia.md](00-regras-para-ia.md).
- **Modo local e várias abas.** Antes de gravar, o lowdb relê o `localStorage`, e as
  outras abas recebem o evento `storage`, releem e atualizam a tela.

## 6.2 Coleções e documentos

Tipos em `packages/data/src/store/schema.ts`. Instantes em ISO 8601 UTC; datas de
calendário em `AAAA-MM-DD`.

### `users/{uid}`
| Campo | Observação |
|---|---|
| id, name, email, avatarColor | Cor estável derivada do e-mail |
| currentWorkspaceId | Workspace aberto por último (nulo se nenhum) |
| preferences | tema, idioma, início da semana, formatos, fuso |
| pinnedProjectIds | Projetos fixados pela pessoa (preferência individual, como no Toggl) |
| runningEntry | `{ workspaceId, entryId }` do cronômetro rodando, ou nulo |
| createdAt | |

### `workspaces/{workspaceId}`
| Campo | Observação |
|---|---|
| id, name | |
| currency | `BRL`, `USD` ou `EUR` (padrão `BRL`) |
| defaultHourlyRate | Valor/hora padrão, nulo |
| workingDays | Dias úteis da semana, `[1,2,3,4,5]` (0 = domingo) |
| autoSchedule | Liga a cascata de dependências |
| memberIds | Uids dos membros **ativos**: é o que as regras consultam para liberar acesso |
| adminIds | Uids dos administradores ativos |
| createdBy, createdAt | |

`memberIds` e `adminIds` são recalculados pelo serviço de membros a cada mudança de
papel, ativação ou remoção, e acrescidos pelo próprio convidado ao aceitar um convite.

### Subcoleções de `workspaces/{workspaceId}/`

| Subcoleção | Id | Campos |
|---|---|---|
| `members` | uid | `userId`, `workspaceId`, `name`, `email`, `avatarColor` (cópia do perfil), `role` (`admin` ou `member`), `weeklyCapacityHours` (padrão 40), `hourlyRate`, `active`, `joinedAt`, `inviteId` (convite usado para entrar) |
| `invites` | 40 caracteres | `workspaceName`, `email` (só lembrete), `role`, `weeklyCapacityHours`, `hourlyRate`, `createdBy`, `createdAt` |
| `clients` | gerado | `name` (único no workspace, sem diferenciar maiúsculas), `archived`, `createdAt` |
| `tags` | gerado | `name` (único no workspace), `createdAt` |
| `holidays` | a data | `date`, `name` (um feriado por data) |
| `projects` | gerado | `clientId`, `name`, `color` (`#rrggbb`), `billable`, `estimateSeconds`, `hourlyRate`, `startDate`, `endDate`, `archived`, `trackedSeconds`, `trackerIds`, `createdAt`, `updatedAt` |
| `tasks` | gerado | `projectId`, `parentId`, `name`, `description`, `notes`, `status` (`todo`, `in_progress`, `done`), `priority` (0 a 4), `startDate`, `dueDate`, `estimateSeconds`, `estimateMode` (`total` ou `per_day`), `progress` (0 a 100), `isMilestone`, `allowNonWorkingDays`, `billable`, `position`, `assigneeIds`, `tagIds`, `trackedSeconds`, `createdBy`, `createdAt`, `updatedAt`, `completedAt` |
| `dependencies` | gerado | `predecessorId`, `successorId` (par único), `type` (`FS`, `SS`, `FF`, `SF`), `lagDays` (dias úteis, pode ser negativo), `createdAt` |
| `timeEntries` | gerado | `userId`, `projectId`, `taskId`, `description`, `start`, `stop` (nulo enquanto roda), `billable`, `tagIds`, `createdAt`, `updatedAt` |

Todo documento de subcoleção guarda também `id` e `workspaceId` (as regras conferem os
dois).

### O que acontece nas exclusões

| Exclusão | Efeito (no mesmo lote) |
|---|---|
| Projeto (admin) | Exclui as tarefas do projeto e as dependências delas; apontamentos ficam sem projeto e sem tarefa |
| Tarefa | Exclui as subtarefas e as dependências que tocam qualquer uma; apontamentos ficam sem tarefa; recalcula o cronograma |
| Cliente | Projetos ficam sem cliente |
| Tag | Sai das tarefas e dos apontamentos (de todas as pessoas) |
| Membro (admin) | Sai das listas de acesso e das tarefas em que era responsável; apontamentos ficam |

## 6.3 Campos calculados

| Entidade | Campo | Como |
|---|---|---|
| `Project` | `trackedSeconds` | Somado no documento: cada apontamento encerrado soma (ou subtrai) com `increment` no mesmo lote |
| `Project` | `taskCount`, `doneTaskCount` | Contados nas tarefas do workspace na leitura |
| `Project` | `memberIds` | `trackerIds` (quem já apontou) mais os responsáveis das tarefas do projeto |
| `Project` | `pinned` | `pinnedProjectIds` do perfil de quem lê |
| `Task` | `trackedSeconds` | Somado no documento, como no projeto |
| `TimeEntry` | `duration` | `stop - start`, ou até agora se rodando |
| `Client` | `projectCount` | Projetos ativos do cliente |
| `Workspace` | `role` | `admin` se o uid está em `adminIds` |

Apontamento rodando não entra em `trackedSeconds`: as horas entram quando ele para.

## 6.4 Regras de acesso (`firestore.rules`)

| Caminho | Ler | Criar ou alterar | Excluir |
|---|---|---|---|
| `users/{uid}` | a própria pessoa | a própria pessoa | a própria pessoa |
| `workspaces/{id}` | quem está em `memberIds` | criar: quem cria vira o único membro e admin; alterar: admin, ou o convidado se acrescentando com o papel do convite | ninguém |
| `members/{uid}` | membros, e cada pessoa o próprio | admin; a própria pessoa ao aceitar convite (papel, capacidade e valor iguais aos do convite); a própria pessoa só em nome, e-mail e cor | admin |
| `invites/{id}` | qualquer pessoa logada que tenha o id (o link); listar só admin | admin | admin, ou o convidado ao aceitar |
| `holidays` | membros | admin | admin |
| `clients`, `tags`, `tasks`, `dependencies` | membros | membros | membros |
| `projects` | membros | membros | admin |
| `timeEntries` | membros (relatórios) | criar: o dono, ou admin; alterar: o dono ou admin, e qualquer membro só para soltar tarefa, projeto ou tag | o dono ou admin |

Os serviços repetem as mesmas guardas (`loadWorkspace`, `loadAdminWorkspace`,
`ownEntry`) para o modo local e para dar a mensagem certa antes de ir ao servidor.
As regras são testadas em `packages/data/test/rules.ts` com o SDK direto (tentativas que
a web nunca faz), além das suítes normais rodando no emulador.

## 6.5 Operações da camada de dados

A fachada `Backend` (`packages/data/src/backend.ts`) substitui as antigas rotas HTTP.
Toda entrada passa pelo esquema zod de `@ott/shared`.

### Sessão e perfil (`session`)
| Operação | Descrição |
|---|---|
| `signup` | Cria a conta, o perfil e o workspace padrão (com a pessoa como admin) |
| `login`, `logout`, `get` | `get` devolve `SessionResponse` ou nulo; corrige `currentWorkspaceId` se o workspace sumiu |
| `updateProfile` | Nome, preferências e (só no modo local) e-mail; nome e e-mail são copiados para os membros |
| `changePassword` | Confere a senha atual (`WRONG_PASSWORD`) e troca |
| `switchWorkspace` | Troca o workspace atual |
| `runningTimer` | Cronômetro rodando em qualquer workspace, ou nulo |
| `startDemo` | Só modo local: entra na conta de demonstração (cria na primeira vez) |

### Workspace (`workspaces`, `members`, `clients`, `tags`, `holidays`)
| Operação | Descrição |
|---|---|
| `workspaces.create(name, { demo })` | Cria o workspace (quem cria vira admin); com `demo`, preenche com os dados de exemplo |
| `workspaces.update` (admin) | Nome, moeda, valor/hora, dias úteis, agendamento automático (mudou o calendário, recalcula o cronograma) |
| `members.list`, `update` (admin), `remove` (admin) | Papel, capacidade, valor, ativo; `LAST_ADMIN` e `REMOVE_SELF` |
| `members.createInvite` (admin), `listInvites` (admin), `revokeInvite` (admin) | Convites por link |
| `members.getInvite`, `acceptInvite` | Lê o convite pelo link e entra no workspace (seção 7.2) |
| `clients.*`, `tags.*` | Listar, criar, alterar, excluir |
| `holidays.list`, `create` (admin), `importNational` (admin), `remove` (admin) | Feriados; importar devolve `{ created, holidays }` |

### Projetos, tarefas e apontamentos
| Operação | Descrição |
|---|---|
| `projects.list`, `create`, `update` (inclui `pinned` e `archived`), `remove` (admin) | Projetos |
| `tasks.list`, `create`, `update`, `remove` | Tarefas (o workspace inteiro numa leitura) |
| `tasks.schedule` | `{ updates: [{ id, startDate, dueDate }] }` do Gantt; devolve `{ tasks }` com tudo que mudou, inclusive pela cascata |
| `dependencies.list`, `create`, `update`, `remove` | Dependências |
| `timeEntries.list(workspaceId, from, to)` | Apontamentos da própria pessoa que tocam o intervalo |
| `timeEntries.create` | Apontamento manual (`start` e `stop` obrigatórios) |
| `timeEntries.start` | Inicia cronômetro (para o anterior, em qualquer workspace) |
| `timeEntries.update`, `stop`, `remove` | Só os próprios apontamentos |
| `reports.summary`, `detailed`, `csv` | Relatórios (seção 6.7) |

### Índices

Consultas usam só igualdade, `array-contains` e um intervalo num campo, que o Firestore
indexa sozinho. A única exceção é a lista de apontamentos do cronômetro (`userId` igual
e `start` num intervalo), que usa o índice composto de `firestore.indexes.json`. Sem ele
publicado, a tela do cronômetro mostra o erro `FIRESTORE_INDEX`.

A lista do cronômetro busca a partir de 7 dias antes do início da janela para pegar o
que começou antes e terminou dentro dela; apontamento com mais de 7 dias de duração que
começou antes disso não aparece na janela (continua nos relatórios, que usam o dia de
início).

## 6.6 Datas, horas e fusos

- Datas de tarefa, projeto e feriado: `AAAA-MM-DD`, sem fuso. Toda conta usa
  `packages/shared/src/dates.ts`, que trabalha em UTC internamente.
- Instantes (apontamentos, `createdAt`): ISO 8601. Os serviços aceitam qualquer fuso na
  entrada e gravam sempre em UTC (`toISOString`), o que mantém a comparação como texto
  correta (inclusive nos filtros de intervalo do Firestore).
- Relatórios recebem `tz` (fuso IANA da pessoa, por exemplo `America/Sao_Paulo`): o dia de
  um apontamento é o dia local em que começou. Fuso inválido dá `INVALID_TIMEZONE`.
- O cronômetro da web calcula semana e dias no fuso do navegador.

## 6.7 Relatórios

Consulta comum (`reportQuerySchema`): `start`, `end`, `tz`, e filtros opcionais
`userIds`, `projectIds`, `clientIds`, `tagIds`, `taskIds` (listas de ids; `NO_ID`
significa "sem projeto", "sem cliente", "sem tag", "sem tarefa"), `billable` (booleano)
e `description` (contém, sem diferenciar maiúsculas).

- **Leitura**: apontamentos do workspace com `start` entre um dia antes e dois dias
  depois do período (cobre qualquer fuso); o corte exato é feito com a data local.
- **Valor faturável**: só apontamentos faturáveis; valor/hora do projeto, senão o do
  membro, senão o padrão do workspace.
- **Resumo** (`ReportSummary`): totais, `byDay` (todos os dias do período, inclusive
  zerados), `byProject` com subgrupos por descrição, `byUser`, `byClient`.
- **Detalhado** (`ReportDetailed`): uma linha por apontamento com data local e valor.
- **CSV**: gerado no navegador e baixado como arquivo. Colunas Usuário, E-mail, Cliente,
  Projeto, Tarefa, Descrição, Faturável, datas e horas de início e fim, Duração, Tags,
  Valor. Em pt-BR usa `;` como separador e vírgula decimal; começa com BOM para o Excel
  reconhecer UTF-8; células iniciadas por `=`, `+`, `-` ou `@` recebem apóstrofo
  (proteção contra fórmula).

## 6.8 Erros

Os serviços lançam `AppError` com `code`, `message` e `details`. A web traduz pelo `code`
(`errors.<CODE>` nos dicionários); a mensagem é só para log e testes. Erros do Firebase
são traduzidos em `packages/data/src/firebase/index.ts`.

| Código | Quando |
|---|---|
| `UNAUTHORIZED` | Sem sessão ou sessão vencida |
| `INVALID_CREDENTIALS` | E-mail ou senha não conferem no login |
| `FORBIDDEN` | Falta permissão (admin), apontamento de outra pessoa, ou o Firestore recusou |
| `NOT_FOUND` | Recurso ou workspace inexistente ou de outra pessoa |
| `VALIDATION` | Entrada fora do esquema (`details` lista os campos) |
| `EMAIL_TAKEN`, `NAME_TAKEN`, `DATE_TAKEN` | Duplicidade |
| `INVALID_DATES`, `INVALID_RANGE`, `INVALID_PARENT`, `INVALID_ASSIGNEE`, `INVALID_TIMEZONE` | Regra de dado |
| `DEPENDENCY_SELF`, `DEPENDENCY_HIERARCHY`, `DEPENDENCY_DUPLICATE`, `DEPENDENCY_CYCLE` | Dependência recusada |
| `LAST_ADMIN`, `REMOVE_SELF`, `ALREADY_MEMBER`, `WRONG_PASSWORD` | Membros e senha |
| `INVITE_NOT_FOUND` | Convite inexistente, revogado ou já usado |
| `WEAK_PASSWORD`, `TOO_MANY_REQUESTS`, `AUTH_DISABLED` | Firebase Auth (senha fraca, muitas tentativas, e-mail e senha desligado no console) |
| `EMAIL_CHANGE_UNSUPPORTED`, `DEMO_LOCAL_ONLY` | Recurso só do modo local |
| `NETWORK`, `QUOTA`, `FIRESTORE_INDEX` | Sem conexão, limite do Firebase, índice composto não publicado |
| `UNKNOWN`, `INTERNAL` | Falha inesperada |

## 6.9 Dados guardados no navegador

- **Conveniências por pessoa**, com prefixo `ott.`: `ott.theme`, `ott.locale`,
  `ott.sidebarCollapsed`, `ott.timerView`, `ott.timerSpan`, `ott.timerMode`,
  `ott.showWeekends`, `ott.tasksView`, `ott.tasksAssignee`, `ott.tasksGroup`,
  `ott.tasksSort`, `ott.tasksDesc`, `ott.tasksShowDone`, `ott.projectsStatus`,
  `ott.projectTasks*`, `ott.ganttZoom`, `ott.ganttCritical`, `ott.ganttCompact`,
  `ott.timelineGroup`, `ott.timelinePeriod`, `ott.timelineZoom`, `ott.reportsView`.
  Perder qualquer uma delas só volta a tela ao padrão.
- **Modo local**: `ott.local.v1` guarda todos os dados, as contas e a sessão. Apagar
  essa chave apaga tudo do modo local naquele navegador.
- **Modo Firebase**: o SDK guarda a sessão de login no IndexedDB do navegador.

## 6.10 Dados de demonstração

`packages/data/src/services/demo.ts` monta tudo em memória, relativo à data de hoje, e
grava em poucos lotes (no Firestore, criar item por item levaria minutos): três pessoas
fictícias (Bruno, Carla e Diego, membros sem conta) além de quem pediu, dois clientes,
cinco tags, quatro projetos com tarefas hierárquicas e 18 dependências, os feriados
nacionais do ano atual e do seguinte, uma tarefa liberada para o fim de semana e duas
semanas de apontamentos, com as horas já somadas em tarefas e projetos. As datas das
tarefas-mãe saem do mesmo `applyScheduling` dos serviços.

- **Modo local**: o botão "Explorar com dados de exemplo" do login cria a conta
  `demo@exemplo.com` (senha `demo1234`, nome Ana Souza) com o workspace "Estúdio Aurora".
- **Os dois modos**: "Preencher com dados de exemplo" ao criar um workspace.
