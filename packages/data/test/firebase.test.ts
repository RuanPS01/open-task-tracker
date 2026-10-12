// Roda as mesmas suítes no emulador do Firebase, com as regras de firestore.rules
// valendo. Sem emulador (npm test comum), a suíte é pulada.
// Para rodar: npm run test:firebase (na raiz), que sobe o emulador e chama este arquivo.
import { describe } from 'vitest';
import { firebaseEnv, hasEmulator } from './env';
import { registerSuites } from './suites';
import { registerRulesSuite } from './rules';

describe.skipIf(!hasEmulator)('modo Firebase (emulador)', () => {
  registerSuites(firebaseEnv);
  registerRulesSuite();
});
