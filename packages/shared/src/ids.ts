import type { Id } from './entities';

/** Ordem estável entre ids (texto), usada como desempate em ordenações. */
export const compareIds = (a: Id, b: Id): number => (a < b ? -1 : a > b ? 1 : 0);
