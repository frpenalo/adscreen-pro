import { useState, useEffect } from "react";

const WMO: Record<number, { icon: string; label: string }> = {
  0:  { icon: "☀️", label: "Despejado" },
  1:  { icon: "🌤️", label: "Mayormente despejado" },
  2:  { icon: "⛅", label: "Parcialmente nublado" },
  3:  { icon: "☁️", label: "Nublado" },
  45: { icon: "🌫️", label: "Neblina" },
  48: { icon: "🌫️", label: "Neblina helada" },
  51: { icon: "🌦️", label: "Llovizna ligera" },
  53: { icon: "🌦️", label: "Llovizna" },
  61: { icon: "🌧️", label: "Lluvia ligera" },
  63: { icon: "🌧️", label: "Lluvia" },
  65: { icon: "🌧️", label: "Lluvia fuerte" },
  71: { icon: "🌨️", label: "Nieve ligera" },
  73: { icon: "🌨️", label: "Nieve" },
  80: { icon: "🌦️", label: "Chubascos" },
  95: { icon: "⛈️", label: "Tormenta eléctrica" },
};

const LAT = 35.7796;
const LON = -78.6382;

interface WeatherData {
  currentTemp: number;
  currentCode: number;
  tomorrowMaxTemp: number;
  tomorrowMinTemp: number;
  tomorrowCode: number;
}

function pick(arr: string[], seed: number): string {
  return arr[seed % arr.length];
}

function getMessage(w: WeatherData, seed: number): string {
  const { currentTemp, currentCode } = w;

  const isRainyCode = (c: number) => [51, 53, 61, 63, 65, 80, 95].includes(c);
  const isStormCode  = (c: number) => c === 95;
  const isSunnyCode  = (c: number) => [0, 1].includes(c);

  if (isStormCode(currentCode)) return pick([
    "¡Hay tormenta eléctrica afuera! Mejor quedarse aquí adentro cómodo ⛈️",
    "Con esta tormenta, lo mejor es esperar aquí tranquilo ⛈️",
    "Truenos y relámpagos en Raleigh — tú estás en el lugar correcto 😌",
  ], seed);

  if (isRainyCode(currentCode)) return pick([
    "Está lloviendo en Raleigh — buen momento para el corte de cabello 💈",
    "Lluvia afuera, estilo adentro — aprovecha y arréglate 💈",
    "Con esta lluvia, quedarse aquí un rato más no suena mal ☂️",
    "Día de lluvia en Raleigh — perfecto para renovar el look 💈",
  ], seed);

  if (currentTemp >= 95) return pick([
    `¡Hace un calor de los diablos afuera! Aquí adentro con AC sí se está bien 😅`,
    `Afuera está ardiendo — aquí adentro sí se respira rico 😎`,
    `Con este calor, la barbería es el mejor plan del día 💈`,
  ], seed);

  if (currentTemp >= 85) return pick([
    `Hace calor hoy — ¡menos mal que aquí hay AC! 😎`,
    `Día caliente en Raleigh — buena excusa para entrar y refrescarse 🌬️`,
    `El sol está pegando duro hoy — aquí adentro sí se está bien 😌`,
  ], seed);

  if (currentTemp <= 32) return pick([
    `¡Está helando afuera! Aquí adentro sí se está bien 🔥`,
    `Cuidado con el hielo en las calles de Raleigh — maneja despacio 🧊`,
    `Temperatura bajo cero afuera — aquí adentro calientito 🔥`,
  ], seed);

  if (currentTemp <= 45) return pick([
    `Hace frío en Raleigh — buena excusa para quedarse aquí un rato 🧥`,
    `Fresquito de verdad hoy — abrígate bien al salir 🧣`,
    `Con este frío, un buen corte y pa' la casa con café ☕`,
  ], seed);

  if (currentTemp <= 55) return pick([
    `Fresquito hoy — no olvides la chaqueta al salir 🍃`,
    `Temperatura agradable pero trae algo de abrigo 🍂`,
    `Día fresco en Raleigh — perfecto para salir con estilo 😎`,
  ], seed);

  if (isSunnyCode(currentCode) && currentTemp >= 65 && currentTemp <= 82) return pick([
    `Día perfecto en Raleigh — cielo despejado y temperatura ideal ☀️`,
    `¡Qué día más bonito en Raleigh! Disfrútalo al salir 🌤️`,
    `Clima increíble hoy — el mejor día para lucir el corte nuevo 💈`,
    `Sol y temperatura ideal — Raleigh está de lujo hoy ☀️`,
  ], seed);

  return pick([
    `${WMO[currentCode]?.label ?? "Buen clima"} en Raleigh hoy — disfruta el día`,
    `Clima de Raleigh siendo Raleigh — siempre con sorpresas 🌦️`,
    `Un día más en la ciudad más chévere de Carolina del Norte 🙌`,
  ], seed);
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100));

  // Rotate message every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setSeed((s) => s + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const WEATHER_URL =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LON}` +
      `&current_weather=true` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=fahrenheit` +
      `&timezone=America%2FNew_York` +
      `&forecast_days=2`;

    const load = () =>
      fetch(WEATHER_URL)
        .then((r) => r.json())
        .then((d) => {
          setWeather({
            currentTemp: Math.round(d.current_weather.temperature),
            currentCode: d.current_weather.weathercode,
            tomorrowCode:    d.daily.weathercode[1],
            tomorrowMaxTemp: Math.round(d.daily.temperature_2m_max[1]),
            tomorrowMinTemp: Math.round(d.daily.temperature_2m_min[1]),
          });
          setError(false);
        })
        .catch(() => setError(true));

    load();

    // Refresh every 10 min normally; if error, retry every 30s
    let id = setInterval(load, 10 * 60 * 1000);

    const retryId = setInterval(() => {
      if (error) {
        clearInterval(id);
        load().then(() => {
          id = setInterval(load, 10 * 60 * 1000);
        });
      }
    }, 30000);

    return () => { clearInterval(id); clearInterval(retryId); };
  }, []);

  const info = weather ? (WMO[weather.currentCode] ?? { icon: "🌡️", label: "" }) : null;
  const message = weather ? getMessage(weather, seed) : null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-16"
      style={{ background: "linear-gradient(135deg, #0c4a6e 0%, #075985 100%)" }}
    >
      {!weather && !error && (
        <div className="text-white/40 text-2xl tracking-widest animate-pulse uppercase">
          Cargando...
        </div>
      )}

      {error && (
        <div className="text-white/40 text-2xl tracking-widest uppercase">
          ☁️ Clima no disponible
        </div>
      )}

      {weather && info && message && (
        <>
          {/* Today's weather — top, prominent */}
          <div className="flex items-center gap-6">
            <span style={{ fontSize: "6vw" }}>{info.icon}</span>
            <span
              className="text-white font-extralight tabular-nums"
              style={{ fontSize: "7vw", lineHeight: 1 }}
            >
              {weather.currentTemp}°F
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-white/70 tracking-widest uppercase" style={{ fontSize: "1.6vw" }}>
                {info.label}
              </span>
              <span className="text-white/30 tracking-widest uppercase" style={{ fontSize: "1.2vw" }}>
                Raleigh, NC
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-24 border-t border-white/20" />

          {/* Funny message about today */}
          <p
            className="text-white font-light leading-snug text-center max-w-4xl"
            style={{ fontSize: "3.2vw" }}
          >
            {message}
          </p>

          {/* Tomorrow preview — small, at bottom */}
          <div className="flex items-center gap-2 text-white/25" style={{ fontSize: "1.4vw" }}>
            <span>Mañana:</span>
            <span>{WMO[weather.tomorrowCode]?.icon}</span>
            <span>{weather.tomorrowMinTemp}° – {weather.tomorrowMaxTemp}°F</span>
          </div>
        </>
      )}

      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>
    </div>
  );
}
