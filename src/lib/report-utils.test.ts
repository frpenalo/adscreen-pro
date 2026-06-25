import { describe, it, expect } from "vitest";
import { lastMonths, aggregateByScreen, tallyCoupons } from "./report-utils";

// Estos cálculos alimentan el PDF que el advertiser descarga. Una cifra mal
// contada o un mes mal recortado erosiona la confianza del cliente, así que
// los blindamos — sobre todo la lógica de fechas, que es donde se esconden los
// bugs (cruces de año, meses de un dígito).

describe("lastMonths — opciones de meses para el reporte", () => {
  it("devuelve la cantidad pedida, del más reciente al más viejo", () => {
    const now = new Date(2026, 5, 15); // 15 jun 2026
    const months = lastMonths(6, now);
    expect(months).toHaveLength(6);
    expect(months.map((m) => m.key)).toEqual([
      "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01",
    ]);
  });

  it("cruza correctamente el cambio de año hacia atrás", () => {
    const now = new Date(2026, 0, 10); // 10 ene 2026
    const months = lastMonths(3, now);
    expect(months.map((m) => m.key)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });

  it("formatea el key con mes de dos dígitos (padStart)", () => {
    expect(lastMonths(1, new Date(2026, 8, 1))[0].key).toBe("2026-09"); // sep
    expect(lastMonths(1, new Date(2026, 11, 1))[0].key).toBe("2026-12"); // dic
  });

  it("el rango [start, end) cubre el mes completo y es contiguo", () => {
    const now = new Date(2026, 5, 15);
    const months = lastMonths(3, now);
    // start = primer día del mes; end = primer día del mes siguiente
    expect(months[0].start).toBe(new Date(2026, 5, 1).toISOString());
    expect(months[0].end).toBe(new Date(2026, 6, 1).toISOString());
    // contiguo: el end del mes anterior (más viejo) es el start del siguiente
    expect(months[1].end).toBe(months[0].start);
    expect(new Date(months[0].start).getTime()).toBeLessThan(
      new Date(months[0].end).getTime(),
    );
  });

  it("cada mes trae una etiqueta legible no vacía", () => {
    const months = lastMonths(2, new Date(2026, 5, 15));
    months.forEach((m) => expect(m.label.length).toBeGreaterThan(0));
  });
});

describe("aggregateByScreen — impresiones por pantalla", () => {
  it("cuenta por pantalla y ordena de mayor a menor", () => {
    const result = aggregateByScreen(["tv-a", "tv-b", "tv-a", "tv-a", "tv-b"]);
    expect(result).toEqual([
      { screenId: "tv-a", impressions: 3 },
      { screenId: "tv-b", impressions: 2 },
    ]);
  });

  it("agrupa los logs sin pantalla bajo '—'", () => {
    const result = aggregateByScreen(["tv-a", null, undefined, "tv-a"]);
    expect(result).toContainEqual({ screenId: "tv-a", impressions: 2 });
    expect(result).toContainEqual({ screenId: "—", impressions: 2 });
  });

  it("devuelve lista vacía sin logs", () => {
    expect(aggregateByScreen([])).toEqual([]);
  });

  it("el total de impresiones coincide con la cantidad de logs", () => {
    const logs = ["a", "b", "a", null, "c"];
    const total = aggregateByScreen(logs).reduce((s, r) => s + r.impressions, 0);
    expect(total).toBe(logs.length);
  });
});

describe("tallyCoupons — reclamados vs canjeados", () => {
  it("cuenta todos como reclamados y solo los que tienen redeemed_at como canjeados", () => {
    const claims = [
      { redeemed_at: "2026-06-01T10:00:00Z" },
      { redeemed_at: null },
      { redeemed_at: undefined },
      { redeemed_at: "2026-06-02T11:00:00Z" },
    ];
    expect(tallyCoupons(claims)).toEqual({ claimed: 4, redeemed: 2 });
  });

  it("sin claims devuelve ceros", () => {
    expect(tallyCoupons([])).toEqual({ claimed: 0, redeemed: 0 });
  });

  it("nunca cuenta más canjeados que reclamados", () => {
    const claims = [{ redeemed_at: "x" }, { redeemed_at: "y" }, { redeemed_at: null }];
    const { claimed, redeemed } = tallyCoupons(claims);
    expect(redeemed).toBeLessThanOrEqual(claimed);
  });
});
