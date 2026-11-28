// Qué dirección codifica el QR que se dibuja sobre un anuncio en pantalla.
//
// Los anuncios de producto guardan en qr_url el enlace directo a la tienda
// (regalove.co/products/{handle}?ref={código}). Si el QR codificara eso, el
// escaneo nunca pasaría por AdScreenPro y no se podría contar. Por eso el QR
// de un producto apunta a /r/:adId/:screenId, que registra el escaneo en
// ad_clicks y redirige a ese mismo enlace (ver AdRedirect).

interface QrAd {
  id: string;
  qr_url?: string | null;
  metadata?: { shopify_handle?: string | null } | null;
}

export function qrValueForAd(ad: QrAd, screenId: string | null | undefined, origin: string): string | null {
  if (!ad.qr_url) return null;
  if (ad.metadata?.shopify_handle && screenId) {
    return `${origin}/r/${ad.id}/${screenId}`;
  }
  return ad.qr_url;
}
