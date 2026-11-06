// Plan que el anunciante eligió antes de registrarse. Hoy solo existe un plan
// alterno: el paquete Raleigh 360 (pantallas + Kultura Radio), que llega desde
// kulturaradio.com con ?plan=raleigh360&ref=<ref de Kultura>. Sin plan, el
// anunciante paga el plan normal de pantallas.

export type CheckoutPlan = "raleigh360";

export const RALEIGH360_PRICE_USD = 99;
export const SCREENS_PRICE_USD = 79;

export function parsePlan(value: unknown): CheckoutPlan | null {
  return value === "raleigh360" ? "raleigh360" : null;
}

// Stripe solo acepta letras, números, guion y guion bajo (máx. 200) en
// client_reference_id; cualquier otra cosa hace fallar la sesión completa.
export function sanitizeKulturaRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[A-Za-z0-9_-]{1,200}$/.test(value) ? value : null;
}

export function planPriceUsd(plan: CheckoutPlan | null): number {
  return plan === "raleigh360" ? RALEIGH360_PRICE_USD : SCREENS_PRICE_USD;
}
