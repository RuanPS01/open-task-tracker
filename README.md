# Open Task Tracker

Sistema de tarefas com planejamento de projeto em gráfico de Gantt e rastreamento de
tempo, feito por engenharia reversa do **Toggl Track**. Interface em português do Brasil
(e inglês), temas escuro e claro, e instalação própria com um processo Node e um arquivo
SQLite.

![Cronograma do projeto em Gantt](docs/imagens/gantt.png)

## O que tem

- **Cronômetro** no estilo do Toggl: "No que você está trabalhando?", projeto ou tarefa,
  tags, faturável, modo manual e as visões Calendário (arraste para criar, mover e
  redimensionar), Lista e Planilha.
- **Tarefas**: lista agrupada (data, projeto, status, prioridade, responsável), quadro
  kanban, filtros, "Minhas tarefas", subtarefas e o painel lateral do Toggl (projeto,
  datas, estimativa total ou por dia, prioridade, tags, responsáveis, status, faturável,
  alocação, notas), iniciar o cronômetro na própria tarefa.
- **Projetos** com visão geral (horas, estimativa, entrega prevista, horas por membro e
  por tarefa) e **cronograma em Gantt**: barras arrastáveis e redimensionáveis, marcos,
  grupos, dependências (término para início, início para início, término para término,
  início para término, com atraso), criação de dependência por arraste, cascata
  automática, caminho crítico e zoom por dias, semanas e meses.
- **Fins de semana e feriados**: dias úteis configuráveis, feriados por workspace
  (cadastro manual e importação dos feriados nacionais do Brasil) e opção por tarefa para
  trabalhar em dias não úteis.
- **Linha do tempo** de capacidade da equipe ("Xh livres", carga diária por pessoa).
- **Relatórios** Resumo, Detalhado e Semanal, com valor faturável e exportação CSV.
- Membros com capacidade e valor/hora, clientes, tags, vários workspaces, busca rápida
  (Ctrl K) e atalhos de teclado.

## Começando

Requisitos: **Node.js 22.13 ou mais novo** (usa o SQLite nativo do Node).

```bash
npm install
npm run seed     # opcional: conta demo@exemplo.com / senha demo1234 com dados de exemplo
npm run dev      # API em http://localhost:3000 e web em http://localhost:5173
```

Abra http://localhost:5173 e entre com a conta de demonstração ou crie uma conta nova.
Em desenvolvimento o banco fica em `apps/api/data/ott.sqlite`.

### Produção

```bash
npm run build
PORT=3000 DATABASE_PATH=/caminho/ott.sqlite COOKIE_SECURE=true npm start
```

Um único processo entrega a API e a interface. Variáveis em `.env.example` e em
[docs/02-tecnologias.md](docs/02-tecnologias.md).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | API e web com recarga automática |
| `npm run seed` | Cria os dados de demonstração |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm test` | Testes do pacote compartilhado, da API e da web |
| `npm run check` | Caracteres proibidos, lint, tipos e testes (rode antes de cada commit) |

## Estrutura

```
apps/api         API Fastify + SQLite (rotas, regras, relatórios, seed)
apps/web         Interface React no estilo do Toggl Track
packages/shared  Tipos, validação e algoritmos (calendário, cascata, caminho crítico, capacidade)
docs             10 documentos de referência
```

## Documentação

A pasta [docs](docs/README.md) tem os dez documentos de referência do projeto
(arquitetura, tecnologias, identidade visual, componentes, padrões, dados e API, fluxos,
algoritmos do Gantt e contexto do produto). **Quem for alterar o código, pessoa ou agente
de IA, começa por [docs/00-regras-para-ia.md](docs/00-regras-para-ia.md).**

## Aviso

Projeto independente, sem relação com a Toggl. O nome, o logotipo e as ilustrações são
próprios; a interface reproduz a organização e o comportamento do Toggl Track como
referência de produto.
