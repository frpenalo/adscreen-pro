// ── Códigos de referido y canje ──────────────────────────────────────────────
// Lógica pura de formato de códigos, centralizada para que generación y
// validación NUNCA diverjan. El código de referido (REF-XXXXXXXX) atribuye un
// alta de advertiser al partner correcto → si el formato se desincroniza, el
// partner pierde su comisión. Por eso tiene tests (codes.test.ts).

// Deriva el código de referido de un partner a partir de su UUID: los primeros
// 8 caracteres en mayúsculas, con prefijo REF-. Esta es la ÚNICA fuente de
// verdad del formato; tanto la generación del QR como cualquier lookup deben
// pasar por aquí.
export function referralCode(partnerId: string): string {
  return `REF-${partnerId.slice(0, 8).toUpperCase()}`;
}

// Normaliza lo que el barbero/cajero teclea al canjear un cupón: quita espacios
// alrededor y pasa a mayúsculas, para que "  biz-1a2b " case con "BIZ-1A2B".
export function normalizeRedeemCode(input: string): string {
  return input.trim().toUpperCase();
}
