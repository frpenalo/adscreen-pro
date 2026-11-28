import { describe, it, expect } from "vitest";
import { qrValueForAd } from "./qr-target";

// El QR de un producto decide dos cosas: si el escaneo se cuenta y si la venta
// le llega al partner correcto. Si deja de pasar por /r/, se pierden los
// escaneos; si /r/ lleva un id equivocado, se le atribuye a otra pantalla.

const ORIGIN = "https://adscreenpro.com";
const product = {
  id: "ad-1",
  qr_url: "https://regalove.co/products/taza-mama?ref=abc123",
  metadata: { shopify_handle: "taza-mama", ref_code: "abc123" },
};

describe("qrValueForAd — destino del QR en pantalla", () => {
  it("un producto pasa por el contador de escaneos con su anuncio y su pantalla", () => {
    expect(qrValueForAd(product, "screen-9", ORIGIN)).toBe("https://adscreenpro.com/r/ad-1/screen-9");
  });

  it("sin pantalla conocida conserva el enlace directo a la tienda", () => {
    expect(qrValueForAd(product, null, ORIGIN)).toBe(product.qr_url);
    expect(qrValueForAd(product, "", ORIGIN)).toBe(product.qr_url);
  });

  it("un anuncio que no es producto conserva su qr_url tal cual", () => {
    const ad = { id: "ad-2", qr_url: "https://adscreenpro.com/register?role=advertiser&ref=REF-1", metadata: null };
    expect(qrValueForAd(ad, "screen-9", ORIGIN)).toBe(ad.qr_url);
  });

  it("sin qr_url no se dibuja QR", () => {
    expect(qrValueForAd({ id: "ad-3", qr_url: null, metadata: { shopify_handle: "x" } }, "screen-9", ORIGIN)).toBeNull();
    expect(qrValueForAd({ id: "ad-4" }, "screen-9", ORIGIN)).toBeNull();
  });
});
