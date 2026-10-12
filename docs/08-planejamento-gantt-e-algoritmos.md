# 8. Planejamento, Gantt e algoritmos

> Código: `packages/shared/src/{dates,scheduling,capacity,holidays}.ts` (usados pela API e
> pela web) e os modelos de tela `apps/web/src/features/{gantt/ganttModel,timeline/timelineModel,timer/calendarLayout}.ts`.
> Testes: `packages/shared/test/*` e os `*.test.ts` ao lado dos modelos.
> Mudou uma regra? Atualize esta página e acrescente um caso de teste.

## 8.1 Calendário de trabalho

```ts
interface WorkCalendar {
  workingDays: readonly number[];      // 0 = domingo ... 6 = sábado
  holidays?: ReadonlySet<IsoDate>;     // feriados do workspace
}
```

- Um dia é **útil** se o dia da semana está em `workingDays` **e** a data não é feriado.
- Todas as funções de dias úteis (`isWorkday`, `nextWorkday`, `previousWorkday`,
  `addWorkdays`, `workdaysBetween`) aceitam o calendário completo ou só a lista de dias.
- `ALL_DAYS` é o calendário em que todo dia é útil.
- **Calendário da tarefa** (`calendarFor`): tarefa com `allowNonWorkingDays` usa
  `ALL_DAYS`; as demais usam o calendário do workspace.
- Proteções: lista de dias vazia vira "todos os dias"; procurar o próximo dia útil para
  depois de ~10 anos de busca (calendário sem nenhum dia útil alcançável não trava).
- `workdaysBetween` conta semanas inteiras por aritmética e desconta só os feriados que
  caem em dia útil da semana (feriado num sábado não desconta duas vezes).

Exemplo com segunda 12/10/2026 feriado: de 12 a 16/10 há 4 dias úteis; o próximo dia
útil depois de sexta 9/10 é terça 13/10.

## 8.2 Duração

- Duração em **dias úteis do calendário da tarefa**, com intervalo fechado
  [início, fim]. Tarefa comum vale no mínimo 1; marco vale 0.
- Mover uma tarefa preserva a duração em dias úteis (`placeAt`): o novo início encaixa no
  próximo dia útil e o fim é `addWorkdays(início, duração - 1)`.
- No arraste do Gantt: mover para frente encaixa no próximo dia útil, para trás no dia útil
  anterior; a borda de início encaixa para frente e a de fim para trás. Tarefa liberada
  encaixa em qualquer dia.

## 8.3 Dependências

| Tipo | Leitura | Restrição sobre a sucessora (S) dada a predecessora (P) |
|---|---|---|
| FS | término para início | S começa no dia útil seguinte ao fim de P, mais o atraso |
| SS | início para início | S começa no início de P, mais o atraso |
| FF | término para término | S termina no fim de P, mais o atraso |
| SF | início para término | S termina no início de P, mais o atraso |

- O atraso (`lagDays`) é em dias úteis e pode ser negativo.
- Atraso e encaixe usam o **calendário da sucessora** (mesma regra do MS Project): uma
  sucessora liberada pode começar no sábado logo depois da predecessora.
- Marco termina no fim do próprio dia: marco sucessor de FS pode cair no mesmo dia em que
  a predecessora termina; tarefa comum começa no dia útil seguinte.
- Dependência numa tarefa-mãe vale para todas as descendentes.

### Validação (`validateDependency`)

Recusa, nesta ordem: ligar a tarefa a si mesma (`self`), mãe com descendente ou vice-versa
(`hierarchy`), par já ligado em qualquer direção (`duplicate`) e qualquer ligação que feche
um ciclo (`cycle`). O ciclo é procurado num grafo que inclui as arestas implícitas da
hierarquia: filha para mãe (as datas da mãe saem das filhas) e predecessora de uma mãe
para cada descendente. Assim um ciclo como "B depende da mãe A; ligar B antes de uma filha
de A" é detectado.

## 8.4 Cascata (agendamento automático)

`cascadeSchedule(tarefas, dependências, calendário)`:

1. Monta o grafo (seção 8.3) e ordena topologicamente (Kahn). Com ciclo, não faz nada.
2. Percorre na ordem. Tarefa-mãe: recalcula início e fim pelas filhas já processadas.
   Tarefa folha com datas: calcula a data mais cedo exigida por cada dependência que chega
   nela e nas suas ancestrais; se a maior delas for depois do início atual, recoloca a
   tarefa ali preservando a duração.
3. Devolve só as tarefas que mudaram, ordenadas por id.

Regras de produto:

- **Só empurra, nunca puxa.** Antecipar a predecessora não antecipa a sucessora (mesmo
  comportamento do Toggl Plan e do TeamGantt). Quem quiser puxar arrasta a sucessora.
- Tarefas sem datas são ignoradas.
- A API roda a cascata sempre que datas, hierarquia, dependências, feriados ou a opção de
  dias não úteis mudam (`applyScheduling`), se o workspace estiver com agendamento
  automático ligado. A web roda a mesma função durante o arraste para mostrar a prévia.

## 8.5 Resumo das tarefas-mãe

`rollupSummaries` (de baixo para cima, qualquer profundidade):

- início = menor início das filhas; fim = maior fim;
- progresso = média do progresso das filhas ponderada pela duração em dias corridos
  (filha sem datas pesa 1);
- status (na API): todas concluídas = concluída; alguma começada ou concluída = em
  andamento; senão a fazer.

## 8.6 Caminho crítico

`computeCriticalPath` usa o **cronograma planejado** (as datas atuais são o início mais
cedo):

1. Considera só tarefas folha com datas; dependências em mães viram dependências entre as
   folhas descendentes.
2. Converte datas em índices de dia útil a partir do início do projeto.
3. Passada para trás, do fim do projeto (maior fim) até o começo, calculando o término
   mais tarde (LF) de cada tarefa:
   - FS: `LF(P) = LS(S) - atraso - 1` (ou `- 0` se S for marco)
   - SS: `LF(P) = LS(S) - atraso + duração(P) - 1`
   - FF: `LF(P) = LF(S) - atraso`
   - SF: `LF(P) = LF(S) - atraso + duração(P) - 1`
4. Folga = `LF - término planejado`. Folga zero ou negativa é **crítica** (negativa indica
   dependência violada com agendamento automático desligado).

Aproximação documentada: a folga é medida em dias úteis do calendário do workspace,
inclusive para tarefas liberadas para fins de semana e feriados.

"Entrega prevista" no Gantt e na visão geral é o maior fim entre as folhas agendadas; fica
em vermelho quando passa do fim do projeto.

## 8.7 Capacidade e alocação

`computeAllocations(tarefas, intervalo, calendário)` distribui a estimativa:

- estimativa **total**: `estimativa / dias úteis da tarefa / número de responsáveis`, em
  cada dia útil da tarefa;
- estimativa **por dia**: o valor inteiro, para cada responsável, em cada dia útil;
- "dia útil" é do calendário da tarefa (liberada usa todos os dias);
- ficam de fora: tarefas concluídas, sem datas, sem estimativa e tarefas-mãe (o trabalho
  está nas filhas, contar a mãe somaria duas vezes);
- tarefa sem responsável vai para a chave `UNASSIGNED` (0), a faixa "Sem responsável".

Capacidade:

- diária = `horas semanais / quantidade de dias úteis da semana`;
- no período = diária x dias úteis do período, já descontando feriados;
- na Linha do tempo, a capacidade de fim de semana e de feriado é zero, então qualquer
  carga nesses dias aparece como acima da capacidade.

## 8.8 Feriados nacionais do Brasil

`brazilianHolidays(ano, incluirFacultativos)`:

- fixos: 1/1, 21/4, 1/5, 7/9, 12/10, 2/11, 15/11, 20/11 (desde 2024, Lei 14.759/2023), 25/12;
- móveis a partir da Páscoa (algoritmo de Meeus, Jones e Butcher): Sexta-feira Santa
  (Páscoa - 2);
- pontos facultativos, só se pedidos: Carnaval (Páscoa - 48 e - 47) e Corpus Christi
  (Páscoa + 60).

Exemplo 2026: Páscoa em 5/4, Sexta-feira Santa em 3/4, Carnaval em 16 e 17/2, Corpus
Christi em 4/6.

## 8.9 Geometria do Gantt (`ganttModel.ts`)

| Zoom | Largura do dia | Folga antes e depois | Cabeçalho (cima / baixo) |
|---|---|---|---|
| Dias | 36 px | 7 / 21 dias | semana (data e número) / dia |
| Semanas | 14 px | 14 / 42 dias | mês / semana |
| Meses | 4,5 px | 31 / 120 dias | ano / mês |

- Intervalo visível: do menor ao maior entre hoje e todas as datas, mais a folga, alinhado
  ao início da semana (ou ao dia 1 no zoom de meses).
- `x = dias desde o início x largura do dia`.
- Linhas: árvore achatada por `position` com numeração hierárquica (1, 1.2, 1.2.3); pais
  recolhidos escondem a subárvore; tarefa cujo pai não está no projeto vira raiz.
- Setas (`dependencyPath`): saem do lado certo da predecessora (fim em FS e FF, início em
  SS e SF) e entram pelo lado certo da sucessora, com cotovelos de 10 px; se não houver
  espaço, contornam pela meia altura entre as linhas.
- Linha de 36 px; barra de 20 px; barra de grupo de 8 px com pontas; marco é losango.

## 8.10 Outros modelos de tela

- **Calendário do cronômetro** (`calendarLayout.ts`): cada apontamento é recortado ao dia
  exibido; apontamentos que se sobrepõem dividem a largura em colunas (algoritmo guloso
  por grupo de sobreposição, considerando altura mínima de 15 min); arraste em passos de
  15 min.
- **Linha do tempo** (`timelineModel.ts`): barras empilhadas em subfaixas pelo algoritmo
  guloso por início; tarefa que começa no dia em que outra termina vai para outra subfaixa.
- **Relatórios** (`reportRange.ts`): períodos prontos (hoje, ontem, esta semana, semana
  passada, este mês, mês passado, últimos 30 dias, este ano); setas andam pelo tamanho do
  período (mês inteiro anda de mês em mês); colunas por dia até 31 dias, por semana até
  120, por mês acima disso.

## 8.11 Durações digitadas e exibidas (`duration.ts`)

- Exibição nos três formatos do Toggl: melhorado `0:47:06`, clássico `47:06 min` (acima de
  uma hora `1:47:06`) e decimal `0,79 h`.
- Digitação aceita `1:30`, `1:30:15`, `1h30`, `1h 30m`, `1,5h`, `90m`, `45s`, `2 horas` e
  número sem unidade (minutos no cronômetro, horas na estimativa e na planilha).
- Hora digitada (`parseClockTime`) aceita `9`, `930`, `9:30`, `21:30` e `9:30pm`.
