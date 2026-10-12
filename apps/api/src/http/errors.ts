// Erros de domínio com código estável. A web traduz pelo código, não pela mensagem,
// por isso a mensagem aqui é só apoio para log e para quem usa a API direto.

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Sessão inválida ou expirada') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Sem permissão para esta ação') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} não encontrado`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
