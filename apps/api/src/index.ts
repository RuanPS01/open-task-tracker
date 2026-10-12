// Ponto de entrada da API: lê a configuração, abre o banco e sobe o servidor.
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/database';
import { purgeExpiredSessions } from './modules/auth/sessions';

const config = loadConfig();
const db = openDatabase(config.databasePath);
purgeExpiredSessions(db);

const app = await buildApp({ db, config, logger: true });

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: config.host });
