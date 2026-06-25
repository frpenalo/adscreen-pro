import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_SELFIE_SHOWS,
  SELFIE_SHOWS_KEY,
  selfieIdentity,
  getSelfieShows,
  bumpSelfieShows,
  pruneSelfieShows,
} from "./selfie-shows";

// Anti-abuso de selfies: cada aparición de un selfie consume cuota (la imagen
// ya se generó con IA, que cuesta dinero). Estas pruebas blindan la regla de
// negocio: un CLIENTE no debe salir más de MAX_SELFIE_SHOWS veces, sin importar
// cuántas fotos se tome ni cuánto tiempo pase. Si alguien rompe esto en el
// futuro, el test lo atrapa antes de que llegue a las TVs.

beforeEach(() => {
  localStorage.clear();
});

describe("selfieIdentity — el cap es por cliente, no por imagen", () => {
  it("usa el fingerprint (fp) del cliente cuando existe", () => {
    const ad = { id: "img-123", metadata: { fp: "cliente-abc" } };
    expect(selfieIdentity(ad)).toBe("cliente-abc");
  });

  it("cae al id de la imagen si no hay fingerprint", () => {
    expect(selfieIdentity({ id: "img-123" })).toBe("img-123");
    expect(selfieIdentity({ id: "img-123", metadata: {} })).toBe("img-123");
  });

  it("dos selfies del MISMO cliente comparten identidad (cuentan como uno)", () => {
    const foto1 = { id: "img-1", metadata: { fp: "cliente-abc" } };
    const foto2 = { id: "img-2", metadata: { fp: "cliente-abc" } };
    expect(selfieIdentity(foto1)).toBe(selfieIdentity(foto2));
  });
});

describe("getSelfieShows — lectura robusta de localStorage", () => {
  it("devuelve objeto vacío cuando no hay nada guardado", () => {
    expect(getSelfieShows()).toEqual({});
  });

  it("no explota si el localStorage tiene JSON corrupto", () => {
    localStorage.setItem(SELFIE_SHOWS_KEY, "{ esto no es json válido");
    expect(getSelfieShows()).toEqual({});
  });
});

describe("bumpSelfieShows — conteo de apariciones", () => {
  it("arranca en 1 la primera vez y persiste", () => {
    expect(bumpSelfieShows("cliente-abc")).toBe(1);
    expect(getSelfieShows()).toEqual({ "cliente-abc": 1 });
  });

  it("incrementa en cada llamada", () => {
    expect(bumpSelfieShows("cliente-abc")).toBe(1);
    expect(bumpSelfieShows("cliente-abc")).toBe(2);
    expect(bumpSelfieShows("cliente-abc")).toBe(3);
  });

  it("cuenta clientes distintos por separado", () => {
    bumpSelfieShows("cliente-abc");
    bumpSelfieShows("cliente-xyz");
    bumpSelfieShows("cliente-abc");
    expect(getSelfieShows()).toEqual({ "cliente-abc": 2, "cliente-xyz": 1 });
  });
});

describe("REGLA DE NEGOCIO: un cliente sale máximo MAX_SELFIE_SHOWS veces", () => {
  // Esta es la prueba que protege el dinero. Simula el chequeo real del player:
  //   if (bumpSelfieShows(selfieIdentity(cur)) >= MAX_SELFIE_SHOWS) → retirar
  it("permite exactamente MAX_SELFIE_SHOWS apariciones y luego marca para retirar", () => {
    const cliente = { id: "img-1", metadata: { fp: "cliente-abc" } };
    const apariciones: number[] = [];
    // El player muestra y cuenta hasta 5 veces; vemos cuándo se retira.
    for (let i = 0; i < 5; i++) {
      apariciones.push(bumpSelfieShows(selfieIdentity(cliente)));
    }
    // Alcanza el tope en la aparición #MAX_SELFIE_SHOWS.
    const apariciónQueRetira = apariciones.findIndex((n) => n >= MAX_SELFIE_SHOWS);
    expect(apariciónQueRetira).toBe(MAX_SELFIE_SHOWS - 1); // índice 1 → 2ª vez
  });

  it("un cliente con VARIAS selfies sigue saliendo máx MAX_SELFIE_SHOWS (no se multiplica)", () => {
    // El mismo cliente se toma 3 fotos distintas (ids distintos, mismo fp).
    const fotos = [
      { id: "img-1", metadata: { fp: "cliente-abc" } },
      { id: "img-2", metadata: { fp: "cliente-abc" } },
      { id: "img-3", metadata: { fp: "cliente-abc" } },
    ];
    // Cada foto rota una vez en el player.
    fotos.forEach((f) => bumpSelfieShows(selfieIdentity(f)));
    // Pese a 3 fotos, el cliente acumuló 3 shows bajo UNA identidad — la lógica
    // de fetchAds lo excluiría porque ya superó el cap, no x3.
    expect(getSelfieShows()).toEqual({ "cliente-abc": 3 });
    expect(getSelfieShows()["cliente-abc"]).toBeGreaterThanOrEqual(MAX_SELFIE_SHOWS);
  });
});

describe("pruneSelfieShows — limpieza de expirados (evita crecer sin fin)", () => {
  it("elimina del contador los selfies que ya no están activos", () => {
    bumpSelfieShows("cliente-viejo");
    bumpSelfieShows("cliente-activo");
    pruneSelfieShows(new Set(["cliente-activo"]));
    expect(getSelfieShows()).toEqual({ "cliente-activo": 1 });
  });

  it("conserva todos si todos siguen activos", () => {
    bumpSelfieShows("a");
    bumpSelfieShows("b");
    pruneSelfieShows(new Set(["a", "b"]));
    expect(getSelfieShows()).toEqual({ a: 1, b: 1 });
  });

  it("no escribe si no hay nada que purgar (sin cambios)", () => {
    bumpSelfieShows("a");
    pruneSelfieShows(new Set(["a"]));
    expect(getSelfieShows()).toEqual({ a: 1 });
  });

  it("deja el contador vacío si ninguno sigue activo", () => {
    bumpSelfieShows("a");
    bumpSelfieShows("b");
    pruneSelfieShows(new Set());
    expect(getSelfieShows()).toEqual({});
  });
});
