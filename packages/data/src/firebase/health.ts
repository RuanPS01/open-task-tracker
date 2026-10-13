// Checagem rápida do Firestore pela API REST, sem o SDK. Quando o projeto não tem o
// banco criado (ou a API do Firestore está desativada), o SDK só avisa no console e
// tenta de novo para sempre; a API REST responde na hora e diz o motivo.
import type { FirebaseOptions } from 'firebase/app';

export type FirestoreHealthStatus =
  /** Banco existe e respondeu (inclusive com recusa das regras). */
  | 'ok'
  /** Banco não criado ou API do Firestore desativada no projeto. */
  | 'missing'
  /** Sem resposta conclusiva (rede, tempo esgotado): o SDK decide. */
  | 'unknown';

export interface FirestoreHealth {
  status: FirestoreHealthStatus;
  detail: string;
}

interface RestError {
  error?: { message?: string; status?: string; details?: { reason?: string }[] };
}

/** Interpreta a resposta de uma leitura de documento qualquer na API REST. */
export function classifyFirestoreResponse(httpStatus: number, body: unknown): FirestoreHealth {
  const error = (body as RestError | null)?.error;
  const message = error?.message ?? '';
  const reasons = (error?.details ?? []).map((item) => item.reason);
  if (httpStatus >= 200 && httpStatus < 300) return { status: 'ok', detail: '' };
  // API do Firestore nunca usada ou desativada no projeto do Google Cloud.
  if (reasons.includes('SERVICE_DISABLED') || /has not been used|is disabled/i.test(message)) {
    return { status: 'missing', detail: message };
  }
  // 404 de banco inexistente; 404 de documento inexistente é resposta normal.
  if (httpStatus === 404) {
    return /database .*(does not exist|not found)/i.test(message) ? { status: 'missing', detail: message } : { status: 'ok', detail: '' };
  }
  // 403 das regras de segurança (sem login): o banco existe.
  if (httpStatus === 403 && error?.status === 'PERMISSION_DENIED') return { status: 'ok', detail: '' };
  return { status: 'unknown', detail: message || `HTTP ${httpStatus}` };
}

export async function checkFirestoreDatabase(
  config: Pick<FirebaseOptions, 'apiKey' | 'projectId'>,
  options: { timeoutMs: number; signal?: AbortSignal; fetch?: typeof fetch },
): Promise<FirestoreHealth> {
  const doFetch = options.fetch ?? globalThis.fetch;
  if (!doFetch || !config.projectId || !config.apiKey) return { status: 'unknown', detail: '' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const stop = () => controller.abort();
  options.signal?.addEventListener('abort', stop);
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}` +
    `/databases/(default)/documents/_probe/ping?key=${encodeURIComponent(config.apiKey)}`;
  try {
    const response = await doFetch(url, { signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    return classifyFirestoreResponse(response.status, body);
  } catch (error) {
    return { status: 'unknown', detail: (error as Error).message ?? String(error) };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', stop);
  }
}
