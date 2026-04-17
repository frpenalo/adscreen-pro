import { useState, useEffect } from "react";

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
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)" }}>
      <div className="text-white font-extralight tracking-widest" style={{ fontSize: "14vw" }}>
        {time}
      </div>
      <div className="text-white/50 uppercase tracking-[0.3em]" style={{ fontSize: "2.5vw" }}>
        {date}
      </div>
      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>
    </div>
  );
}
