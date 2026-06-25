// ── Límite de apariciones de un selfie en el player ──────────────────────────
// Un selfie expira a los 60 min (ver transform-selfie), pero durante esa hora
// la rotación lo mostraría decenas de veces — cuando el cliente ya se fue, no
// tiene sentido. Lo capamos a MAX_SELFIE_SHOWS apariciones. El conteo vive en
// localStorage (sobrevive el auto-reload del player cada 3h) y se purga de los
// selfies que ya expiraron para no crecer. Al cliente se le promete en
// SelfiePage que sale "2 veces en la próxima hora".
//
// Esta lógica se extrajo de PlayerPage para poder testearla en aislamiento:
// es anti-abuso que cuesta dinero real si se rompe (cada selfie consume una
// llamada de IA), así que tiene su propia red de tests (selfie-shows.test.ts).

export const MAX_SELFIE_SHOWS = 2;
export const SELFIE_SHOWS_KEY = "adscreenpro-selfie-shows";

// El cap es POR CLIENTE, no por imagen: un cliente puede tomarse varias selfies
// (rate-limit por fingerprint), y si contáramos por id cada una saldría 2 veces
// → el cliente saldría hasta 6. Contamos por el fingerprint (metadata.fp) que
// identifica al cliente; así sale máx 2 veces en total sin importar cuántas
// selfies se tome. Fallback al id si no hay fp.
export function selfieIdentity(ad: { id: string; metadata?: any }): string {
  return ad.metadata?.fp ?? ad.id;
}

export function getSelfieShows(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SELFIE_SHOWS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function bumpSelfieShows(id: string): number {
  const shows = getSelfieShows();
  shows[id] = (shows[id] || 0) + 1;
  try {
    localStorage.setItem(SELFIE_SHOWS_KEY, JSON.stringify(shows));
  } catch {
    /* ignore */
  }
  return shows[id];
}

// Elimina del contador los selfies que ya no están activos (expirados), para
// que localStorage no crezca indefinidamente.
export function pruneSelfieShows(activeIds: Set<string>) {
  const shows = getSelfieShows();
  let changed = false;
  for (const id of Object.keys(shows)) {
    if (!activeIds.has(id)) {
      delete shows[id];
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(SELFIE_SHOWS_KEY, JSON.stringify(shows));
    } catch {
      /* ignore */
    }
  }
}
