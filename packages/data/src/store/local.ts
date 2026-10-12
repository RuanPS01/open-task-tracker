// Armazenamento local com lowdb. No navegador o adaptador é o localStorage (os dados
// ficam só naquele navegador); nos testes, a memória. O formato espelha o Firestore:
// um objeto por caminho de coleção, com os documentos indexados pelo id.
import type { LowSync } from 'lowdb';
import {
  ArrayRemove,
  ArrayUnion,
  Increment,
  randomId,
  type DocStore,
  type Filter,
  type WriteOp,
} from './types';
import { notFound } from '../errors';

export interface LocalAccount {
  uid: string;
  email: string;
  /** PBKDF2 com SHA-256; sal e hash em base64. */
  salt: string;
  hash: string;
  iterations: number;
}

export interface LocalData {
  version: 1;
  collections: Record<string, Record<string, Record<string, unknown>>>;
  /** Contas do modo local, indexadas pelo e-mail em minúsculas. */
  accounts: Record<string, LocalAccount>;
  /** Quem está logado neste navegador (vale para todas as abas). */
  sessionUid: string | null;
}

export const emptyLocalData = (): LocalData => ({ version: 1, collections: {}, accounts: {}, sessionUid: null });

function compare(a: unknown, b: unknown): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  // Como no Firestore, filtros de intervalo ignoram valores nulos ou de outro tipo.
  return null;
}

export function matchesFilter(doc: Record<string, unknown>, filter: Filter): boolean {
  const value = doc[filter.field] ?? null;
  switch (filter.op) {
    case '==':
      return value === filter.value;
    case 'array-contains':
      return Array.isArray(value) && value.includes(filter.value);
    default: {
      const order = compare(value, filter.value);
      if (order === null) return false;
      if (filter.op === '<') return order < 0;
      if (filter.op === '<=') return order <= 0;
      if (filter.op === '>') return order > 0;
      return order >= 0;
    }
  }
}

function resolveValue(value: unknown, current: unknown): unknown {
  if (value instanceof Increment) return (typeof current === 'number' ? current : 0) + value.by;
  if (value instanceof ArrayUnion) {
    const list = Array.isArray(current) ? [...(current as unknown[])] : [];
    for (const item of value.values) if (!list.includes(item)) list.push(item);
    return list;
  }
  if (value instanceof ArrayRemove) {
    return Array.isArray(current) ? (current as unknown[]).filter((item) => !value.values.includes(item)) : [];
  }
  return structuredClone(value);
}

function applyFields(target: Record<string, unknown>, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    // Campo indefinido é ignorado, como no Firestore com ignoreUndefinedProperties.
    if (value === undefined) continue;
    target[key] = resolveValue(value, target[key]);
  }
}

export class LocalStore implements DocStore {
  readonly mode = 'local' as const;

  constructor(readonly db: LowSync<LocalData>) {
    if (!db.data) db.data = emptyLocalData();
  }

  /** Relê o adaptador (outra aba gravou no localStorage). */
  reload(): void {
    this.db.read();
    if (!this.db.data) this.db.data = emptyLocalData();
  }

  newId(): string {
    return randomId();
  }

  async get<T>(path: string, id: string): Promise<T | null> {
    const doc = this.db.data.collections[path]?.[id];
    return doc ? (structuredClone(doc) as T) : null;
  }

  async list<T>(path: string, filters: Filter[] = []): Promise<T[]> {
    const docs = Object.values(this.db.data.collections[path] ?? {});
    return docs.filter((doc) => filters.every((filter) => matchesFilter(doc, filter))).map((doc) => structuredClone(doc) as T);
  }

  async commit(ops: WriteOp[]): Promise<void> {
    if (ops.length === 0) return;
    // Lê de novo antes de gravar: outra aba pode ter gravado depois da última leitura.
    this.reload();
    const collections = this.db.data.collections;
    // Rascunho só das coleções tocadas: se uma operação falhar, nada é gravado.
    const draft = new Map<string, Record<string, Record<string, unknown>>>();
    const collection = (path: string) => {
      let docs = draft.get(path);
      if (!docs) {
        docs = { ...(collections[path] ?? {}) };
        draft.set(path, docs);
      }
      return docs;
    };
    for (const op of ops) {
      const docs = collection(op.path);
      if (op.type === 'delete') {
        delete docs[op.id];
      } else if (op.type === 'set') {
        const doc: Record<string, unknown> = {};
        applyFields(doc, op.data);
        docs[op.id] = doc;
      } else {
        const current = docs[op.id];
        if (!current) throw notFound(`Documento ${op.path}/${op.id}`);
        const doc = { ...current };
        applyFields(doc, op.data);
        docs[op.id] = doc;
      }
    }
    for (const [path, docs] of draft) {
      if (Object.keys(docs).length === 0) delete collections[path];
      else collections[path] = docs;
    }
    this.db.write();
  }
}
