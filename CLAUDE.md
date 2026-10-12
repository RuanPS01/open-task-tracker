# Instruções para agentes

Antes de qualquer alteração, leia [docs/00-regras-para-ia.md](docs/00-regras-para-ia.md)
e os documentos que ele indica para a área que você vai mexer. Depois de implementar,
atualize os documentos afetados no mesmo trabalho.

Resumo do que não pode faltar:

- Textos de interface só em `apps/web/src/i18n/pt-BR.ts` e `en.ts`; cores só por tokens de
  `apps/web/src/styles/tokens.css`.
- Regras de planejamento (calendário, cascata, caminho crítico, capacidade) só em
  `packages/shared`; a API decide, a web antecipa.
- Toda consulta filtra por workspace.
- Nunca use travessão, caractere de seta ou emoji em código, texto, documentação ou commit.
- Antes de terminar: `npm run check` e `npm run build`.

Comandos: `npm install`, `npm run seed`, `npm run dev`, `npm test`, `npm run check`.
