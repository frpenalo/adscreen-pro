// ── Lógica pura de los reportes del advertiser ───────────────────────────────
// Extraída de ReportsScreen para poder testearla en aislamiento. Son los
// cálculos que el advertiser ve en su PDF mensual (impresiones, desglose por
// pantalla, cupones), así que conviene blindarlos: una cifra mal calculada
// erosiona la confianza del cliente. Ver report-utils.test.ts.

export interface MonthOption {
  key: string; // "2026-06"
  label: string; // "junio de 2026"
  start: string; // ISO, inclusive
  end: string; // ISO, exclusive (primer día del mes siguiente)
}

// Genera las opciones de los últimos `count` meses (incluido el del `now`),
// del más reciente al más viejo. `now` es inyectable para poder testear sin
// depender de la fecha real del sistema.
export function lastMonths(count: number, now: Date = new Date()): MonthOption[] {
  const out: MonthOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-US", { month: "long", year: "numeric" }),
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }
  return out;
}

export interface ScreenImpressions {
  screenId: string;
  impressions: number;
}

// Cuenta impresiones por pantalla a partir de la lista de location_id de cada
// log (una entrada por impresión). Devuelve el desglose ordenado de mayor a
// menor. Los logs sin pantalla caen en "—".
export function aggregateByScreen(
  locationIds: Array<string | null | undefined>,
): ScreenImpressions[] {
  const screenMap = new Map<string, number>();
  for (const sid of locationIds) {
    const key = sid ?? "—";
    screenMap.set(key, (screenMap.get(key) ?? 0) + 1);
  }
  return [...screenMap.entries()]
    .map(([screenId, impressions]) => ({ screenId, impressions }))
    .sort((a, b) => b.impressions - a.impressions);
}

// Cuenta cupones reclamados vs. canjeados. Un claim cuenta como canjeado solo
// si tiene `redeemed_at` (timestamp de canje en tienda).
export function tallyCoupons(
  claims: Array<{ redeemed_at?: unknown }>,
): { claimed: number; redeemed: number } {
  let claimed = 0;
  let redeemed = 0;
  for (const c of claims) {
    claimed++;
    if (c.redeemed_at) redeemed++;
  }
  return { claimed, redeemed };
}
