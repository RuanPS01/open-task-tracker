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
| Pacotes do monorepo, camadas, boot da API ou da web, fluxo de dados | [01-arquitetura.md](01-arquitetura.md) |
| Dependências, versões, scripts, variáveis de ambiente, build | [02-tecnologias.md](02-tecnologias.md) |
| Cores, fontes, tema, ícones, ilustrações, cores de gráfico | [03-identidade-visual.md](03-identidade-visual.md) |
| Qualquer tela, painel, modal, seletor ou componente de interface | [04-padrao-ui-e-componentes.md](04-padrao-ui-e-componentes.md) |
| Nomes de arquivos, componentes, rotas, colunas, chaves de texto, testes | [05-padroes-de-codigo-e-nomes.md](05-padroes-de-codigo-e-nomes.md) |
| Tabelas, migrações, entidades, rotas da API, códigos de erro, CSV | [06-dados-e-api.md](06-dados-e-api.md) |
| Login, cronômetro, apontamentos, tarefas, Gantt, feriados, relatórios | [07-fluxos-aplicacao.md](07-fluxos-aplicacao.md) |
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
  (atualize [01-arquitetura.md](01-arquitetura.md));
- criou ou mudou tabela, coluna, migração, rota, código de erro ou formato de
  resposta (atualize [06-dados-e-api.md](06-dados-e-api.md));
- mudou um token de cor, fonte, ícone ou cor de gráfico (atualize
  [03-identidade-visual.md](03-identidade-visual.md));
- adicionou, removeu ou trocou a versão de uma dependência ou script (atualize
  [02-tecnologias.md](02-tecnologias.md));
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
de tradução, mensagem de erro da API, comentário de código, mensagem de commit,
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
  (ver `scripts/check-text.mjs` e o BOM do CSV em `apps/api/src/modules/reports/csv.ts`).

O script `npm run check:text` varre todos os arquivos versionados e falha se encontrar
qualquer um desses caracteres. Ele roda dentro de `npm run check`.

## 0.2 Regras invioláveis do domínio

Estas protegem os dados dos clientes e a coerência do cronograma. Quebrá-las não é
questão de estilo.

1. **Isolamento por workspace.** Toda consulta de dado de negócio filtra por
   `workspace_id`. Rotas de recurso vivem dentro de `/api/workspaces/:workspaceId`, onde
   o gancho `requireWorkspace` confirma que a pessoa é membro ativo. Workspace de outra
   pessoa responde **404**, nunca 403, para não revelar que existe. Ver
   [01-arquitetura.md](01-arquitetura.md), seção 1.4.
2. **A API decide; a web só antecipa.** Regras de negócio (cascata, status derivado da
   tarefa-mãe, um cronômetro por pessoa, herança de projeto) ficam nos serviços da API.
   A web pode simular para dar resposta imediata (prévia da cascata no arraste do Gantt),
   mas sempre grava pela API e aceita o que ela devolver.
3. **Algoritmos de planejamento existem uma vez só, em `packages/shared`.** Calendário de
   trabalho, cascata, caminho crítico, resumo de tarefas-mãe e alocação de capacidade são
   importados pela API e pela web. Nunca reimplemente um deles dentro de uma tela.
4. **Um único cronômetro rodando por pessoa.** Garantido por índice único no banco
   (`time_entries_one_running`) e pelo serviço, que para o anterior ao iniciar outro.
5. **Datas de tarefa não têm fuso; apontamentos são instantes UTC.** `start_date` e
   `due_date` são `AAAA-MM-DD`. `start` e `stop` de apontamento são ISO 8601 em UTC. O dia
   de um apontamento nos relatórios é calculado no fuso que a web informa (`tz`). Ver
   [06-dados-e-api.md](06-dados-e-api.md), seção 6.5.
6. **Tarefa-mãe é calculada.** Datas, progresso e status da mãe vêm das filhas
   (`applyScheduling`). Não grave esses campos direto numa mãe esperando que fiquem.
7. **Migração publicada nunca muda.** Para alterar o esquema, crie a próxima versão em
   `apps/api/src/db/migrations.ts`.
8. **Segurança de sessão.** Senha só com scrypt, token de sessão guardado só como hash
   SHA-256, cookie `httpOnly` e `SameSite=Lax`, e a API não aceita `text/plain` (fecha a
   porta de CSRF por formulário). Não afrouxe nenhum desses pontos.

## 0.3 Regras de implementação

Estas valem sempre, sem precisar pedir:

1. **Nenhum texto visível escrito no componente.** Toda string de interface vive em
   `apps/web/src/i18n/pt-BR.ts` (idioma de referência) e `en.ts`. O compilador acusa se
   uma chave faltar em `en.ts`. Mensagens de erro da web saem de `errors.<CODIGO>`.
2. **Nenhuma cor escrita em componente.** Use os tokens de `apps/web/src/styles/tokens.css`
   (`var(--token)`). Cor de projeto vem do dado (`project.color`). Ver
   [03-identidade-visual.md](03-identidade-visual.md).
3. **Reaproveite antes de criar.** Procure no inventário de
   [04-padrao-ui-e-componentes.md](04-padrao-ui-e-componentes.md) e em
   `apps/web/src/components/` antes de escrever um componente novo. Se o existente faz
   80% do que precisa, estenda com uma propriedade.
4. **Respeite as fronteiras dos pacotes.** `packages/shared` não importa nada de
   `apps/`. A web nunca importa código de `apps/api` (só tipos e funções de
   `@ott/shared`). Rotas da API não falam SQL direto: usam o `repo.ts` do módulo.
5. **Dados do servidor só pelos hooks de `apps/web/src/api/`.** Nada de `fetch` solto em
   componente. Cada hook usa as chaves de `keys.ts` e invalida o que a mudança afeta.
6. **Comente o POR QUÊ, não o o quê.** Explique a decisão e o defeito que ela evita. Ver
   [05-padroes-de-codigo-e-nomes.md](05-padroes-de-codigo-e-nomes.md).
7. **Teste a regra que mudou.** Mudou algoritmo do `shared`, acrescente caso em
   `packages/shared/test`. Mudou rota ou serviço, acrescente caso em `apps/api/test`.
8. **Não suba arquivos gerados.** `node_modules/`, `dist/`, `data/` e arquivos `.sqlite`
   ficam no `.gitignore`.
9. **Nunca faça commit na branch `main`.** Trabalhe em branch própria e abra pull request.

## 0.4 Checklist de fim de tarefa

Antes de dizer que terminou:

- [ ] `npm run check` passa (caracteres proibidos, ESLint, tipos e todos os testes).
- [ ] `npm run build` termina sem erro.
- [ ] Nenhum travessão, seta ou emoji no que eu escrevi (o `check:text` confirma).
- [ ] Textos novos estão em `pt-BR.ts` e `en.ts`.
- [ ] Nenhuma cor literal fora de `tokens.css`.
- [ ] Toda consulta nova filtra por workspace; rota nova está no escopo certo.
- [ ] Conferi a tela nos temas escuro e claro, em 1366x768 e em 1920x1080.
- [ ] Documentos afetados desta pasta foram atualizados e os marcadores de estado trocados.
- [ ] Não criei componente, hook ou algoritmo duplicado do que já existia.
