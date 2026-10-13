# 0. Regras para IA

> **Leia este documento antes de qualquer alteração no projeto.** Ele vale para
> qualquer agente de IA (Claude Code, Copilot, Cursor, ChatGPT ou outro) e para
> pessoas novas no código, e tem precedência sobre preferências próprias do modelo.

## 0.1 As três regras obrigatórias

### Regra 1: consultar a documentação ANTES de implementar

Antes de escrever a primeira linha, leia os documentos desta pasta que tocam o que
você vai mexer:

| Vou mexer em... | Leia antes |
|---|---|
| Qualquer coisa | [09-contexto-do-produto.md](09-contexto-do-produto.md) |
| Pacotes do monorepo, camada de dados, modo Firebase ou local, boot da web, fluxo de dados | [01-arquitetura.md](01-arquitetura.md) |
| Dependências, versões, scripts, variáveis de ambiente, build, GitHub Actions, GitHub Pages | [02-tecnologias.md](02-tecnologias.md) |
| Cores, fontes, tema, ícones, ilustrações, cores de gráfico | [03-identidade-visual.md](03-identidade-visual.md) |
| Qualquer tela, painel, modal, seletor ou componente de interface | [04-padrao-ui-e-componentes.md](04-padrao-ui-e-componentes.md) |
| Nomes de arquivos, componentes, rotas, colunas, chaves de texto, testes | [05-padroes-de-codigo-e-nomes.md](05-padroes-de-codigo-e-nomes.md) |
| Coleções, documentos, regras do Firestore, serviços da camada de dados, códigos de erro, CSV | [06-dados-e-armazenamento.md](06-dados-e-armazenamento.md) |
| Login, convites, cronômetro, apontamentos, tarefas, Gantt, feriados, relatórios | [07-fluxos-aplicacao.md](07-fluxos-aplicacao.md) |
| Calendário de trabalho, cascata, caminho crítico, capacidade, geometria do Gantt | [08-planejamento-gantt-e-algoritmos.md](08-planejamento-gantt-e-algoritmos.md) |
| Prioridade do que fazer agora, o que está planejado | [09-contexto-do-produto.md](09-contexto-do-produto.md), seção 9.6 |

Consultar não é opcional: o defeito mais comum de agentes neste tipo de projeto é
criar um segundo seletor de projeto, um segundo cálculo de dias úteis ou uma segunda
fonte de verdade para as tarefas ao lado do que já existe. O inventário do documento
04 e o documento 08 existem para isso.

### Regra 2: atualizar a documentação DEPOIS de implementar

Se a alteração mudou qualquer informação registrada aqui, atualize o documento
correspondente **no mesmo trabalho**, não depois. Casos que sempre exigem atualização:

- criou, renomeou ou removeu um componente reutilizável, hook ou seletor
  (atualize [04-padrao-ui-e-componentes.md](04-padrao-ui-e-componentes.md));
- criou ou mudou um pacote, uma camada, a ordem de boot ou a composição de rotas
  de tela (atualize [01-arquitetura.md](01-arquitetura.md));
- criou ou mudou coleção, campo de documento, regra do Firestore, índice, serviço,
  código de erro ou formato de resultado (atualize
  [06-dados-e-armazenamento.md](06-dados-e-armazenamento.md));
- mudou um token de cor, fonte, ícone ou cor de gráfico (atualize
  [03-identidade-visual.md](03-identidade-visual.md));
- adicionou, removeu ou trocou a versão de uma dependência, script, variável de
  ambiente, secret ou workflow (atualize [02-tecnologias.md](02-tecnologias.md));
- mudou regra de calendário, cascata, caminho crítico ou alocação (atualize
  [08-planejamento-gantt-e-algoritmos.md](08-planejamento-gantt-e-algoritmos.md) e os testes);
- mudou um fluxo de login, cronômetro, tarefa, Gantt ou relatório (atualize
  [07-fluxos-aplicacao.md](07-fluxos-aplicacao.md));
- implementou algo marcado `[planejado]`: troque para `[implementado]` ou `[em andamento]`.

Documentação que descreve algo que não existe mais é pior que documentação
ausente: ela faz o próximo agente implementar contra uma realidade falsa. Se
encontrar uma informação defasada enquanto trabalha, corrija na hora, mesmo que
não seja o assunto da sua tarefa.

### Regra 3: nunca usar travessão, caractere de seta nem emoji

**Proibido** em qualquer texto gerado: rótulo de interface, entrada dos dicionários
de tradução, mensagem de erro da camada de dados, comentário de código, mensagem de commit,
texto de documentação, dado de demonstração.

| Proibido | Caractere | Use no lugar |
|---|---|---|
| Travessão | em dash (U+2014) | dois pontos, vírgula, parênteses ou ponto |
| Meia-risca | en dash (U+2013) | "a" e "até" em faixas, ou hífen simples `-` |
| Seta para a direita | U+2192 | "para", "leva a", "vira", "resulta em" |
| Seta para a esquerda | U+2190 | "vem de", "a partir de" |
| Outras setas | U+27F6, U+21D2, U+2194, U+2B05, U+279C | palavras equivalentes |
| Emoji | qualquer pictograma | palavra ou ícone do lucide-react |

Exemplos de reescrita:

```
Ruim:  // Lê a sessão (travessão) a escrita é outro método.
Bom:   // Lê a sessão. A escrita é outro método.

Ruim:  "12 out (meia-risca) 18 out"
Bom:   "12 out - 18 out"

Ruim:  Login (seta) Cronômetro (seta) Relatórios
Bom:   O login abre o Cronômetro, que leva aos Relatórios
```

O hífen simples (`-`) é permitido. Ícones desenhados (lucide-react, SVG) e a sintaxe
de seta do Mermaid (`-->`, `->>`) são permitidos: a regra é sobre CARACTERES de texto.

Dois cuidados que já causaram defeito:

- **`Intl.DateTimeFormat.formatRange` gera meia-risca.** Use `format.range()` de
  `apps/web/src/lib/format.ts`, que monta "12 out - 18 out" com hífen.
- **Escapes `\uXXXX` digitados por ferramentas de geração podem virar o caractere
  real.** Para montar caracteres especiais em código, use `String.fromCharCode(0x...)`
  (ver `scripts/check-text.mjs` e o BOM do CSV em `packages/data/src/services/reports.ts`).

O script `npm run check:text` varre todos os arquivos versionados e falha se encontrar
qualquer um desses caracteres. Ele roda dentro de `npm run check`.

## 0.2 Regras invioláveis do domínio

Estas protegem os dados dos clientes e a coerência do cronograma. Quebrá-las não é
questão de estilo.

1. **Isolamento por workspace.** Todo dado de negócio fica sob `workspaces/{id}/...`.
   As regras do Firestore (`firestore.rules`) só liberam leitura e escrita para quem
   está em `memberIds` do workspace, e os serviços conferem o mesmo com
   `loadWorkspace`, que responde `NOT_FOUND` (nunca `FORBIDDEN`) para workspace de outra
   pessoa, para não revelar que existe. Regra de acesso nova entra nos dois lugares
   (serviço e `firestore.rules`) e ganha teste em `packages/data/test/rules.ts`. Ver
   [06-dados-e-armazenamento.md](06-dados-e-armazenamento.md), seção 6.4.
2. **A camada de dados decide; a tela só antecipa.** Regras de negócio (cascata, status
   derivado da tarefa-mãe, um cronômetro por pessoa, herança de projeto, horas somadas
   em tarefas e projetos) ficam nos serviços de `packages/data/src/services`, que rodam
   iguais no modo Firebase e no modo local. A web pode simular para dar resposta
   imediata (prévia da cascata no arraste do Gantt), mas grava sempre pelos serviços e
   aceita o que eles devolvem. Componente nunca fala com Firestore ou lowdb direto.
3. **Algoritmos de planejamento existem uma vez só, em `packages/shared`.** Calendário de
   trabalho, cascata, caminho crítico, resumo de tarefas-mãe e alocação de capacidade são
   importados pela camada de dados e pela web. Nunca reimplemente um deles numa tela.
4. **Um único cronômetro rodando por pessoa.** O perfil (`users/{uid}`) guarda o ponteiro
   `runningEntry`, e o serviço para o anterior no mesmo lote em que inicia o novo, mesmo
   que o anterior esteja em outro workspace.
5. **Datas de tarefa não têm fuso; apontamentos são instantes UTC.** `startDate` e
   `dueDate` são `AAAA-MM-DD`. `start` e `stop` de apontamento são ISO 8601 em UTC. O dia
   de um apontamento nos relatórios é calculado no fuso pedido (`tz`). Ver
   [06-dados-e-armazenamento.md](06-dados-e-armazenamento.md), seção 6.6.
6. **Tarefa-mãe é calculada.** Datas, progresso e status da mãe vêm das filhas
   (`applyScheduling`). Não grave esses campos direto numa mãe esperando que fiquem.
7. **Documento gravado continua legível.** Não há migração de esquema: os documentos
   antigos ficam como estão. Campo novo precisa de valor padrão na leitura (como
   `toUser` faz com as preferências); renomear ou remover campo exige converter os
   documentos existentes. Campo usado pelas regras (`memberIds`, `adminIds`, `userId`,
   `workspaceId`, `id`) só muda junto com `firestore.rules` e os testes de regras.
8. **Segurança.** No modo Firebase a senha fica só no Firebase Auth. A configuração do
   app web (`VITE_FIREBASE_*`) não é segredo: vai no pacote publicado. Quem protege os
   dados é `firestore.rules`; nunca afrouxe uma regra para uma tela funcionar, ajuste o
   serviço. No modo local a senha é guardada com PBKDF2 e os dados ficam só no
   navegador da pessoa.

## 0.3 Regras de implementação

Estas valem sempre, sem precisar pedir:

1. **Nenhum texto visível escrito no componente.** Toda string de interface vive em
   `apps/web/src/i18n/pt-BR.ts` (idioma de referência) e `en.ts`. O compilador acusa se
   uma chave faltar em `en.ts`. Mensagens de erro da web saem de `errors.<CODIGO>`.
2. **Nenhuma cor escrita em componente.** Use os tokens de `apps/web/src/styles/tokens.css`
   (`var(--token)`). Cor de projeto vem do dado (`project.color`). Os temas de cor por
   workspace no fim do `tokens.css` são gerados: mude `scripts/workspace-themes.mjs` e rode
   `npm run themes`, nunca edite o trecho à mão. Ver
   [03-identidade-visual.md](03-identidade-visual.md), seções 3.2 e 3.8.
3. **Reaproveite antes de criar.** Procure no inventário de
   [04-padrao-ui-e-componentes.md](04-padrao-ui-e-componentes.md) e em
   `apps/web/src/components/` antes de escrever um componente novo. Se o existente faz
   80% do que precisa, estenda com uma propriedade.
4. **Respeite as fronteiras dos pacotes.** `packages/shared` não importa nada dos
   outros pacotes. `packages/data` importa só `@ott/shared`, lowdb e firebase (nunca
   React nem a web). Os serviços não chamam o SDK do Firebase nem o lowdb: usam o
   contrato `DocStore` de `packages/data/src/store/types.ts`, que tem as duas
   implementações.
5. **Dados só pelos hooks de `apps/web/src/data/`.** Nada de chamada à camada de dados
   solta em componente. Cada hook usa as chaves de `keys.ts` e invalida o que a mudança
   afeta.
6. **Comente o POR QUÊ, não o o quê.** Explique a decisão e o defeito que ela evita. Ver
   [05-padroes-de-codigo-e-nomes.md](05-padroes-de-codigo-e-nomes.md).
7. **Teste a regra que mudou.** Mudou algoritmo do `shared`, acrescente caso em
   `packages/shared/test`. Mudou serviço, acrescente caso em
   `packages/data/test/suites.ts` (roda no lowdb sempre e no emulador do Firebase com
   `npm run test:firebase`). Mudou `firestore.rules`, acrescente caso em
   `packages/data/test/rules.ts`.
8. **Não suba arquivos gerados nem segredos.** `node_modules/`, `dist/`, `.env` e os logs
   dos emuladores ficam no `.gitignore`. Configuração do Firebase de produção vai nos
   secrets do GitHub, nunca no código.
9. **Nunca faça commit na branch `main`.** Trabalhe em branch própria e abra pull request.

## 0.4 Checklist de fim de tarefa

Antes de dizer que terminou:

- [ ] `npm run check` passa (caracteres proibidos, temas de workspace em dia, ESLint, tipos
      e todos os testes).
- [ ] `npm run build` termina sem erro.
- [ ] Mexeu em `packages/data` ou `firestore.rules`: `npm run test:firebase` passa
      (precisa de Java 21; o CI roda a mesma coisa).
- [ ] Nenhum travessão, seta ou emoji no que eu escrevi (o `check:text` confirma).
- [ ] Textos novos estão em `pt-BR.ts` e `en.ts`.
- [ ] Nenhuma cor literal fora de `tokens.css`.
- [ ] Todo dado novo fica sob o workspace e tem regra correspondente em `firestore.rules`.
- [ ] Conferi a tela nos temas escuro e claro (com a cor padrão e com uma cor de workspace),
      em 1366x768 e em 1920x1080, no modo local e, se a mudança grava dados, no modo
      Firebase (emulador).
- [ ] Documentos afetados desta pasta foram atualizados e os marcadores de estado trocados.
- [ ] Não criei componente, hook ou algoritmo duplicado do que já existia.
