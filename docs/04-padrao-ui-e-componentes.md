# 4. Padrão de interface e componentes

> Antes de criar um componente, procure aqui. Criou, renomeou ou removeu um item desta
> lista? Atualize este documento no mesmo commit.

## 4.1 Anatomia de uma página

Toda tela interna segue a mesma estrutura do Toggl Track:

```
+---------------------------------------------------------------+
| Barra lateral | PageHeader: "Tarefas · Lista"    [Ação ciano]  |
| (Sidebar)     |------------------------------------------------|
|               | Toolbar: [Minhas tarefas] [Filtros] [Agrupar]  |
|               |          ...espaço...   [Lista|Quadro] [busca] |
|               |------------------------------------------------|
|               | Corpo com rolagem própria                      |
+---------------------------------------------------------------+
```

- `PageHeader` (`layout/PageHeader.tsx`): título, subtítulo depois de um ponto médio,
  ações à direita. A ação principal é um `Button variant="primary"` com ícone de `+`.
- `Toolbar` (`components/ui/Toolbar.tsx`): uma linha só de controles, com borda inferior.
  Filtros ficam **sempre** numa linha acima do conteúdo que eles afetam, nunca dentro de
  um cartão.
- Corpo: o próprio componente da página define `flex: 1; overflow: auto`.

Telas com interação de arrastar (Cronômetro, Gantt, Linha do tempo) usam eventos de
ponteiro próprios, com limiar de 3 a 4 px para separar clique de arraste.

### Celular (até 760 px)

O limite é um só: `@media (max-width: 760px)` no CSS e `useIsMobile()` (`lib/hooks.ts`,
constante `MOBILE_MEDIA`) no código. Toda tela nova precisa funcionar nessa largura,
sem rolagem horizontal da página.

```
+------------------------------+
| PageHeader (título e ações)  |
|------------------------------|
| Toolbar (uma linha que rola) |
|------------------------------|
| Corpo                        |
|------------------------------|
| Cronômetro rodando           |
| [Cron.][Tarefas][Proj.][Rel.][Menu] |
+------------------------------+
```

- Navegação: `MobileNav` (barra inferior) e a `Sidebar` inteira numa gaveta (botão Menu).
- `Toolbar`: não quebra linha; rola na horizontal.
- `PageHeader`: título com reticências; ação secundária pode virar só ícone com
  `Button mobileIconOnly` (o texto vira `aria-label` e dica).
- `Modal` ocupa a largura da tela e o `SidePanel` (painel de tarefa) a tela inteira.
- Listas em grade (tarefas, lista do cronômetro) usam `grid-template-areas` para virar
  duas linhas: o nome em cima e os detalhes embaixo.
- Tabelas: colunas secundárias recebem a classe `mobileHidden` (somem) e a informação vai
  para uma linha `mobileOnly` embaixo do nome (projetos, membros, clientes, tags,
  relatório detalhado). Tabelas largas por natureza (planilha, semanal) rolam dentro da
  própria área.
- Gráficos de tempo: o Gantt mostra só a coluna do nome (150 px) e a Linha do tempo usa
  a coluna das pessoas com 140 px; o calendário do cronômetro mostra um dia por vez.
- Toque: o dedo rola o calendário do cronômetro (arrastar para criar e mover fica para
  mouse e caneta) e um toque abre o apontamento. Nada pode depender de passar o mouse:
  o que aparece no `:hover` fica sempre visível no celular (botão de iniciar cronômetro
  das linhas).
- Margens laterais de 8 a 12 px e `env(safe-area-inset-*)` onde a tela encosta nas bordas
  do aparelho (barra inferior, login, rodapé dos modais).

## 4.2 Padrões de interação

| Padrão | Como fazer | Exemplo |
|---|---|---|
| Ação principal da página | `Button variant="primary"` no `PageHeader` | "Adicionar tarefa" |
| Filtro, agrupar, ordenar | `ChipButton` dentro de `Menu` ou `Popover` | "Agrupar por: Data" |
| Alternar visão | `Segmented` | Calendário, Lista, Planilha |
| Criar ou editar item rico | Painel lateral (`SidePanel`) ou `Modal` | Painel de tarefa, editor de apontamento |
| Confirmar exclusão | `await confirm({ ..., danger: true })` de `useConfirm` | Excluir projeto |
| Confirmar exclusão que apaga dados de todas as pessoas | `Modal` com o nome digitado para liberar o botão `danger` | Excluir workspace (`DeleteWorkspaceSection`) |
| Avisar resultado | `toast.success()`; erros de mutação já viram aviso sozinhos | "Tarefa criada" |
| Aviso que espera a pessoa | `toast.persistent(texto, { label, onClick })`, sem sumir sozinho | "Nova versão disponível" |
| Tela sem dados | `EmptyState` com ilustração, título, texto e ação | Tarefas vazias |
| Carregando | `LoadingBlock` na primeira carga; esmaecer na recarga | Relatórios |
| Edição na própria linha | Campo que grava ao sair (blur) ou Enter, Esc cancela | Descrição na Lista do cronômetro |
| Salvamento | Painel de tarefa existente grava cada campo na hora; criação usa botão | Painel de tarefa |

Atalhos globais (`layout/AppShell.tsx`): `S` inicia ou para o cronômetro, `N` nova
tarefa, `Ctrl K` busca rápida, `T` vai para o Cronômetro, `?` mostra os atalhos.
Atalhos não disparam com o foco num campo de texto.

## 4.3 Inventário: kit de interface (`apps/web/src/components/ui`)

| Componente | Arquivo | Para que serve |
|---|---|---|
| `Button`, `IconButton` | `Button.tsx` | Botões (primary, secondary, ghost, subtle, danger; sm, md, lg). `IconButton` exige `label` (vira `aria-label` e dica nativa). `mobileIconOnly` mostra só o ícone no celular |
| `Popover` | `Popover.tsx` | Base de todo conteúdo flutuante: posiciona, fecha com Esc e clique fora, devolve o foco |
| `Menu`, `MenuList` | `Menu.tsx` | Menu suspenso com itens, títulos, separadores e marca de selecionado |
| `Modal`, `SidePanel` | `Modal.tsx` | Diálogo central e painel lateral com fundo escurecido e foco preso |
| `ConfirmProvider`, `useConfirm` | `Confirm.tsx` | Confirmação assíncrona |
| `Toaster`, `toast` | `Toast.tsx` | Avisos no rodapé (no celular, acima da barra inferior); `toast` funciona fora do React; `toast.persistent` não some sozinho |
| `Field`, `Input`, `TextArea`, `Select`, `Switch`, `Checkbox` | `Field.tsx` | Controles de formulário com rótulo, dica e erro |
| `Toolbar`, `ToolbarSpacer`, `ToolbarDivider`, `ChipButton`, `Segmented` | `Toolbar.tsx` | Barra de ferramentas no padrão do Toggl |
| `Avatar`, `AvatarStack`, `initials` | `Avatar.tsx` | Iniciais coloridas e pilha de pessoas |
| `ProjectLabel`, `ColorDot` | `ProjectLabel.tsx` | Nome de projeto com bolinha de cor (e tarefa, cliente) |
| `Calendar` | `Calendar.tsx` | Mês para escolher data ou intervalo (trabalha com `IsoDate`) |
| `EmptyState`, `Illustration`, `Spinner`, `LoadingBlock` | `EmptyState.tsx` | Telas vazias e carregamento |

## 4.4 Inventário: seletores (`apps/web/src/components/pickers`)

| Componente | Arquivo | Para que serve |
|---|---|---|
| `ProjectTaskPicker` | `ProjectTaskPicker.tsx` | "Projeto ou tarefa": busca, agrupa por cliente, expande tarefas, cria projeto. `projectsOnly` para escolher só projeto |
| `TagPicker` | `TagPicker.tsx` | Seleção múltipla de tags com criação pelo Enter |
| `MemberPicker` | `MemberPicker.tsx` | Seleção de responsáveis (múltipla ou única) |
| `StatusMenu`, `PriorityMenu` | `StatusPriority.tsx` | Menus de status e prioridade |
| `StatusIcon`, `PriorityIcon` | `TaskIcons.tsx` | Ícones SVG de status e prioridade |
| `DateRangePicker` | `DateRangePicker.tsx` | Datas de tarefa e período de projeto (intervalo ou data única) |
| `ColorSwatches` | `ColorSwatches.tsx` | Amostras das cores de projeto (`PROJECT_COLORS`) com o nome de cada cor. Cor do projeto e tema de cor do workspace; `withDefault` acrescenta a amostra "Ciano (padrão)", que devolve nulo |
| `TimeInput`, `DurationInput`, `parseClockTime` | `TimeInputs.tsx` | Hora e duração com digitação livre ("930", "1h30") |

Estilos compartilhados dos seletores: `Picker.module.css` (`trigger`, `dashed`,
`placeholder`, `option`, `search`).

## 4.5 Inventário: gráficos, layout, hooks e utilitários

| Item | Arquivo | Para que serve |
|---|---|---|
| `StackedColumns`, `HorizontalBars`, `Donut`, `StackedMeter`, `StatTile`, `Legend`, `niceStep` | `components/charts/Charts.tsx` | Gráficos SVG dos Relatórios e da visão geral do projeto |
| `AppShell` | `layout/AppShell.tsx` | Moldura interna, faixa de aviso do modo local, atalhos, título da aba com cronômetro; no celular, gaveta com a `Sidebar` e a `MobileNav` |
| `MobileNav` | `layout/MobileNav.tsx` | Barra inferior do celular (Cronômetro, Tarefas, Projetos, Relatórios, Menu) com o cronômetro rodando acima |
| `RunningTimerCard` | `layout/Sidebar.tsx` | Cronômetro rodando fora da tela do cronômetro (barra lateral e barra inferior) |
| `DataModeBadge`, `FallbackBanner`, `DataModeNote` | `components/DataModeNotice.tsx` | Selo "Modo local" na barra lateral, faixa de alerta quando o Firebase não respondeu ou falta criar o banco, nota na tela de login (em destaque nesses dois casos) |
| `BootScreen`, `BootError` | `app/BootScreen.tsx` | Abertura antes da camada de dados: "Carregando..." e o erro quando o Firebase é obrigatório e falhou |
| `usePwa`, `registerServiceWorker`, `listenInstallPrompt` | `app/pwa.ts` | PWA: versão nova (`applyUpdate`), convite de instalação (`install`) e se está aberto como app (`standalone`) |
| `Sidebar` | `layout/Sidebar.tsx` | Barra lateral: workspace (com a bolinha da cor de cada um e o modal "Novo workspace" com nome, cor e dados de exemplo), busca, cronômetro rodando, seções, usuário, tema |
| `applyTheme`, `applyAccent` | `app/theme.ts` | Tema escuro ou claro e tema de cor do workspace no `<html>` (`data-theme`, `data-accent`), lembrados para a próxima abertura |
| `PageHeader`, `PageBody` | `layout/PageHeader.tsx` | Cabeçalho de página |
| `LogoMark` | `layout/Logo.tsx` | Logotipo |
| `useFormat`, `createFormatters`, `useErrorMessage` | `lib/format.ts` | Datas, horas, durações, dinheiro e intervalos no idioma e preferências do usuário |
| `useWorkCalendar` | `lib/calendar.ts` | Calendário de trabalho (dias úteis e feriados) e nomes dos feriados |
| `useNow`, `useStoredState`, `useHotkey`, `useIsMobile`, `MOBILE_MEDIA` | `lib/hooks.ts` | Relógio, estado salvo no navegador, atalhos, tela de celular (até 760 px) |
| `useSession`, `useWorkspace`, `useWorkspaceId`, `useCurrentUser`, `usePreferences`, `useIsAdmin` | `app/session.tsx` | Dados da sessão dentro das rotas internas |
| `useT`, `useLocale`, `I18nProvider` | `i18n/index.tsx` | Textos traduzidos |
| `useTaskPanel` | `features/tasks/TaskPanelContext.tsx` | Abrir o painel de tarefa de qualquer tela (`openTask`, `openNew`) |
| `TaskImportButton`, `TaskImportDialog` | `features/tasks/TaskImportDialog.tsx` | Importar várias tarefas por JSON: botão "Importar JSON", prompt para IA, revisão e confirmação. Recebe o projeto padrão (`projectId`) e fica no Gantt, na aba Tarefas do projeto e na tela de Tarefas |

Hooks de dados (`apps/web/src/data/`), um arquivo por grupo. Todos chamam `backend()`
(`data/backend.ts`), a camada de dados conectada na abertura:

| Arquivo | Hooks |
|---|---|
| `backend.ts` | `backend()`, `connectBackend()` (lê as variáveis `VITE_*` e escolhe o modo) |
| `session.ts` | `useSessionQuery`, `useLogin`, `useGoogleLogin`, `useSignup`, `useStartDemo`, `useLogout`, `useUpdateProfile`, `useChangePassword`, `useSwitchWorkspace` |
| `workspace.ts` | `useUpdateWorkspace`, `useCreateWorkspace` (nome, cor e dados de exemplo), `useDeleteWorkspace` (devolve a sessão nova e limpa o cache do workspace), membros, convites (`useInvites`, `useCreateInvite`, `useRevokeInvite`, `useInvite`, `useAcceptInvite`), clientes, tags e feriados (`useHolidays`, `useCreateHoliday`, `useImportHolidays`, `useDeleteHoliday`) |
| `projects.ts` | `useProjects`, `useProjectMap`, `useCreateProject`, `useUpdateProject`, `useDeleteProject` |
| `tasks.ts` | `useTasks`, `useDependencies`, `useCreateTask`, `useUpdateTask`, `useScheduleTasks`, `useDeleteTask`, dependências, `usePreviewTaskImport` (revisão sem gravar) e `useImportTasks` |
| `timeEntries.ts` | `useRunningTimer`, `useTimeEntries`, `useStartTimer`, `useStopTimer`, criar, editar e excluir apontamento |
| `reports.ts` | `useSummaryReport`, `useDetailedReport`, `useDownloadCsv` (gera o CSV no navegador e baixa) |

## 4.6 Componentes de tela (não reutilizáveis fora da pasta)

| Tela | Componentes principais |
|---|---|
| Cronômetro | `TimerBar` (barra do topo, modo manual, sugestões), `CalendarView` (+ `calendarLayout.ts`), `ListView`, `TimesheetView`, `EntryEditor` |
| Tarefas | `TasksPage` (exporta `TaskListView`, `TaskFiltersButton`, `GroupSortControls`, `useTaskRowContext`), `TaskRow`, `TaskBoard`, `taskGrouping.ts`, `TaskPanel`, `TaskFields`, `SubtaskSection`, `DependencySection`, `AllocationSection`, `TaskImportDialog` (+ `taskImportModel.ts`: contexto do prompt para IA e datas do exemplo) |
| Projetos | `ProjectsPage` (exporta `TimeStatus`), `ProjectDialog`, `ProjectPage` (visão geral e aba Tarefas) |
| Gantt | `ProjectGantt` (barra de ferramentas), `GanttChart`, `ganttModel.ts` |
| Linha do tempo | `TimelinePage`, `timelineModel.ts` |
| Relatórios | `ReportsPage` (Resumo, Detalhado, Semanal), `ReportFilters` (`DateRangeControl`, `MultiFilter`, `BillableFilter`), `reportRange.ts` |
| Gestão | `MembersPage` (membros, `InviteDialog`, `PendingInvites`, `inviteLink`), `ClientsPage`, `TagsPage`, `RenameCell` |
| Entrada | `AuthPage` (login, cadastro e demonstração local), `GoogleButton` ("Continuar com Google", só no modo Firebase), `InvitePage` (aceitar convite) |
| Configurações | `ProfileSettingsPage` (conta, preferências, aplicativo e senha), `WorkspaceSettingsPage` (geral, cor do workspace, feriados, agendamento automático), `HolidaysSection`, `DeleteWorkspaceSection` (só administrador; confirma com o nome digitado), `NoWorkspace` |
| Busca | `QuickSearch`, `ShortcutsDialog` |

## 4.7 Desempenho

- O Gantt desenha todas as linhas do projeto (sem virtualização). Fica fluido até algumas
  centenas de tarefas por projeto. `[planejado]`: virtualizar linhas acima de 300.
- A escala de tempo do Gantt só é recalculada quando os dados mudam, não a cada movimento
  do ponteiro; durante o arraste só a prévia (cascata) é recalculada.
- O calendário do cronômetro recalcula a posição dos apontamentos a cada 30 s (linha de
  agora); o relógio do cronômetro atualiza a cada 1 s só nos componentes que o mostram.
- A lista de tarefas do workspace vem inteira numa leitura (no Firestore, uma consulta
  à subcoleção `tasks`). `[planejado]`: paginação para workspaces com milhares de
  tarefas.
- O SDK do Firebase é um pedaço separado do build, baixado só no modo Firebase.

## 4.8 Acessibilidade

- Todo botão só de ícone tem `aria-label` (por `IconButton` ou atributo direto).
- Popovers, menus, modais e painel prendem e devolvem o foco e fecham com Esc.
- Status, prioridade, faturável e capacidade nunca dependem só de cor: há ícone, rótulo
  ou texto ("6h acima").
- Gráficos têm tabela equivalente na mesma tela.
- Testar as telas em 1366x768 e 1920x1080 e num celular (412x915), nos dois temas.
- Alvos de toque no celular com pelo menos 30 px; a barra inferior tem 58 px de altura.
