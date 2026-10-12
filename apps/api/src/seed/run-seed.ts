// npm run seed: cria a conta de demonstração no banco configurado (DATABASE_PATH).
import { loadConfig } from '../config';
import { openDatabase } from '../db/database';
import { findUserByEmail } from '../modules/users/repo';
import { DEMO_EMAIL, seedDemo } from './demo';

const config = loadConfig();
const db = openDatabase(config.databasePath);

if (findUserByEmail(db, DEMO_EMAIL)) {
  console.info(`A conta ${DEMO_EMAIL} já existe em ${config.databasePath}.`);
  console.info('Para recriar os dados, apague o arquivo do banco e rode o seed de novo.');
} else {
  const credentials = await seedDemo(db);
  console.info('Dados de demonstração criados.');
  console.info(`Entre com ${credentials.email} e a senha ${credentials.password}.`);
}
db.close();
