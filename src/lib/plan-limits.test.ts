import { describe, it, expect } from "vitest";
import { computeAdsUsage, PLAN_LIMITS } from "./plan-limits";

// Este cupo protege ingresos: cada plan paga por N anuncios al mes. Antes de
// este módulo el contador nunca se incrementaba (las columnas no existían) y
// el límite era decorativo. Estos tests fijan el contrato del cálculo.

const JUL = new Date(2026, 6, 15); // 15 jul 2026

describe("computeAdsUsage — plan y límite", () => {
  it("sin perfil o sin columnas, cae al plan basico con 0 usados", () => {
    expect(computeAdsUsage(null, JUL)).toEqual({
      plan: "basico", limit: 2, used: 0, remaining: 2,
    });
    expect(computeAdsUsage({}, JUL).remaining).toBe(2);
  });

  it("respeta el límite de cada plan", () => {
    expect(computeAdsUsage({ plan: "pro" }, JUL).limit).toBe(PLAN_LIMITS.pro.ads);
    expect(computeAdsUsage({ plan: "unlimited" }, JUL).limit).toBe(999);
  });

  it("un plan desconocido cae a basico (no explota ni regala ilimitado)", () => {
    expect(computeAdsUsage({ plan: "premium-inventado" }, JUL).limit).toBe(2);
  });
});

describe("computeAdsUsage — conteo del mes", () => {
  it("cuenta los usados cuando el reset es del mes en curso", () => {
    const r = computeAdsUsage(
      { ads_this_month: 2, last_month_reset: "2026-07-03" }, JUL,
    );
    expect(r.used).toBe(2);
    expect(r.remaining).toBe(0);
  });

  it("resetea a 0 cuando el último reset fue un mes anterior", () => {
    const r = computeAdsUsage(
      { ads_this_month: 2, last_month_reset: "2026-06-20" }, JUL,
    );
    expect(r.used).toBe(0);
    expect(r.remaining).toBe(2);
  });

  it("resetea cruzando el año (dic → ene)", () => {
    const ene = new Date(2027, 0, 5);
    const r = computeAdsUsage(
      { ads_this_month: 2, last_month_reset: "2026-12-28" }, ene,
    );
    expect(r.used).toBe(0);
  });

  it("NO resetea el día 1 del mes por desfase UTC (fecha parseada local)", () => {
    // new Date("2026-07-01") en UTC-5 caería al 30 de junio con getters
    // locales → parecería mes viejo y regalaría cupo. Verificamos que el
    // parseo local lo evita: reset del 1 de julio, hoy 1 de julio → mismo mes.
    const jul1 = new Date(2026, 6, 1, 8, 0, 0);
    const r = computeAdsUsage(
      { ads_this_month: 1, last_month_reset: "2026-07-01" }, jul1,
    );
    expect(r.used).toBe(1);
  });

  it("remaining nunca es negativo", () => {
    const r = computeAdsUsage(
      { ads_this_month: 99, last_month_reset: "2026-07-01" }, JUL,
    );
    expect(r.remaining).toBe(0);
  });
});
