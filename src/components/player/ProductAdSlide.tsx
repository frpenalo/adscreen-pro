import { QRCodeSVG } from "qrcode.react";

interface ProductAdSlideProps {
  imageUrl: string | null;
  title: string;
  price: string;
  qrUrl: string;
}

export default function ProductAdSlide({ imageUrl, title, price, qrUrl }: ProductAdSlideProps) {
  const formattedPrice = (() => {
    const num = parseFloat(price);
    if (isNaN(num)) return `$${price}`;
    return `$${num.toFixed(2)}`;
  })();

  return (
    <div
      className="fixed inset-0 flex"
      style={{ backgroundColor: "#080808" }}
    >
      {/* Left half — product info */}
      <div
        className="flex flex-col justify-center"
        style={{ width: "50%", padding: "80px" }}
      >
        {/* Product image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            draggable={false}
            style={{
              maxHeight: "500px",
              maxWidth: "100%",
              objectFit: "contain",
              marginBottom: "48px",
              alignSelf: "flex-start",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              height: "400px",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              marginBottom: "48px",
            }}
          />
        )}

        {/* Product title */}
        <h1
          style={{
            color: "#ffffff",
            fontSize: "64px",
            fontWeight: 700,
            lineHeight: 1.1,
            margin: 0,
            marginBottom: "24px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>

        {/* Gold accent line */}
        <div
          style={{
            width: "80px",
            height: "2px",
            backgroundColor: "#C9A84C",
            marginBottom: "24px",
          }}
        />

        {/* Price */}
        <p
          style={{
            color: "#C9A84C",
            fontSize: "48px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {formattedPrice}
        </p>
      </div>

      {/* Right half — QR code */}
      <div
        className="flex flex-col items-center justify-center"
        style={{ width: "50%" }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <QRCodeSVG
            value={qrUrl || "https://adscreenpro.com"}
            size={320}
            level="M"
            includeMargin={false}
          />
          <p
            style={{
              color: "#C9A84C",
              fontSize: "20px",
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Escanea para comprar
          </p>
        </div>
      </div>

      {/* AdScreenPro watermark */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          bottom: "12px",
          right: "16px",
          color: "rgba(255,255,255,0.08)",
          fontSize: "12px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        AdScreenPro
      </div>
    </div>
  );
}
