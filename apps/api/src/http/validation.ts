import type { z } from 'zod';
import { badRequest } from './errors';

/** Valida a entrada e devolve o valor já convertido, ou lança erro 400 com os detalhes. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(
      'VALIDATION',
      'Dados inválidos',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
