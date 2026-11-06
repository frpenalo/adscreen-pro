import { describe, it, expect } from "vitest";
import { parsePlan, sanitizeKulturaRef, planPriceUsd } from "./checkout-plan";

// El plan decide cuánto se le cobra al anunciante y a qué sistema (Kultura)
// se le avisa del pago. Un plan mal leído cobra el precio equivocado; un ref
// con caracteres inválidos hace que Stripe rechace la sesión de pago.

describe("parsePlan — qué plan llega en la URL", () => {
  it("reconoce el paquete Kultura 360", () => {
    expect(parsePlan("raleigh360")).toBe("raleigh360");
  });

  it("cualquier otro valor es el plan normal de pantallas", () => {
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan("")).toBeNull();
    expect(parsePlan("RALEIGH360")).toBeNull();
    expect(parsePlan("gratis")).toBeNull();
  });
});

describe("sanitizeKulturaRef — ref válido para client_reference_id de Stripe", () => {
  it("acepta letras, números, guion y guion bajo", () => {
    expect(sanitizeKulturaRef("a1B2-c3_d4")).toBe("a1B2-c3_d4");
  });

  it("rechaza vacío, espacios, símbolos y más de 200 caracteres", () => {
    expect(sanitizeKulturaRef("")).toBeNull();
    expect(sanitizeKulturaRef("abc def")).toBeNull();
    expect(sanitizeKulturaRef("abc&x=1")).toBeNull();
    expect(sanitizeKulturaRef("a".repeat(201))).toBeNull();
    expect(sanitizeKulturaRef(undefined)).toBeNull();
  });
});

describe("planPriceUsd — precio que ve y firma el anunciante", () => {
  it("paquete $99, pantallas $79", () => {
    expect(planPriceUsd("raleigh360")).toBe(99);
    expect(planPriceUsd(null)).toBe(79);
  });
});
