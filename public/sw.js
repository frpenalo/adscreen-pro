const CACHE = "adscreenpro-player-v1";

const EMERGENCY_JOKES = [
  { setup: "¿Por qué los pájaros vuelan hacia el sur en invierno?", delivery: "¡Porque caminar sería demasiado lejos!" },
  { setup: "¿Qué le dice un semáforo a otro?", delivery: "¡No me mires, me estoy cambiando!" },
  { setup: "¿Por qué el libro de matemáticas estaba triste?", delivery: "¡Porque tenía demasiados problemas!" },
  { setup: "¿Qué hace una abeja en el gimnasio?", delivery: "¡Zum-ba!" },
  { setup: "¿Cómo se llama el campeón de buceo de Japón?", delivery: "Tokofondo." },
  { setup: "¿Qué le dijo el océano a la playa?", delivery: "Nada — solo saludó." },
  { setup: "¿Por qué los esqueletos no pelean entre ellos?", delivery: "¡Porque no tienen agallas!" },
];

// App shell to pre-cache on install
const SHELL = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Emergency jokes endpoint — always works offline
  if (url.pathname === "/sw-jokes") {
    e.respondWith(
      new Response(JSON.stringify(EMERGENCY_JOKES), {
        headers: { "Content-Type": "application/json" },
      })
    );
    return;
  }

  // Navigation (HTML) — network first, fall back to cached index.html
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // JS / CSS / fonts — cache first
  if (/\.(js|css|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
            return res;
          })
      )
    );
    return;
  }

  // Ad media images/videos from Supabase storage — cache as they play
  if (url.hostname.includes("supabase") && url.pathname.includes("ad-media")) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request)
            .then((res) => {
              if (res.ok) {
                caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
              }
              return res;
            })
            .catch(() => cached || new Response("", { status: 503 }))
      )
    );
    return;
  }
});
