import { describe, it, expect } from "vitest";
import { referralCode, normalizeRedeemCode } from "./codes";

// El código de referido atribuye un alta de advertiser al partner correcto:
// si generación y lookup usan formatos distintos, el partner pierde su
// comisión. Estos tests fijan el formato como contrato.

describe("referralCode — atribución del partner", () => {
  it("toma los primeros 8 chars del UUID, en mayúsculas, con prefijo REF-", () => {
    expect(referralCode("1fd18852-5375-46aa-883e-73417626ba6b")).toBe("REF-1FD18852");
  });

  it("siempre arranca con REF- y tiene 12 caracteres", () => {
    const code = referralCode("abcdef12-0000-0000-0000-000000000000");
    expect(code).toMatch(/^REF-[0-9A-F]{8}$/);
    expect(code).toHaveLength(12);
  });

  it("es determinista: el mismo id produce el mismo código", () => {
    const id = "9a8b7c6d-1111-2222-3333-444455556666";
    expect(referralCode(id)).toBe(referralCode(id));
  });

  it("normaliza a mayúsculas aunque el UUID venga en minúsculas", () => {
    expect(referralCode("deadbeef-0000-0000-0000-000000000000")).toBe("REF-DEADBEEF");
  });
});

describe("normalizeRedeemCode — canje en tienda", () => {
  it("quita espacios alrededor y pasa a mayúsculas", () => {
    expect(normalizeRedeemCode("  biz-1a2b ")).toBe("BIZ-1A2B");
  });

  it("deja igual un código ya normalizado", () => {
    expect(normalizeRedeemCode("BIZ-1A2B")).toBe("BIZ-1A2B");
  });

  it("una cadena de solo espacios queda vacía (se rechaza en el submit)", () => {
    expect(normalizeRedeemCode("   ")).toBe("");
  });
});
