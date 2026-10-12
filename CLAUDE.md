# Instruções para agentes

Antes de qualquer alteração, leia [docs/00-regras-para-ia.md](docs/00-regras-para-ia.md)
e os documentos que ele indica para a área que você vai mexer. Depois de implementar,
atualize os documentos afetados no mesmo trabalho.

Resumo do que não pode faltar:

- Textos de interface só em `apps/web/src/i18n/pt-BR.ts` e `en.ts`; cores só por tokens de
  `apps/web/src/styles/tokens.css`.
- Regras de planejamento (calendário, cascata, caminho crítico, capacidade) só em
  `packages/shared`; regras que leem ou gravam dados só nos serviços de `packages/data`,
  que valem igual no modo Firebase e no modo local (lowdb). A tela só antecipa.
- Todo dado fica sob `workspaces/{id}` e toda regra de acesso existe nos dois lugares:
  no serviço e em `firestore.rules` (com teste em `packages/data/test/rules.ts`).
- Nunca use travessão, caractere de seta ou emoji em código, texto, documentação ou commit.
- Antes de terminar: `npm run check` e `npm run build`; se mexeu em `packages/data` ou
  `firestore.rules`, também `npm run test:firebase` (precisa de Java 21).

Comandos: `npm install`, `npm run dev`, `npm test`, `npm run test:firebase`, `npm run check`.
