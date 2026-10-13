// Service worker do PWA. O build (pwa/plugin.ts) troca __VERSION__ pela versão do
// build e __PRECACHE__ pela lista de arquivos do site, e grava o resultado em sw.js.
// Só guarda arquivos do próprio site: Firebase, Google e qualquer outro endereço
// passam direto pela rede, sem cache.
const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const CACHE = `ott-${VERSION}`;
// Subcaminho de publicação (por exemplo /open-task-tracker/), o mesmo do escopo.
const BASE = new URL('./', self.location).pathname;
const INDEX = `${BASE}index.html`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => BASE + path))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('ott-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// A página pede para a versão nova assumir quando a pessoa toca em "Atualizar".
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    // Páginas: rede primeiro (sempre o index.html mais novo); sem rede, o app guardado.
    event.respondWith(fetch(request).catch(() => caches.match(INDEX).then((cached) => cached ?? Response.error())));
    return;
  }

  // Arquivos do build: cache primeiro (os nomes mudam a cada versão); o que faltar vem
  // da rede e fica guardado para a próxima vez.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
