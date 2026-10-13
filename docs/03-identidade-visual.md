# 3. Identidade visual

> Fonte da verdade: `apps/web/src/styles/tokens.css`. Este documento explica os tokens;
> se os dois divergirem, o CSS vale e este documento deve ser corrigido. O trecho final do
> `tokens.css` (temas de cor por workspace) é gerado por `scripts/workspace-themes.mjs`:
> não se edita à mão (seção 3.8).

## 3.1 Princípios

- **Fidelidade ao Toggl Track, marca própria.** Layout, ritmo e comportamento seguem o
  Toggl Track (tema escuro com barra lateral preta, barra lateral escura também no tema
  claro). A cor da marca é própria: **ciano puro `#00ffff`**. Nome, logotipo e ilustrações
  também são próprios: o produto se chama Open Task Tracker (sigla OTT) e não usa marca,
  nome ou logotipo do Toggl.
- **O dado é o que pode chamar atenção.** Interface em tons neutros; cor forte só em ação
  principal (botão ciano), estado selecionado e cor de projeto.
- **Nenhuma cor literal em componente.** Tudo por `var(--token)`. A cor de projeto vem do
  dado (`project.color`) e entra por variável CSS local (`--bar-color`, `--entry-color`,
  `--project-color`).

## 3.2 Cores de interface

**Como a paleta é derivada.** A cor primária é o ciano puro `#00ffff` (OKLCH L 0,905,
C 0,155, matiz 195). Os demais tons saem dela em OKLCH: os neutros (fundos, bordas,
textos e barra lateral) mantêm a luminosidade e a saturação dos degraus anteriores e
recebem a matiz 200, um cinza levemente puxado para o ciano; os tons da marca (destaques,
fundos selecionados, tinta escura) são o mesmo ciano em luminosidades diferentes. Cores
de estado (erro, sucesso, aviso, informação, prioridade urgente e alta, status) não
seguem a marca e ficam como estão.

O ciano puro é muito claro: preenche botões, bolinhas, a linha de hoje no tema escuro e o
logotipo, sempre com texto em tinta escura (`--accent-contrast`). Onde o ciano precisa
aparecer sobre fundo branco (texto, linha, borda, ícone), o tema claro usa um ciano mais
fundo: `--accent-text` para texto e `--accent-strong` para linhas, bordas e ícones.

Contrastes conferidos (WCAG): texto principal 16,7:1 (escuro) e 14,9:1 (claro); texto de
apoio 10,6 e 8,0; texto apagado 5,2 e 4,6; `--accent-text` 13,3 e 5,2 sobre o fundo;
tinta escura sobre o ciano 14,5 e 12,4; `--accent-strong` no claro 3,4 sobre o branco.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg-app` | `#181c1c` | `#ffffff` | Fundo das páginas e painéis |
| `--bg-elevated` | `#1d2424` | `#ffffff` | Popover, menu, modal |
| `--bg-hover` | `#222929` | `#eef6f6` | Linha ou item sob o ponteiro |
| `--bg-active` | `#293232` | `#dceced` | Trilhos e fundos ativos |
| `--bg-muted` | `#111414` | `#f4f9f9` | Faixas de cabeçalho, cartões de apoio |
| `--bg-weekend` | `#111414` | `#f1f7f7` | Colunas de dia não útil |
| `--bg-overlay` | preto 55% | tinta 35% | Fundo atrás de modal e painel |
| `--sidebar-bg` | `#000000` | `#00292e` | Barra lateral (no claro, azul-petróleo da marca) |
| `--sidebar-active` | `#002f32` | `#004e54` | Item de navegação ativo |
| `--sidebar-text` | `#e9f2f2` | `#f3fafb` | Texto da barra lateral |
| `--border` | `#333737` | `#d5e3e4` | Bordas e linhas de grade principais |
| `--border-subtle` | `#252929` | `#e5eeef` | Divisórias leves |
| `--text` | `#f0f5f5` | `#00292e` | Texto principal |
| `--text-secondary` | `#bdc8c8` | `#395556` | Texto de apoio |
| `--text-muted` | `#839090` | `#64797b` | Rótulos, metadados |
| `--text-faint` | `#5e6a6b` | `#97acad` | Placeholder |
| `--accent` | `#00ffff` | `#00ffff` | Botão principal, cronômetro, seleção, logotipo |
| `--accent-hover` | `#89ffff` | `#00eaed` | Botão principal sob o ponteiro |
| `--accent-text` | `#6cf7f7` | `#007883` | Texto e valor em destaque ("Data" em "Agrupar por: Data") |
| `--accent-strong` | `#00ffff` | `#009aa1` | Linhas, bordas de foco e ícones em ciano sobre o fundo da página |
| `--accent-inverse` | `#007883` | `#00ffff` | Destaque sobre superfície invertida (botão de ação dos avisos) |
| `--accent-contrast` | `#00191b` | `#00292e` | Texto sobre o ciano |
| `--accent-subtle` | `#002f32` | `#d9f5f6` | Fundo de item selecionado |
| `--accent-subtle-border` | `#004f54` | `#98e4e8` | Borda de item selecionado |
| `--danger` | `#f27474` | `#d33a3a` | Erro, atraso, capacidade estourada |
| `--success` | `#52c28d` | `#1e9c61` | Capacidade livre, concluído |
| `--warning` | `#f2b14c` | `#c27a00` | Feriados no calendário |
| `--now-line` | `#00ffff` | `#009aa1` | Linha de "agora" e de "hoje" |
| `--focus-ring` | ciano 50% | ciano forte 45% | Anel de foco do teclado |

Regra para cor nova de marca: parta do ciano em OKLCH (matiz 195 a 205), escolha a
luminosidade pelo papel e confira o contraste. Texto em ciano sobre fundo claro nunca usa
`--accent`.

Status e prioridade de tarefa têm tokens próprios (`--status-todo`, `--status-progress`,
`--status-done`, `--priority-low` a `--priority-urgent`) e sempre aparecem com ícone e
rótulo, nunca só pela cor. A prioridade média usa o ciano da marca (`#5ed0d2` no escuro,
`#0097a4` no claro).

Gantt: `--gantt-summary` (barra de grupo), `--gantt-dependency` (setas),
`--gantt-critical` (contorno de tarefa crítica).

## 3.3 Cores de gráfico

Validadas com o validador de paleta (separação para daltonismo, faixa de luminosidade,
saturação mínima e contraste com o fundo) nos dois temas. O ciano puro é claro demais
para marca de gráfico (fica fora da faixa de luminosidade), então a série da marca usa o
ciano mais fundo; a segunda série é violeta, que separa bem do ciano para quem tem
daltonismo e não se confunde com as cores de alerta (laranja e vermelho):

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--chart-billable` | `#009ba3` | `#0094a2` | Série "Faturável" |
| `--chart-nonbillable` | `#9085e9` | `#6250d6` | Série "Não faturável" |
| `--chart-single` | `#009ba3` | `#0094a2` | Gráfico de série única (horas por membro, por tarefa) |
| `--chart-other` | `#636f6f` | `#8c9a9b` | Fatia "Outros" e sem projeto |
| `--chart-grid` | `#272c2c` | `#e6eeee` | Linhas de grade |

Resultado do validador para o par faturável e não faturável: no escuro (fundo `#181c1c`),
separação para daltonismo 10,1 e visão normal 17,8; no claro (fundo branco), 16,3 e 21,7.
Tudo acima do alvo (8 e 15) e com contraste de 3:1 ou mais contra o fundo.

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
rosca). Elas pertencem ao dado, não ao tema. As mesmas 14 cores também são os temas de
cor do workspace (seção 3.8). As cores de gráfico desta seção não mudam com o tema do
workspace: foram validadas como par (faturável e não faturável) e um tema violeta ou azul
deixaria as duas séries parecidas.

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
  cores de marca (`--accent`, `--brand-yellow`, `--brand-light` `#72d3d8` e
  `--brand-deep` `#40696b`, os dois do ciano),
  no espírito das ilustrações do Toggl, com desenho próprio. Variantes: `shapes`,
  `people`, `clock`, `chart`, `folders`.
- Logotipo (`layout/Logo.tsx` e `public/favicon.svg`): relógio em tinta escura
  (`#00292e`) sobre círculo ciano.
- Ícones do PWA (`public/icons`): `icon-192.png` e `icon-512.png` (o círculo do logotipo
  com fundo transparente), `icon-maskable-512.png` e `apple-touch-icon.png` (quadrado
  ciano cheio com o relógio dentro da zona segura de 80%). Foram gerados a partir do desenho
  do `favicon.svg`; mudou o logotipo, gere de novo os quatro arquivos.
- Botão "Continuar com Google" (`features/auth/GoogleButton.tsx`): o "G" usa as cores da
  marca do Google em tokens próprios, iguais nos dois temas (`--brand-google-blue`,
  `--brand-google-green`, `--brand-google-yellow`, `--brand-google-red`). Não use esses
  tokens em mais nada.
- Amostra "Ciano (padrão)" do seletor de cor do workspace: `--brand-cyan` (`#00ffff`) e
  `--brand-cyan-contrast` (`#00292e`), fixos em qualquer tema de workspace, para a amostra
  mostrar o ciano mesmo quando o workspace aberto usa outra cor.

## 3.7 Temas

- Três opções por pessoa: escuro (padrão, como as capturas do Toggl), claro e do sistema.
- O tema é o atributo `data-theme` no `<html>`. O `index.html` aplica o último tema salvo
  em `localStorage` (`ott.theme`) antes do React, para a tela não piscar.
- Todo token existe nos dois temas. Ao criar token novo, defina os dois blocos.
- Únicas cores fora do `tokens.css`, porque o navegador as lê antes do CSS: a barra do
  sistema (`theme-color` no `index.html` e no `manifest.webmanifest`, com o `--bg-app`
  escuro `#181c1c`; o script do `index.html` usa `#ffffff` no tema claro) e o fundo da
  abertura do app instalado (`background_color` do manifesto). Depois de carregar,
  `applyTheme` (`app/theme.ts`) copia o `--bg-app` do tema em uso para o `theme-color`.
  Mudou o `--bg-app`? Atualize esses três lugares.
- Feriados aparecem com hachura diagonal em `--warning` sobre `--bg-weekend`; fins de
  semana só com `--bg-weekend`.
- O tema de cor do workspace é um segundo atributo, `data-accent`, no mesmo `<html>`
  (seção 3.8); `applyAccent` copia o `--bg-app` resultante para o `theme-color`, como o
  `applyTheme`.

## 3.8 Temas de cor por workspace

Cada workspace pode trocar a paleta do site por uma das 14 cores de projeto
(`Workspace.color`; nulo é a paleta ciano padrão). A troca vale para todas as pessoas do
workspace e se combina com o tema escuro ou claro de cada pessoa, então há 28 paletas além
da padrão. Elas ficam no fim do `tokens.css`, entre `/* <workspace-themes> */` e
`/* </workspace-themes> */`, com seletores `:root[data-accent='0b83d9']:not([data-theme='light'])`
e `:root[data-accent='0b83d9'][data-theme='light']` (a cor sem o `#`).

**Como cada paleta é derivada** (`scripts/workspace-themes.mjs`, mesma lógica da seção 3.2):

- **Neutros** (fundos, bordas, textos, barra lateral do escuro, linhas do Gantt): mesma
  luminosidade e saturação dos tokens padrão, com a matiz da cor escolhida. Cores pouco
  saturadas (ardósia, oliva, salmão) deixam os neutros proporcionalmente mais cinza.
- **Preenchimento** (`--accent`, logotipo, botão principal, cronômetro): a própria cor,
  clareada até ter contraste de pelo menos 6,5:1 com a tinta escura (`--accent-contrast`),
  igual nos dois temas, como o ciano.
- **Tons da marca** (texto e linha em destaque, fundo e borda de item selecionado, barra
  lateral e texto principal do tema claro, destaque dos avisos, ilustrações): luminosidade
  de cada papel tirada do ciano e saturação da cor, limitada à do ciano para cores muito
  vivas não gritarem nos fundos.
- **Não mudam**: cores de estado (erro, sucesso, aviso, informação), status e prioridade
  de tarefa (vermelho de urgente não pode virar a cor do tema) e cores de gráfico.

Contrastes conferidos pelo script em toda paleta (ele ajusta a luminosidade até passar e
falha se não conseguir): tinta sobre o preenchimento 6,5:1; texto de destaque 7:1 no
escuro e 4,8:1 sobre o branco (4,5:1 sobre o fundo selecionado); linha de destaque 3:1;
texto principal do claro 12:1; destaque dos avisos 4,5:1.

**Aplicação.** `applyAccent` (`app/theme.ts`) põe ou tira o `data-accent` e guarda a cor
em `ott.accent`; o `index.html` aplica essa cor antes do React, junto com o tema, para a
abertura não piscar em ciano. O `RootLayout` aplica a cor do workspace atual (a mesma
escolha do `AuthGate`) e volta à padrão sem login. A cor se escolhe ao criar o workspace
(barra lateral e tela sem workspace) e nas configurações do workspace (só administrador),
pelo seletor `ColorSwatches` com a amostra "Ciano (padrão)".

**Mudou `PROJECT_COLORS` ou a derivação?** Rode `npm run themes`, que regrava o trecho; o
`npm run check` roda `npm run check:themes` e falha se o `tokens.css` estiver diferente do
que o script geraria. Mudou um token neutro padrão da seção 3.2? Atualize também a lista
`NEUTRALS` do script, para os temas acompanharem.
