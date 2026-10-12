# 9. Contexto do produto

## 9.1 O que é

O **Open Task Tracker (OTT)** é um sistema de tarefas com planejamento de projeto em
gráfico de Gantt e rastreamento de tempo, feito por engenharia reversa do **Toggl Track**
(com as funções de planejamento que vieram do Toggl Plan e do Toggl Focus). É de código
aberto, roda numa instalação própria (um processo Node e um arquivo SQLite) e funciona em
português do Brasil e inglês.

Ele responde a três perguntas de uma equipe pequena ou média:

1. **O que cada pessoa precisa fazer e quando?** Tarefas com prioridade, datas,
   estimativas, responsáveis, subtarefas e quadro.
2. **O projeto vai sair no prazo?** Cronograma em Gantt com dependências, cascata,
   caminho crítico, feriados e data de entrega prevista; Linha do tempo com a capacidade
   de cada pessoa.
3. **Quanto tempo foi gasto e quanto vale?** Cronômetro, apontamento manual, calendário,
   planilha e relatórios com valor faturável e exportação CSV.

## 9.2 Para quem

| Pessoa | O que faz no sistema |
|---|---|
| Gestora de projetos (admin) | Monta o cronograma, liga dependências, acompanha caminho crítico, capacidade e relatórios; cadastra membros, feriados e valores |
| Pessoa da equipe (membro) | Vê "Minhas tarefas", atualiza status, liga o cronômetro na tarefa, corrige apontamentos no calendário |
| Financeiro ou atendimento | Usa relatórios por cliente e projeto, exporta CSV com valores faturáveis |

## 9.3 Correspondência com o Toggl

| Toggl Track | Open Task Tracker | Estado |
|---|---|---|
| Timer (barra "What are you working on?", projeto ou tarefa, tags, faturável) | Cronômetro, `TimerBar` | `[implementado]` |
| Modo manual de apontamento | Modo manual da barra | `[implementado]` |
| Visões Calendar, List e Timesheet | Calendário, Lista e Planilha | `[implementado]` |
| Arrastar no calendário para criar, mover e redimensionar | Igual | `[implementado]` |
| Reports: Summary, Detailed, Weekly, export | Relatórios: Resumo, Detalhado, Semanal, CSV | `[implementado]` |
| Saved reports e compartilhamento | | `[planejado]` |
| Projects (lista, cliente, status de tempo, equipe, fixar, arquivar) | Projetos | `[implementado]` |
| Project dashboard | Visão geral do projeto | `[implementado]` |
| Tasks (lista agrupada, quadro, "My tasks", filtros, agrupar, ordenar) | Tarefas | `[implementado]` |
| Painel lateral de tarefa (projeto, datas, estimativa total ou por dia, prioridade, tags, responsável, status, faturável, subtarefas, alocação, notas) | Painel de tarefa | `[implementado]` |
| Anexos em tarefa | | `[planejado]` |
| Tarefa privada (cadeado) | | `[planejado]` |
| Timeline (capacidade por pessoa, "Xh free") | Linha do tempo | `[implementado]` |
| Saved views da Timeline | | `[planejado]` |
| Gantt de projeto (Toggl Plan) com dependências | Cronograma com FS, SS, FF, SF, atraso, cascata e caminho crítico | `[implementado]` |
| Calendário de trabalho e feriados | Dias úteis, feriados e importação nacional; tarefa liberada para fins de semana e feriados | `[implementado]` |
| Members, Clients, Tags | Membros, Clientes, Tags | `[implementado]` |
| Workspaces e troca de workspace | Igual | `[implementado]` |
| Approvals (aprovação de horas) | | `[planejado]` |
| Time off (folgas) | | `[planejado]` |
| Ask Toggl AI | Substituído pela busca rápida (Ctrl K) | `[implementado]` (busca) |
| Integrações, apps móveis e de desktop, extensão de navegador | | fora do escopo atual |
| Planos pagos, cobrança | | fora do escopo |

Diferenças intencionais em relação ao Toggl: marca e ilustrações próprias; interface em
português por padrão; feriados nacionais do Brasil; caminho crítico e tipos de
dependência além do término para início.

## 9.4 Glossário

| Termo na interface | Significado | No código |
|---|---|---|
| Workspace | Espaço da equipe; todo dado pertence a um | `Workspace` |
| Membro, administrador | Pessoa do workspace e seu papel | `Member`, `role` |
| Apontamento | Registro de tempo (início e fim) | `TimeEntry` |
| Cronômetro rodando | Apontamento sem fim | `stop = null` |
| Faturável | Tempo que gera valor para o cliente | `billable` |
| Tarefa-mãe, subtarefa | Hierarquia de tarefas; a mãe vira barra de grupo no Gantt | `parentId` |
| Marco | Tarefa de duração zero que marca uma entrega | `isMilestone` |
| Dependência | Ligação entre duas tarefas com tipo e atraso | `TaskDependency` |
| Cascata (agendamento automático) | Empurrar sucessoras quando a predecessora atrasa | `cascadeSchedule` |
| Caminho crítico | Sequência de tarefas sem folga | `computeCriticalPath` |
| Folga | Quantos dias úteis a tarefa pode atrasar sem atrasar o projeto | `floatByTask` |
| Dia útil, feriado | Calendário de trabalho do workspace | `WorkCalendar` |
| Fins de semana e feriados | Opção que libera uma tarefa para dias não úteis | `allowNonWorkingDays` |
| Capacidade | Horas semanais disponíveis de cada membro | `weeklyCapacityHours` |
| Alocação | Distribuição da estimativa pelos dias | `computeAllocations` |
| Entrega prevista | Maior fim entre as tarefas agendadas do projeto | `projectEnd` |

## 9.5 Princípios de produto

1. **Rápido de registrar.** Começar a contar tempo é digitar e apertar Enter (ou `S`).
2. **Plano e realidade lado a lado.** A mesma tarefa tem estimativa, cronograma e tempo
   registrado; o painel mostra "6h de 14h".
3. **O cronograma se ajusta sozinho, sem surpresas.** A cascata só empurra, nunca puxa, e
   pode ser desligada.
4. **Fiel ao Toggl onde o Toggl acerta.** Mesma organização de telas, nomes e atalhos
   para quem já conhece.
5. **Instalação própria simples.** Um processo, um arquivo de banco, sem serviço externo.

## 9.6 Roteiro

Prioridade de cima para baixo. Ao implementar, troque o marcador e atualize os documentos
afetados.

| Item | Estado |
|---|---|
| Cronômetro, apontamentos, calendário, lista, planilha | `[implementado]` |
| Tarefas, painel, quadro, subtarefas, dependências | `[implementado]` |
| Projetos, visão geral, Gantt, caminho crítico, cascata | `[implementado]` |
| Linha do tempo de capacidade | `[implementado]` |
| Relatórios e CSV | `[implementado]` |
| Feriados e tarefas em fins de semana e feriados | `[implementado]` |
| Limite de tentativas de login e registro de auditoria | `[planejado]` |
| Convite de membro por e-mail (com servidor SMTP opcional) | `[planejado]` |
| Folgas (Time off) descontando da capacidade | `[planejado]` |
| Aprovação de horas (Approvals) | `[planejado]` |
| Relatórios salvos e links de compartilhamento | `[planejado]` |
| Anexos e tarefas privadas | `[planejado]` |
| Linha de base do cronograma (planejado x atual) | `[planejado]` |
| Virtualização de linhas no Gantt e paginação de tarefas no servidor | `[planejado]` |
| Imagem Docker e guia de implantação | `[planejado]` |
| Importação de apontamentos e tarefas do Toggl (CSV) | `[planejado]` |
