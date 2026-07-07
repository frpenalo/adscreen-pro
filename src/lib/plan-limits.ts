// ── Límite de anuncios por plan ──────────────────────────────────────────────
// Lógica pura del cupo mensual de anuncios del advertiser, extraída de
// CreateAdScreen para poder testearla (protege ingresos: sin esto un plan
// básico crea anuncios ilimitados). El contador real (ads_this_month /
// last_month_reset en la tabla advertisers) lo mantiene un trigger de
// Postgres al insertar ads — ver migración 20260706000001.

export const PLAN_LIMITS: Record<string, { ads: number }> = {
  basico:    { ads: 2 },
  pro:       { ads: 5 },
  unlimited: { ads: 999 },
};

export interface AdsUsageProfile {
  plan?: string | null;
  ads_this_month?: number | null;
  last_month_reset?: string | null;
}

// Postgres devuelve dates como "YYYY-MM-DD". new Date("YYYY-MM-DD") parsea en
// UTC, y al leerlo con getters locales (getMonth) puede retroceder un día en
// husos negativos (EST) — un reset del día 1 se leería como el mes anterior.
// Parseamos los componentes como fecha LOCAL para que el mes sea el correcto.
function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split(/[-T]/);
  return new Date(Number(y), Number(m) - 1, Number(d || 1));
}

// Calcula el uso del cupo mensual. `now` es inyectable para tests.
// Si el último reset fue en un mes anterior, el contador cuenta como 0
// (el trigger lo reseteará en el próximo insert).
export function computeAdsUsage(
  profile: AdsUsageProfile | null | undefined,
  now: Date = new Date(),
): { plan: string; limit: number; used: number; remaining: number } {
  const plan = profile?.plan && PLAN_LIMITS[profile.plan] ? profile.plan : "basico";
  const limit = PLAN_LIMITS[plan].ads;
  const lastReset = parseDateLocal(profile?.last_month_reset || "2000-01-01");
  const isNewMonth =
    lastReset.getFullYear() < now.getFullYear() ||
    (lastReset.getFullYear() === now.getFullYear() &&
      lastReset.getMonth() < now.getMonth());
  const used = isNewMonth ? 0 : Math.max(0, profile?.ads_this_month ?? 0);
  return { plan, limit, used, remaining: Math.max(0, limit - used) };
}
