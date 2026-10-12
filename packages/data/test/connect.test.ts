import { LowSync, MemorySync } from 'lowdb';
import { describe, expect, it } from 'vitest';
import { LocalAuth } from '../src/auth/local';
import { connect } from '../src/connect';
import { checkFirestoreDatabase, classifyFirestoreResponse } from '../src/firebase/health';
import { emptyLocalData, LocalStore, type LocalData } from '../src/store/local';

// Respostas reais da API REST do Firestore (resumidas).
type OpenFirebase = NonNullable<Parameters<typeof connect>[0]['openFirebase']>;

const SERVICE_DISABLED = {
  error: {
    code: 403,
    message: 'Cloud Firestore API has not been used in project demo before or it is disabled.',
    status: 'PERMISSION_DENIED',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED' }],
  },
};
const NO_DATABASE = {
  error: { code: 404, message: 'The database (default) does not exist for project demo', status: 'NOT_FOUND' },
};
const RULES_DENIED = { error: { code: 403, message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } };
const NO_DOCUMENT = { error: { code: 404, message: 'Document "projects/demo/documents/_probe/ping" not found.', status: 'NOT_FOUND' } };
const BAD_KEY = { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } };

const config = { apiKey: 'chave', authDomain: 'demo.firebaseapp.com', projectId: 'demo', appId: '1:1:web:1' };
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe('checagem rápida do Firestore', () => {
  it('reconhece banco não criado e API desativada', () => {
    expect(classifyFirestoreResponse(403, SERVICE_DISABLED).status).toBe('missing');
    expect(classifyFirestoreResponse(404, NO_DATABASE).status).toBe('missing');
  });

  it('banco existente responde mesmo quando as regras recusam ou o documento não existe', () => {
    expect(classifyFirestoreResponse(403, RULES_DENIED).status).toBe('ok');
    expect(classifyFirestoreResponse(404, NO_DOCUMENT).status).toBe('ok');
    expect(classifyFirestoreResponse(200, {}).status).toBe('ok');
  });

  it('o resto fica para o SDK decidir', async () => {
    expect(classifyFirestoreResponse(400, BAD_KEY)).toEqual({ status: 'unknown', detail: BAD_KEY.error.message });
    const failing = (async () => {
      throw new Error('sem rede');
    }) as typeof fetch;
    expect(await checkFirestoreDatabase(config, { timeoutMs: 1000, fetch: failing })).toMatchObject({ status: 'unknown' });
  });

  it('chama a API REST do projeto com a chave', async () => {
    let called = '';
    const spy = (async (url: string) => {
      called = url;
      return new Response(JSON.stringify(RULES_DENIED), { status: 403 });
    }) as typeof fetch;
    expect((await checkFirestoreDatabase(config, { timeoutMs: 1000, fetch: spy })).status).toBe('ok');
    expect(called).toBe('https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents/_probe/ping?key=chave');
  });

  // Abertura falsa do Firebase, sem rede: fica pendurada como o SDK sem banco (até ser
  // cancelada), falha como o SDK no Node, ou conecta.
  const hanging = (async (_config, options) =>
    new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(new Error('cancelada'))))) as OpenFirebase;
  const offline = (async () => {
    throw new Error('Failed to get document because the client is offline.');
  }) as OpenFirebase;
  const local = { adapter: new MemorySync<LocalData>() };

  it('sem banco no projeto, cai logo para o modo local com o motivo', async () => {
    const started = Date.now();
    const backend = await connect({ firebase: config, fetch: reply(403, SERVICE_DISABLED), openFirebase: hanging, local });
    expect(backend.mode).toBe('local');
    expect(backend.fallbackReason).toBe('firestore-missing');
    expect(backend.fallbackDetail).toContain('Cloud Firestore API');
    // Bem antes do tempo limite de 8 s da conexão pelo SDK.
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it('quando o SDK falha antes, o motivo também é conferido', async () => {
    const backend = await connect({ firebase: config, fetch: reply(404, NO_DATABASE), openFirebase: offline, local });
    expect(backend.fallbackReason).toBe('firestore-missing');
    const other = await connect({ firebase: config, fetch: reply(403, RULES_DENIED), openFirebase: offline, local });
    expect(other.fallbackReason).toBe('unreachable');
    expect(other.fallbackDetail).toContain('offline');
  });

  it('com o SDK conectando rápido, a API REST nem é consultada', async () => {
    let calls = 0;
    const counting = (async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    // Conexão que dá certo na hora (um armazenamento em memória faz o papel do Firestore).
    const ready = (async () => {
      const db = new LowSync<LocalData>(new MemorySync<LocalData>(), emptyLocalData());
      return { store: new LocalStore(db), auth: new LocalAuth(db) };
    }) as OpenFirebase;
    const backend = await connect({ firebase: config, fetch: counting, openFirebase: ready, local });
    expect(backend.fallbackReason).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(calls).toBe(0);
  });

  it('com o Firebase obrigatório, o erro sobe com o código FIRESTORE_MISSING', async () => {
    await expect(
      connect({ firebase: config, preferred: 'firebase', fetch: reply(404, NO_DATABASE), openFirebase: hanging }),
    ).rejects.toMatchObject({ code: 'FIRESTORE_MISSING' });
  });
});
