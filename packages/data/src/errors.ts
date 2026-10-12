// Erros de domínio com código estável. A web traduz pelo código (errors.<CODIGO> no
// dicionário de textos), nunca pela mensagem, que serve só para log e testes.
import type { z } from 'zod';

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(code, message, details);
export const unauthorized = (message = 'Sessão inválida ou expirada') => new AppError('UNAUTHORIZED', message);
export const forbidden = (message = 'Sem permissão para esta ação') => new AppError('FORBIDDEN', message);
export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} não encontrado`);
export const conflict = (code: string, message: string) => new AppError(code, message);

/** Valida a entrada com o esquema compartilhado; erro vira VALIDATION com os detalhes do zod. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('VALIDATION', 'Dados inválidos', result.error.issues);
  }
  return result.data;
}
