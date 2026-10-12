# 4. Padrão de interface e componentes

> Antes de criar um componente, procure aqui. Criou, renomeou ou removeu um item desta
> lista? Atualize este documento no mesmo commit.

## 4.1 Anatomia de uma página

Toda tela interna segue a mesma estrutura do Toggl Track:

```
+---------------------------------------------------------------+
| Barra lateral | PageHeader: "Tarefas · Lista"     [Ação rosa]  |
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

## 4.2 Padrões de interação

| Padrão | Como fazer | Exemplo |
|---|---|---|
| Ação principal da página | `Button variant="primary"` no `PageHeader` | "Adicionar tarefa" |
| Filtro, agrupar, ordenar | `ChipButton` dentro de `Menu` ou `Popover` | "Agrupar por: Data" |
| Alternar visão | `Segmented` | Calendário, Lista, Planilha |
| Criar ou editar item rico | Painel lateral (`SidePanel`) ou `Modal` | Painel de tarefa, editor de apontamento |
| Confirmar exclusão | `await confirm({ ..., danger: true })` de `useConfirm` | Excluir projeto |
| Avisar resultado | `toast.success()`; erros de mutação já viram aviso sozinhos | "Tarefa criada" |
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
| `Button`, `IconButton` | `Button.tsx` | Botões (primary, secondary, ghost, subtle, danger; sm, md, lg). `IconButton` exige `label` (vira `aria-label` e dica nativa) |
| `Popover` | `Popover.tsx` | Base de todo conteúdo flutuante: posiciona, fecha com Esc e clique fora, devolve o foco |
| `Menu`, `MenuList` | `Menu.tsx` | Menu suspenso com itens, títulos, separadores e marca de selecionado |
| `Modal`, `SidePanel` | `Modal.tsx` | Diálogo central e painel lateral com fundo escurecido e foco preso |
| `ConfirmProvider`, `useConfirm` | `Confirm.tsx` | Confirmação assíncrona |
| `Toaster`, `toast` | `Toast.tsx` | Avisos no rodapé; `toast` funciona fora do React |
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
| `TimeInput`, `DurationInput`, `parseClockTime` | `TimeInputs.tsx` | Hora e duração com digitação livre ("930", "1h30") |

Estilos compartilhados dos seletores: `Picker.module.css` (`trigger`, `dashed`,
`placeholder`, `option`, `search`).

## 4.5 Inventário: gráficos, layout, hooks e utilitários

| Item | Arquivo | Para que serve |
|---|---|---|
| `StackedColumns`, `HorizontalBars`, `Donut`, `StackedMeter`, `StatTile`, `Legend`, `niceStep` | `components/charts/Charts.tsx` | Gráficos SVG dos Relatórios e da visão geral do projeto |
| `AppShell` | `layout/AppShell.tsx` | Moldura interna, atalhos, título da aba com cronômetro |
| `Sidebar` | `layout/Sidebar.tsx` | Barra lateral: workspace, busca, cronômetro rodando, seções, usuário, tema |
| `PageHeader`, `PageBody` | `layout/PageHeader.tsx` | Cabeçalho de página |
| `LogoMark` | `layout/Logo.tsx` | Logotipo |
| `useFormat`, `createFormatters`, `useErrorMessage` | `lib/format.ts` | Datas, horas, durações, dinheiro e intervalos no idioma e preferências do usuário |
| `useWorkCalendar` | `lib/calendar.ts` | Calendário de trabalho (dias úteis e feriados) e nomes dos feriados |
| `useNow`, `useStoredState`, `useHotkey` | `lib/hooks.ts` | Relógio, estado salvo no navegador, atalhos |
| `useSession`, `useWorkspace`, `useWorkspaceId`, `useCurrentUser`, `usePreferences`, `useIsAdmin` | `app/session.tsx` | Dados da sessão dentro das rotas internas |
| `useT`, `useLocale`, `I18nProvider` | `i18n/index.tsx` | Textos traduzidos |
| `useTaskPanel` | `features/tasks/TaskPanelContext.tsx` | Abrir o painel de tarefa de qualquer tela (`openTask`, `openNew`) |

Hooks de dados (`apps/web/src/api/`), um arquivo por grupo:

| Arquivo | Hooks |
|---|---|
| `session.ts` | `useSessionQuery`, `useLogin`, `useSignup`, `useLogout`, `useUpdateProfile`, `useChangePassword`, `useSwitchWorkspace` |
| `workspace.ts` | `useUpdateWorkspace`, `useCreateWorkspace`, membros, clientes, tags e feriados (`useHolidays`, `useCreateHoliday`, `useImportHolidays`, `useDeleteHoliday`) |
| `projects.ts` | `useProjects`, `useProjectMap`, `useCreateProject`, `useUpdateProject`, `useDeleteProject` |
| `tasks.ts` | `useTasks`, `useDependencies`, `useCreateTask`, `useUpdateTask`, `useScheduleTasks`, `useDeleteTask`, dependências |
| `timeEntries.ts` | `useRunningTimer`, `useTimeEntries`, `useStartTimer`, `useStopTimer`, criar, editar e excluir apontamento |
| `reports.ts` | `useSummaryReport`, `useDetailedReport`, `useCsvUrl` |

## 4.6 Componentes de tela (não reutilizáveis fora da pasta)

| Tela | Componentes principais |
|---|---|
| Cronômetro | `TimerBar` (barra do topo, modo manual, sugestões), `CalendarView` (+ `calendarLayout.ts`), `ListView`, `TimesheetView`, `EntryEditor` |
| Tarefas | `TasksPage` (exporta `TaskListView`, `TaskFiltersButton`, `GroupSortControls`, `useTaskRowContext`), `TaskRow`, `TaskBoard`, `taskGrouping.ts`, `TaskPanel`, `TaskFields`, `SubtaskSection`, `DependencySection`, `AllocationSection` |
| Projetos | `ProjectsPage` (exporta `TimeStatus`), `ProjectDialog`, `ProjectPage` (visão geral e aba Tarefas) |
| Gantt | `ProjectGantt` (barra de ferramentas), `GanttChart`, `ganttModel.ts` |
| Linha do tempo | `TimelinePage`, `timelineModel.ts` |
| Relatórios | `ReportsPage` (Resumo, Detalhado, Semanal), `ReportFilters` (`DateRangeControl`, `MultiFilter`, `BillableFilter`), `reportRange.ts` |
| Gestão | `MembersPage`, `ClientsPage`, `TagsPage`, `RenameCell` |
| Configurações | `ProfileSettingsPage`, `WorkspaceSettingsPage`, `HolidaysSection`, `NoWorkspace` |
| Busca | `QuickSearch`, `ShortcutsDialog` |

## 4.7 Desempenho

- O Gantt desenha todas as linhas do projeto (sem virtualização). Fica fluido até algumas
  centenas de tarefas por projeto. `[planejado]`: virtualizar linhas acima de 300.
- A escala de tempo do Gantt só é recalculada quando os dados mudam, não a cada movimento
  do ponteiro; durante o arraste só a prévia (cascata) é recalculada.
- O calendário do cronômetro recalcula a posição dos apontamentos a cada 30 s (linha de
  agora); o relógio do cronômetro atualiza a cada 1 s só nos componentes que o mostram.
- A lista de tarefas do workspace vem inteira numa resposta. `[planejado]`: paginação no
  servidor para workspaces com milhares de tarefas.

## 4.8 Acessibilidade

- Todo botão só de ícone tem `aria-label` (por `IconButton` ou atributo direto).
- Popovers, menus, modais e painel prendem e devolvem o foco e fecham com Esc.
- Status, prioridade, faturável e capacidade nunca dependem só de cor: há ícone, rótulo
  ou texto ("6h acima").
- Gráficos têm tabela equivalente na mesma tela.
- Testar as telas em 1366x768 e 1920x1080, nos dois temas.
