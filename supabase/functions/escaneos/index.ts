/**
 * escaneos — Reporte de solo lectura de escaneos de QR de productos, para que
 * el proyecto Regalove los cruce con sus pedidos de Shopify.
 *
 * GET /functions/v1/escaneos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 * Cabecera: Authorization: Bearer {ADSCREEN_ESCANEOS_TOKEN}
 *
 * Devuelve una fila por día (hora del Este), producto y pantalla. No hay datos
 * personales: ad_clicks no guarda nada de quien escanea.
 *
 * El token es un secreto propio (ADSCREEN_ESCANEOS_TOKEN) que solo sirve para
 * esta función; no es un JWT de Supabase, por eso se despliega con
 * --no-verify-jwt y la verificación se hace aquí. Sin secreto configurado la
 * función rechaza todo.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_DIAS = 92;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Comparación en tiempo constante: no revela cuántos caracteres coinciden.
function mismoSecreto(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i % (eb.length || 1)];
  return diff === 0;
}

function fechaValida(s: string | null): s is string {
  if (!s || !FECHA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return json(405, { error: "Método no permitido" });

  const secreto = Deno.env.get("ADSCREEN_ESCANEOS_TOKEN");
  if (!secreto) {
    console.error("ADSCREEN_ESCANEOS_TOKEN no configurado; se rechaza la petición");
    return json(503, { error: "Reporte no configurado" });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !mismoSecreto(token, secreto)) {
    return json(401, { error: "No autorizado" });
  }

  const url = new URL(req.url);
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  if (!fechaValida(desde) || !fechaValida(hasta)) {
    return json(400, { error: "Parámetros desde y hasta obligatorios, formato AAAA-MM-DD" });
  }
  if (desde > hasta) {
    return json(400, { error: "desde no puede ser posterior a hasta" });
  }
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  if (dias > MAX_DIAS) {
    return json(400, { error: `El rango máximo es de ${MAX_DIAS} días` });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase.rpc("escaneos_por_dia", { p_desde: desde, p_hasta: hasta });
  if (error) {
    console.error("escaneos_por_dia falló:", error.message);
    return json(500, { error: "No se pudo leer el reporte" });
  }

  return json(200, { desde, hasta, filas: data ?? [] });
});
