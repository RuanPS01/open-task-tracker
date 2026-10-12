// Ponte entre o cache de mutações (fora do React) e os avisos traduzidos.
// O RootLayout registra a função com o dicionário do idioma atual.
let notify: (error: unknown) => void = (error) => console.error(error);

export function setErrorNotifier(fn: (error: unknown) => void): void {
  notify = fn;
}

export function notifyError(error: unknown): void {
  notify(error);
}
