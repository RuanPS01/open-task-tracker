# Open Task Tracker

Sistema de tarefas com planejamento de projeto em gráfico de Gantt e rastreamento de
tempo, feito por engenharia reversa do **Toggl Track**. Interface em português do Brasil
(e inglês), temas escuro e claro. Roda inteiro no navegador: os dados ficam no
**Firebase** (Authentication e Cloud Firestore) e, se o Firebase não estiver configurado
ou não responder, no próprio navegador com o **lowdb**. Publicação pronta para o
**GitHub Pages** pelo GitHub Actions.

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
- **Importação de tarefas por JSON**: cole ou carregue um arquivo com várias tarefas
  (subtarefas, datas, duração em dias úteis, estimativas, responsáveis, tags e
  dependências), revise tudo num modal antes de gravar e use o botão "Copiar prompt para
  IA" para pedir o JSON pronto a qualquer assistente, já com os projetos, membros, tags e
  feriados do workspace.
- **Fins de semana e feriados**: dias úteis configuráveis, feriados por workspace
  (cadastro manual e importação dos feriados nacionais do Brasil) e opção por tarefa para
  trabalhar em dias não úteis.
- **Linha do tempo** de capacidade da equipe ("Xh livres", carga diária por pessoa).
- **Relatórios** Resumo, Detalhado e Semanal, com valor faturável e exportação CSV.
- Membros com capacidade e valor/hora e **convite por link**, clientes, tags, vários
  workspaces, busca rápida (Ctrl K) e atalhos de teclado.

## Começando

Requisitos: **Node.js 22.13 ou mais novo**.

```bash
npm install
npm run dev      # web em http://localhost:5173
```

Sem configuração, o app abre no **modo local**: tudo fica no `localStorage` do
navegador (lowdb). Na tela de login, **"Explorar com dados de exemplo"** entra com a conta
`demo@exemplo.com` (senha `demo1234`) e um workspace de exemplo pronto.

### Usando o Firebase

1. No [console do Firebase](https://console.firebase.google.com), crie o projeto, ative
   Authentication com **E-mail/senha**, crie o banco do **Cloud Firestore** e registre um
   app da Web.
2. Copie `.env.example` para `.env` (na raiz) e preencha as variáveis `VITE_FIREBASE_*`
   com a configuração do app.
3. Publique as regras de acesso e o índice:
   `npx firebase-tools@15.31.0 deploy --only firestore:rules,firestore:indexes --project SEU_PROJETO`.

Se o Firebase não responder na abertura, o app cai no modo local e avisa com uma faixa no
topo da tela. Para criar dados de exemplo no Firebase, marque "Preencher com dados de
exemplo" ao criar um workspace.

## Publicação no GitHub Pages

O workflow `.github/workflows/deploy.yml` publica a cada push na `main`:

1. Em **Settings, Pages**, escolha **Source: GitHub Actions**.
2. Em **Settings, Secrets and variables, Actions**, cadastre os secrets
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID` e `FIREBASE_APP_ID`
   (e, opcionalmente, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID` e
   `FIREBASE_SERVICE_ACCOUNT` para o workflow publicar as regras do Firestore).
3. No Firebase, acrescente `seu-usuario.github.io` aos domínios autorizados do
   Authentication.

Sem os secrets, o site é publicado assim mesmo e funciona no modo local. Detalhes em
[docs/02-tecnologias.md](docs/02-tecnologias.md), seção 2.6.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Web com recarga automática |
| `npm run build` / `npm run preview` | Site estático em `apps/web/dist` e conferência local |
| `npm test` | Testes do pacote compartilhado, da camada de dados (lowdb) e da web |
| `npm run test:firebase` | As mesmas suítes e os testes de regras nos emuladores do Firebase (precisa de Java 21) |
| `npm run check` | Caracteres proibidos, lint, tipos e testes (rode antes de cada commit) |

## Estrutura

```
apps/web         Interface React no estilo do Toggl Track (site estático)
packages/data    Camada de dados: Firestore ou lowdb, autenticação e regras de negócio
packages/shared  Tipos, validação e algoritmos (calendário, cascata, caminho crítico, capacidade)
firestore.rules  Regras de acesso do Firestore
.github          CI de pull requests e publicação no GitHub Pages
docs             10 documentos de referência
```

## Documentação

A pasta [docs](docs/README.md) tem os dez documentos de referência do projeto
(arquitetura, tecnologias, identidade visual, componentes, padrões, dados e
armazenamento, fluxos, algoritmos do Gantt e contexto do produto). **Quem for alterar o
código, pessoa ou agente de IA, começa por [docs/00-regras-para-ia.md](docs/00-regras-para-ia.md).**

## Aviso

Projeto independente, sem relação com a Toggl. O nome, o logotipo e as ilustrações são
próprios; a interface reproduz a organização e o comportamento do Toggl Track como
referência de produto.
