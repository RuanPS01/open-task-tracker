// Configuração lida do ambiente uma única vez, na partida.
import { resolve } from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  cookieSecure: boolean;
  /** Pasta com a web compilada. Quando existe, a API também serve a interface. */
  webDistPath: string | null;
  sessionDays: number;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    databasePath: env.DATABASE_PATH ?? resolve(process.cwd(), 'data', 'ott.sqlite'),
    cookieSecure: env.COOKIE_SECURE === 'true',
    webDistPath: env.WEB_DIST_PATH ?? resolve(import.meta.dirname, '..', '..', 'web', 'dist'),
    sessionDays: Number(env.SESSION_DAYS ?? 30),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
