import { useState, useEffect } from "react";
import { ClockBackground } from "./ClockBackground";

export default function ClockWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background dinámico según hora del día actual */}
      <ClockBackground hour={now.getHours()} />

      {/* Contenido centrado: hora + fecha */}
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-6">
        <div
          className="text-white font-extralight tracking-widest"
          style={{
            fontSize: "14vw",
            lineHeight: 1,
            textShadow: "0 4px 30px rgba(0,0,0,0.7), 0 0 60px rgba(0,0,0,0.4)",
          }}
        >
          {time}
        </div>
        <div
          className="text-white/90 uppercase tracking-[0.3em]"
          style={{
            fontSize: "2.5vw",
            textShadow: "0 2px 16px rgba(0,0,0,0.8)",
          }}
        >
          {date}
        </div>
      </div>

      <div
        className="absolute bottom-4 right-4 text-white/40 text-xs tracking-widest uppercase"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
      >
        AdScreenPro
      </div>
    </div>
  );
}
