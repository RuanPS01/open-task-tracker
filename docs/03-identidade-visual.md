# 3. Identidade visual

> Fonte da verdade: `apps/web/src/styles/tokens.css`. Este documento explica os tokens;
> se os dois divergirem, o CSS vale e este documento deve ser corrigido.

## 3.1 Princípios

- **Fidelidade ao Toggl Track, marca própria.** Layout, ritmo, cores de interface e
  comportamento seguem o Toggl Track (tema escuro com barra lateral preta, rosa como cor
  de ação, roxo escuro no tema claro). Nome, logotipo e ilustrações são próprios: o
  produto se chama Open Task Tracker (sigla OTT) e não usa marca, nome ou logotipo do
  Toggl.
- **O dado é o que pode chamar atenção.** Interface em tons neutros; cor forte só em ação
  principal (botão rosa), estado selecionado e cor de projeto.
- **Nenhuma cor literal em componente.** Tudo por `var(--token)`. A cor de projeto vem do
  dado (`project.color`) e entra por variável CSS local (`--bar-color`, `--entry-color`,
  `--project-color`).

## 3.2 Cores de interface

Os valores do tema escuro foram medidos em capturas do Toggl Track (amostragem de pixel).

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg-app` | `#1c1a1d` | `#ffffff` | Fundo das páginas e painéis |
| `--bg-elevated` | `#242126` | `#ffffff` | Popover, menu, modal |
| `--bg-hover` | `#29262b` | `#f7f2f7` | Linha ou item sob o ponteiro |
| `--bg-active` | `#322e34` | `#efe5ef` | Trilhos e fundos ativos |
| `--bg-muted` | `#141315` | `#faf7fa` | Faixas de cabeçalho, cartões de apoio |
| `--bg-weekend` | `#141315` | `#f8f4f8` | Colunas de dia não útil |
| `--bg-overlay` | preto 55% | roxo 35% | Fundo atrás de modal e painel |
| `--sidebar-bg` | `#000000` | `#2c1338` | Barra lateral (no claro, roxo do Toggl) |
| `--sidebar-active` | `#361e34` | `#55305f` | Item de navegação ativo |
| `--sidebar-text` | `#f3eef4` | `#fbf7fc` | Texto da barra lateral |
| `--border` | `#373538` | `#e5dde6` | Bordas e linhas de grade principais |
| `--border-subtle` | `#29272a` | `#f0eaf0` | Divisórias leves |
| `--text` | `#f6f3f6` | `#2c1338` | Texto principal |
| `--text-secondary` | `#c9c3ca` | `#564a5c` | Texto de apoio |
| `--text-muted` | `#918a93` | `#85798a` | Rótulos, metadados |
| `--text-faint` | `#6b656e` | `#ada3b1` | Placeholder |
| `--accent` | `#c281b9` | `#e57cd8` | Botão principal, cronômetro, seleção |
| `--accent-text` | `#e3a3d9` | `#a4399a` | Texto e valor em destaque ("Data" em "Agrupar por: Data") |
| `--accent-contrast` | `#1d0c1f` | `#2c1338` | Texto sobre o rosa |
| `--accent-subtle` | `#361e34` | `#fbe8f8` | Fundo de item selecionado |
| `--danger` | `#f27474` | `#d33a3a` | Erro, atraso, capacidade estourada |
| `--success` | `#52c28d` | `#1e9c61` | Capacidade livre, concluído |
| `--warning` | `#f2b14c` | `#c27a00` | Feriados no calendário |
| `--now-line` | `#c281b9` | `#e57cd8` | Linha de "agora" e de "hoje" |

Status e prioridade de tarefa têm tokens próprios (`--status-todo`, `--status-progress`,
`--status-done`, `--priority-low` a `--priority-urgent`) e sempre aparecem com ícone e
rótulo, nunca só pela cor.

Gantt: `--gantt-summary` (barra de grupo), `--gantt-dependency` (setas),
`--gantt-critical` (contorno de tarefa crítica).

## 3.3 Cores de gráfico

Validadas com o validador de paleta (separação para daltonismo, faixa de luminosidade,
saturação mínima e contraste com o fundo) nos dois temas:

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--chart-billable` | `#d55181` | `#c2468f` | Série "Faturável" |
| `--chart-nonbillable` | `#3987e5` | `#2a78d6` | Série "Não faturável" |
| `--chart-single` | `#d55181` | `#c2468f` | Gráfico de série única (horas por membro, por tarefa) |
| `--chart-other` | `#6f6a72` | `#9b949e` | Fatia "Outros" e sem projeto |
| `--chart-grid` | `#2c2a2e` | `#efeaef` | Linhas de grade |

Regras dos gráficos (seguidas em `components/charts/Charts.tsx`):

- barras com no máximo 24 px de espessura e ponta arredondada de 4 px, base reta;
- 2 px de espaço na cor do fundo entre segmentos empilhados e entre fatias da rosca;
- grade em linha fina contínua, nunca tracejada; eixo com passos redondos (horas inteiras);
- legenda sempre que houver duas séries ou mais; rótulo de valor só no topo da coluna
  quando há até 10 colunas;
- texto nunca usa a cor da série: a identidade vem do quadradinho ao lado;
- dica ao passar o mouse com o valor em destaque; toda informação da dica também existe
  em tabela (rosca com tabela, colunas com o resumo por projeto);
- rosca com no máximo 6 fatias; o resto vira "Outros";
- ao recarregar com filtros novos, o gráfico anterior fica esmaecido em vez de piscar.

As cores de projeto (`PROJECT_COLORS` em `packages/shared/src/constants.ts`) são a paleta
do Toggl e identificam o projeto em todas as telas (calendário, Gantt, Linha do tempo,
rosca). Elas pertencem ao dado, não ao tema.

## 3.4 Tipografia

- Fonte: **Inter Variable**, embutida por `@fontsource-variable/inter` (sem depender de
  rede). Pilha de reserva: `system-ui`, Segoe UI, Roboto.
- Tamanhos (`--text-*`): 11, 12, 14 (base), 16, 20 (título de página), 28 (título de login).
- Pesos: 500 (texto), 600 (botões, rótulos), 650 a 700 (títulos, totais).
- Números em coluna usam `font-variant-numeric: tabular-nums` (classe `.tabular`).
  Números grandes isolados (blocos de indicador) usam algarismos proporcionais.
- Rótulos de seção da barra lateral e cabeçalhos de tabela: 10,5 a 11 px, caixa alta,
  espaçamento 0,05em, cor `--text-muted`.

## 3.5 Forma e espaço

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 6 px | Itens de menu, botões pequenos |
| `--radius-md` | 8 px | Botões, campos, chips da barra de ferramentas |
| `--radius-lg` | 12 px | Cartões, popovers, modais |
| `--sidebar-width` | 212 px | Barra lateral aberta (trilho de 44 px + navegação) |
| `--header-height` | 52 px | Cabeçalho de página |
| `--panel-width` | 440 px | Painel lateral de tarefa |

Alturas padrão: botão 32 px (28 px pequeno), campo 34 px, chip de barra de ferramentas
30 px, linha de lista 44 a 48 px, linha do Gantt 36 px.

## 3.6 Ícones e ilustrações

- Ícones: **lucide-react**, traço de 2 px, 15 a 18 px. Mapeamento das seções: Cronômetro
  `Clock`, Relatórios `FileText`, Projetos `Folder`, Tarefas `ListChecks`, Linha do tempo
  `ChartGantt`, Membros `Users`, Clientes `Building2`, Tags `Tag`.
- Ícones de status e prioridade de tarefa são SVG próprios em
  `components/pickers/TaskIcons.tsx` (círculo tracejado, meio cheio, cheio com check;
  barras de sinal e quadrado de urgente).
- Ilustrações de tela vazia (`components/ui/EmptyState.tsx`): formas geométricas com as
  cores de marca (`--accent`, `--brand-yellow`, `--brand-pink-light`, `--brand-plum`),
  no espírito das ilustrações do Toggl, com desenho próprio. Variantes: `shapes`,
  `people`, `clock`, `chart`, `folders`.
- Logotipo (`layout/Logo.tsx` e `public/favicon.svg`): relógio sobre círculo rosa.

## 3.7 Temas

- Três opções por pessoa: escuro (padrão, como as capturas do Toggl), claro e do sistema.
- O tema é o atributo `data-theme` no `<html>`. O `index.html` aplica o último tema salvo
  em `localStorage` (`ott.theme`) antes do React, para a tela não piscar.
- Todo token existe nos dois temas. Ao criar token novo, defina os dois blocos.
- Feriados aparecem com hachura diagonal em `--warning` sobre `--bg-weekend`; fins de
  semana só com `--bg-weekend`.
