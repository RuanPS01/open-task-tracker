// Contrato do armazenamento de documentos. Há duas implementações com o mesmo
// comportamento: Firestore (modo Firebase) e lowdb (modo local). Os serviços só
// conhecem este contrato, então cada regra de negócio é escrita uma vez.
//
// O contrato é de propósito pequeno: busca por id, lista com filtros simples e
// gravação em lote atômica. Ordenação e agregação ficam nos serviços, em memória,
// para não depender de índices compostos do Firestore.

export type DataMode = 'firebase' | 'local';

/** Documento guardado: sempre tem `id` igual ao id do documento. */
export type DocData = { id: string } & Record<string, unknown>;

// Valores especiais de gravação, aplicados pelo armazenamento sobre o valor atual.
export class Increment {
  constructor(readonly by: number) {}
}
export class ArrayUnion {
  constructor(readonly values: readonly unknown[]) {}
}
export class ArrayRemove {
  constructor(readonly values: readonly unknown[]) {}
}

/** Soma ao número atual (zero se o campo não existe). Seguro com gravações simultâneas. */
export const increment = (by: number) => new Increment(by);
/** Acrescenta os valores que ainda não estão na lista. */
export const arrayUnion = (...values: unknown[]) => new ArrayUnion(values);
/** Retira da lista todas as ocorrências dos valores. */
export const arrayRemove = (...values: unknown[]) => new ArrayRemove(values);

export type FilterOp = '==' | '<' | '<=' | '>' | '>=' | 'array-contains';

export interface Filter {
  field: string;
  op: FilterOp;
  value: string | number | boolean | null;
}

export const where = (field: string, op: FilterOp, value: Filter['value']): Filter => ({ field, op, value });

export type WriteOp =
  /** Cria ou substitui o documento inteiro. */
  | { type: 'set'; path: string; id: string; data: Record<string, unknown> }
  /** Altera campos de um documento que precisa existir (campos de primeiro nível). */
  | { type: 'update'; path: string; id: string; data: Record<string, unknown> }
  | { type: 'delete'; path: string; id: string };

export interface DocStore {
  readonly mode: DataMode;
  /** Id novo de 20 caracteres, no mesmo formato do Firestore. */
  newId(): string;
  get<T>(path: string, id: string): Promise<T | null>;
  list<T>(path: string, filters?: Filter[]): Promise<T[]>;
  /** Grava tudo ou nada. Lotes grandes são divididos (limite do Firestore). */
  commit(ops: WriteOp[]): Promise<void>;
}

/** Acumula operações para um único commit. */
export class Batch {
  readonly ops: WriteOp[] = [];

  set(path: string, id: string, data: object): this {
    this.ops.push({ type: 'set', path, id, data: data as Record<string, unknown> });
    return this;
  }

  update(path: string, id: string, data: object): this {
    if (Object.keys(data).length > 0) this.ops.push({ type: 'update', path, id, data: data as Record<string, unknown> });
    return this;
  }

  delete(path: string, id: string): this {
    this.ops.push({ type: 'delete', path, id });
    return this;
  }

  get size(): number {
    return this.ops.length;
  }
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomId(length = 20): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  // 62 caracteres: o resto da divisão tem um viés mínimo, irrelevante para ids.
  for (const byte of bytes) id += ID_CHARS[byte % ID_CHARS.length];
  return id;
}
