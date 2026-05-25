import { useEffect } from "react";

/**
 * Mantiene la pantalla del TV/kiosko despierta mientras el componente
 * que la consume esté montado.
 *
 * Usa la Wake Lock API nativa, soportada en Chromium 84+ (lo que
 * cubre Onn stick, TCL Google TV, Fully Kiosk Browser reciente y
 * cualquier WebView Android 9+).
 *
 * Re-adquiere el lock automáticamente en:
 *   - `visibilitychange` cuando el TV vuelve a primer plano
 *   - `pageshow` (bfcache restore — algunos browsers no disparan
 *     visibilitychange al volver del cache)
 *   - Primer click/touch/keydown del usuario. Algunos browsers
 *     rechazan la primera llamada cuando no hay user activation.
 *     Si hay interacción reintentamos.
 *
 * Loggea cada estado a consola con prefijo `[WakeLock]` para poder
 * depurar el TV remoto via screen-share o Fully Kiosk Remote Admin.
 *
 * NOTA OPERATIVA: En sticks Android viejos sin Wake Lock API, este
 * hook es no-op. Para esos casos el dueño del partner debe activar
 * "Keep Screen On" en los settings del kiosko (Fully Kiosk: Settings
 * → Web Browsing → Keep Screen On). Es la garantía a nivel OS.
 */
export function useWakeLock() {
  useEffect(() => {
    type WakeLockLike = {
      released?: boolean;
      release: () => Promise<void>;
      addEventListener: (type: "release", cb: () => void) => void;
    };
    type NavigatorWithLock = Navigator & {
      wakeLock?: { request: (kind: "screen") => Promise<WakeLockLike> };
    };

    let sentinel: WakeLockLike | null = null;
    let cancelled = false;
    const log = (msg: string, ...rest: unknown[]) =>
      console.log(`[WakeLock] ${msg}`, ...rest);

    const nav = navigator as NavigatorWithLock;
    if (!nav.wakeLock) {
      log("Wake Lock API no disponible — confiar en 'Keep Screen On' del kiosko");
      return;
    }

    const requestLock = async () => {
      if (cancelled) return;
      // Si el sentinel sigue vivo, no pedimos otro.
      if (sentinel && sentinel.released === false) return;

      try {
        sentinel = await nav.wakeLock!.request("screen");
        log("lock adquirido");
        sentinel.addEventListener("release", () => {
          log("lock liberado por el sistema");
          sentinel = null;
        });
      } catch (err) {
        // Casos típicos:
        //   - NotAllowedError: sin user activation o page no visible
        //   - SecurityError: bloqueado por Permissions-Policy
        // No es fatal — el listener de interacción de abajo
        // reintentará tras el primer touch/click/keydown.
        log("request rechazado (reintentará en próxima interacción)", err);
      }
    };

    requestLock();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        log("visibilitychange → visible, reintento");
        requestLock();
      }
    };
    const onPageShow = () => {
      log("pageshow, reintento");
      requestLock();
    };
    const onFirstInteraction = () => {
      log("primera interacción detectada, reintento");
      requestLock();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    // `once: true` → cada listener se auto-remueve al primer disparo.
    // No necesitamos seguir escuchando una vez que conseguimos el lock.
    window.addEventListener("click", onFirstInteraction, { once: true });
    window.addEventListener("touchstart", onFirstInteraction, { once: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("click", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      if (sentinel) {
        sentinel.release().catch((err) => log("release error", err));
        sentinel = null;
      }
    };
  }, []);
}
