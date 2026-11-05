/**
 * QR position picker — admin clicks anywhere on the product creative to
 * place the QR and adjusts size with a slider.
 *
 * Two exports:
 *   - QrPickerContent : the picker UI alone (preview + slider). Use this
 *                       inline inside an existing Dialog (e.g. the create-
 *                       product wizard's step 3).
 *   - QrPositionPicker (default) : the same UI wrapped in its own Dialog
 *                       with Cancel/Save buttons. Use this for standalone
 *                       edit flows (e.g. the "QR" button on product rows).
 *
 * Coordinates convention matches the `products` table:
 *   x, y       — center of QR, fraction [0,1] of media dimensions
 *   sizePct    — QR side length as fraction of media's SHORTER dimension
 */
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export interface QrPosition {
  x: number;       // 0..1, center
  y: number;       // 0..1, center
  sizePct: number; // 0.05..0.25
}

export const DEFAULT_QR_POSITION: QrPosition = { x: 0.88, y: 0.88, sizePct: 0.12 };
const MIN_SIZE = 0.05;
const MAX_SIZE = 0.25;

interface ContentProps {
  mediaUrl: string;
  mediaType: "image" | "video";
  position: QrPosition;
  onChange: (pos: QrPosition) => void;
}

/**
 * Just the preview + slider — no Dialog wrap, no Cancel/Save buttons. The
 * caller owns position state and decides when to commit.
 */
export function QrPickerContent({ mediaUrl, mediaType, position, onChange }: ContentProps) {
  const [box, setBox] = useState<{ w: number; h: number; left: number; top: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  const compute = () => {
    const wrap = wrapperRef.current;
    if (!wrap || !natural) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (!cw || !ch) return;
    const scale = Math.min(cw / natural.w, ch / natural.h);
    const w = natural.w * scale;
    const h = natural.h * scale;
    setBox({ w, h, left: (cw - w) / 2, top: (ch - h) / 2 });
  };

  useEffect(() => {
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural]);

  const onMediaLoad = () => {
    const el = mediaRef.current;
    if (!el) return;
    const w = (el as HTMLImageElement).naturalWidth || (el as HTMLVideoElement).videoWidth || 0;
    const h = (el as HTMLImageElement).naturalHeight || (el as HTMLVideoElement).videoHeight || 0;
    if (w && h) setNatural({ w, h });
  };

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!box) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - box.left;
    const py = e.clientY - rect.top - box.top;
    if (px < 0 || py < 0 || px > box.w || py > box.h) return;
    onChange({ ...position, x: clamp(px / box.w, 0, 1), y: clamp(py / box.h, 0, 1) });
  };

  const qrSidePx = box ? position.sizePct * Math.min(box.w, box.h) : 0;
  const qrLeft = box ? box.left + position.x * box.w - qrSidePx / 2 : 0;
  const qrTop = box ? box.top + position.y * box.h - qrSidePx / 2 : 0;

  return (
    <div className="space-y-4">
      <div
        ref={wrapperRef}
        onClick={handleClick}
        className="relative w-full bg-black rounded-md overflow-hidden cursor-crosshair select-none"
        style={{ aspectRatio: "16/9" }}
      >
        {mediaType === "image" ? (
          <img
            ref={(el) => { mediaRef.current = el; }}
            src={mediaUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
            onLoad={onMediaLoad}
          />
        ) : (
          <video
            ref={(el) => { mediaRef.current = el; }}
            src={mediaUrl}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            muted
            playsInline
            autoPlay
            loop
            onLoadedMetadata={onMediaLoad}
          />
        )}

        {box && qrSidePx > 0 && (
          <div
            className="absolute bg-white rounded shadow-lg pointer-events-none flex items-center justify-center"
            style={{
              left: qrLeft,
              top: qrTop,
              width: qrSidePx,
              height: qrSidePx,
              padding: Math.max(2, qrSidePx * 0.06),
            }}
          >
            <QRCodeSVG
              value="https://adscreenpro.com/r/preview/preview"
              size={Math.max(16, qrSidePx * 0.88)}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tamaño del QR</Label>
          <span className="text-sm text-muted-foreground tabular-nums">
            {(position.sizePct * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          min={MIN_SIZE * 100}
          max={MAX_SIZE * 100}
          step={1}
          value={[position.sizePct * 100]}
          onValueChange={(v) => onChange({ ...position, sizePct: v[0] / 100 })}
        />
        <p className="text-xs text-muted-foreground">
          Posición: x={(position.x * 100).toFixed(0)}%, y={(position.y * 100).toFixed(0)}% · Tamaño relativo al lado corto del arte.
        </p>
      </div>
    </div>
  );
}

// ── Dialog-wrapped variant for standalone edit flows ────────────────────────
interface DialogProps {
  open: boolean;
  mediaUrl: string;
  mediaType: "image" | "video";
  initial?: Partial<QrPosition>;
  onSave: (pos: QrPosition) => void;
  onCancel: () => void;
}

export default function QrPositionPicker({ open, mediaUrl, mediaType, initial, onSave, onCancel }: DialogProps) {
  const [pos, setPos] = useState<QrPosition>({
    x: initial?.x ?? DEFAULT_QR_POSITION.x,
    y: initial?.y ?? DEFAULT_QR_POSITION.y,
    sizePct: initial?.sizePct ?? DEFAULT_QR_POSITION.sizePct,
  });

  useEffect(() => {
    if (open) {
      setPos({
        x: initial?.x ?? DEFAULT_QR_POSITION.x,
        y: initial?.y ?? DEFAULT_QR_POSITION.y,
        sizePct: initial?.sizePct ?? DEFAULT_QR_POSITION.sizePct,
      });
    }
  }, [open, initial?.x, initial?.y, initial?.sizePct]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Colocar QR en el arte</DialogTitle>
          <DialogDescription>
            Haz clic donde quieres que aparezca el QR. Ajusta el tamaño con el slider.
          </DialogDescription>
        </DialogHeader>

        <QrPickerContent
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          position={pos}
          onChange={setPos}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave(pos)}>Guardar posición</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
