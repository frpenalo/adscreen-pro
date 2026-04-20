import { useState, useEffect } from "react";

// Latino-relevant team IDs per sport
const MLB_PRIORITY = new Set(["10","19","21","18","16","24","2","28","22","27"]);
// Yankees, Dodgers, Mets, Astros, Cubs, Cardinals, Red Sox, Marlins, Phillies, Padres
const NBA_PRIORITY = new Set(["13","14","18","24","7","2","6","10","5","20"]);
// Lakers, Heat, Knicks, Spurs, Nuggets, Celtics, Mavericks, Rockets, Clippers, Timberwolves
const HURRICANES_ID = "12";

interface TeamSide {
  abbr: string;
  logo?: string;
  score: number;
}

interface GameCard {
  home: TeamSide;
  away: TeamSide;
  status: "live" | "final" | "upcoming";
  detail: string;
}

interface Slide {
  sport: string;
  icon: string;
  games: GameCard[];
}

interface LeagueCounts {
  LMX: number;
  MLS: number;
  LAL: number;
  MLB: number;
  NBA: number;
  NFL: number;
  NHL: number;
}

function toScore(val: any): number {
  if (val == null) return 0;
  if (typeof val === "object") return Number(val.value ?? val.displayValue ?? 0);
  return Number(val) || 0;
}

function getLogo(team: any): string | undefined {
  return team?.logo ?? team?.logos?.[0]?.href;
}

function parseGame(event: any): GameCard {
  const comp = event.competitions?.[0];
  const competitors: any[] = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const statusType = comp?.status?.type;

  return {
    home: { abbr: home?.team?.abbreviation ?? "", logo: getLogo(home?.team), score: toScore(home?.score) },
    away: { abbr: away?.team?.abbreviation ?? "", logo: getLogo(away?.team), score: toScore(away?.score) },
    status: statusType?.state === "in" ? "live" : statusType?.completed ? "final" : "upcoming",
    detail: statusType?.shortDetail ?? "",
  };
}

function hasPriorityTeam(event: any, priority: Set<string>): boolean {
  const competitors: any[] = event.competitions?.[0]?.competitors ?? [];
  return competitors.some((c) => priority.has(String(c.team?.id)));
}

function priorityScore(event: any, priority: Set<string>): number {
  const competitors: any[] = event.competitions?.[0]?.competitors ?? [];
  const count = competitors.filter((c) => priority.has(String(c.team?.id))).length;
  const isLive = event.competitions?.[0]?.status?.type?.state === "in";
  return (isLive ? 10 : 0) + count;
}

async function fetchScoreboard(sport: string, league: string): Promise<any[]> {
  try {
    // Cache-bust so the TV/CDN doesn't keep returning stale data
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?_t=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events: any[] = data.events ?? [];
    // Dedupe by event id — ESPN occasionally returns duplicates
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const e of events) {
      const id = String(e.id ?? `${e.date}-${e.name}`);
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push(e);
    }
    return unique;
  } catch {
    return [];
  }
}

function isValidGame(g: GameCard): boolean {
  return (g.home.abbr !== "" || !!g.home.logo) && (g.away.abbr !== "" || !!g.away.logo);
}

function sortBySport(events: any[], priority: Set<string>): any[] {
  return [...events].sort((a, b) => priorityScore(b, priority) - priorityScore(a, priority));
}

// Interleave multiple sport arrays in round-robin so each league shows
// one game per cycle: [LigaMX1, MLS1, MLB1, NBA1, LigaMX2, MLS2, ...]
// Empty leagues are skipped automatically.
function interleave<T>(groups: T[][]): T[] {
  const result: T[] = [];
  const maxLen = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.length) result.push(g[i]);
    }
  }
  return result;
}

// Last breakdown of games per league (updated by buildSlides). Rendered
// as a small diagnostic strip so we can see from the TV without DevTools.
let leagueCounts: LeagueCounts = { LMX: 0, MLS: 0, LAL: 0, MLB: 0, NBA: 0, NFL: 0, NHL: 0 };

async function buildSlides(): Promise<Slide[]> {
  const [
    mlbEvents,
    nbaEvents,
    nhlEvents,
    nflEvents,
    mlsEvents,
    ligaMxEvents,
    laLigaEvents,
  ] = await Promise.all([
    fetchScoreboard("baseball", "mlb"),
    fetchScoreboard("basketball", "nba"),
    fetchScoreboard("hockey", "nhl"),
    fetchScoreboard("football", "nfl"),
    fetchScoreboard("soccer", "usa.1"),     // MLS
    fetchScoreboard("soccer", "mex.1"),     // Liga MX
    fetchScoreboard("soccer", "esp.1"),     // La Liga
  ]);

  console.log(
    "Games today — MLB:", mlbEvents.length,
    "NBA:", nbaEvents.length,
    "NHL:", nhlEvents.length,
    "NFL:", nflEvents.length,
    "MLS:", mlsEvents.length,
    "LigaMX:", ligaMxEvents.length,
    "LaLiga:", laLigaEvents.length,
  );

  // One game per slide. Drop invalid games (no team abbr or logo).
  const makeSlides = (events: any[], sport: string, icon: string, priority?: Set<string>): Slide[] => {
    if (events.length === 0) return [];
    const sorted = priority ? sortBySport(events, priority) : events;
    const games = sorted.map(parseGame).filter(isValidGame);
    return games.map((g) => ({ sport, icon, games: [g] }));
  };

  const mlbSlides = makeSlides(mlbEvents, "MLB", "⚾", MLB_PRIORITY);
  const nbaSlides = makeSlides(nbaEvents, "NBA", "🏀", NBA_PRIORITY);
  const nhlSlides = makeSlides(
    nhlEvents.sort((a: any, b: any) => {
      const aCanes = a.competitions?.[0]?.competitors?.some((c: any) => String(c.team?.id) === HURRICANES_ID) ? 1 : 0;
      const bCanes = b.competitions?.[0]?.competitors?.some((c: any) => String(c.team?.id) === HURRICANES_ID) ? 1 : 0;
      return bCanes - aCanes;
    }),
    "NHL",
    "🏒",
  );
  const nflSlides = makeSlides(nflEvents, "NFL", "🏈");
  const mlsSlides = makeSlides(mlsEvents, "MLS", "⚽");
  const ligaMxSlides = makeSlides(ligaMxEvents, "Liga MX", "⚽");
  const laLigaSlides = makeSlides(laLigaEvents, "La Liga", "⚽");

  // Round-robin across all sports so the rotation always shows variety.
  // Soccer leagues first (priority for Latam audience), then US sports.
  const all = interleave([
    ligaMxSlides,
    mlsSlides,
    laLigaSlides,
    mlbSlides,
    nbaSlides,
    nflSlides,
    nhlSlides,
  ]);

  leagueCounts = {
    LMX: ligaMxSlides.length,
    MLS: mlsSlides.length,
    LAL: laLigaSlides.length,
    MLB: mlbSlides.length,
    NBA: nbaSlides.length,
    NFL: nflSlides.length,
    NHL: nhlSlides.length,
  };

  console.log(
    "Slide counts —",
    "LigaMX:", ligaMxSlides.length,
    "MLS:", mlsSlides.length,
    "LaLiga:", laLigaSlides.length,
    "MLB:", mlbSlides.length,
    "NBA:", nbaSlides.length,
    "NFL:", nflSlides.length,
    "NHL:", nhlSlides.length,
    "TOTAL:", all.length,
  );

  return all;
}

// ── Mini game card ──────────────────────────────────────────────────────────
function GameCardView({ game }: { game: GameCard }) {
  const awayWon = game.status === "final" && game.away.score > game.home.score;
  const homeWon = game.status === "final" && game.home.score > game.away.score;

  const Team = ({ side }: { side: "away" | "home" }) => {
    const t = game[side];
    const winner = side === "away" ? awayWon : homeWon;
    return (
      <div className="flex flex-col items-center gap-1" style={{ width: "8vw" }}>
        {t.logo
          ? <img src={t.logo} alt={t.abbr} style={{ width: "5vw", height: "5vw", objectFit: "contain" }} />
          : <span className="text-white font-bold" style={{ fontSize: "2.5vw" }}>{t.abbr}</span>
        }
        <span
          className="tracking-widest uppercase font-semibold"
          style={{ fontSize: "1vw", color: winner ? "#4ade80" : "rgba(255,255,255,0.4)" }}
        >
          {t.abbr}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: "28vw" }}>
      <div className="flex items-center justify-center gap-4">
        <Team side="away" />

        <div className="flex flex-col items-center gap-1">
          {game.status === "upcoming" ? (
            <span className="text-white/50 tracking-widest" style={{ fontSize: "2.2vw" }}>VS</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold tabular-nums" style={{ fontSize: "4vw", color: awayWon ? "#4ade80" : homeWon ? "#f87171" : "white" }}>
                {game.away.score}
              </span>
              <span className="text-white/20" style={{ fontSize: "2.5vw" }}>–</span>
              <span className="font-bold tabular-nums" style={{ fontSize: "4vw", color: homeWon ? "#4ade80" : awayWon ? "#f87171" : "white" }}>
                {game.home.score}
              </span>
            </div>
          )}
        </div>

        <Team side="home" />
      </div>

      <span
        className={`tracking-widest uppercase text-center ${game.status === "live" ? "text-red-400 animate-pulse" : "text-white/30"}`}
        style={{ fontSize: "1.1vw" }}
      >
        {game.status === "live" ? `● ${game.detail}` : game.detail}
      </span>
    </div>
  );
}

// ── Module-level state ──────────────────────────────────────────────────────
// PlayerPage mounts SportsWidget for ~10s then unmounts it. If we kept slide
// index in component state, every mount would reset to 0 (always Liga MX #1).
// Persisting across mounts at module scope so each appearance advances to the
// next game in the round-robin rotation.
let slidesCache: Slide[] = [];
let slidesCacheTime = 0;
const SLIDES_TTL = 5 * 60 * 1000; // 5 minutes
let globalSlideIndex = 0;
let fetchInFlight: Promise<Slide[]> | null = null;

async function getSlides(): Promise<Slide[]> {
  const fresh = Date.now() - slidesCacheTime < SLIDES_TTL && slidesCache.length > 0;
  if (fresh) return slidesCache;
  if (fetchInFlight) return fetchInFlight;
  fetchInFlight = buildSlides().then((s) => {
    slidesCache = s;
    slidesCacheTime = Date.now();
    fetchInFlight = null;
    return s;
  });
  return fetchInFlight;
}

// ── Main widget ─────────────────────────────────────────────────────────────
export default function SportsWidget() {
  const [slides, setSlides] = useState<Slide[]>(slidesCache);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(slidesCache.length === 0);

  // On mount: pick the next slide in global rotation, then fetch fresh if stale
  useEffect(() => {
    let cancelled = false;

    getSlides().then((s) => {
      if (cancelled) return;
      setSlides(s);
      setLoading(false);
      if (s.length > 0) {
        // Advance global index so next mount shows the next game
        const idx = globalSlideIndex % s.length;
        globalSlideIndex = (globalSlideIndex + 1) % s.length;
        setCurrent(idx);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const slide = slides[current];

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-8"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)" }}
    >
      {loading && (
        <p className="text-white/30 tracking-widest uppercase animate-pulse" style={{ fontSize: "2vw" }}>
          Cargando resultados...
        </p>
      )}

      {!loading && slides.length === 0 && (
        <p className="text-white/30 tracking-widest uppercase" style={{ fontSize: "2vw" }}>
          No hay partidos hoy
        </p>
      )}

      {!loading && slide && (
        <>
          {/* Sport header */}
          <div className="text-white/30 tracking-widest uppercase flex items-center gap-2" style={{ fontSize: "1.8vw" }}>
            <span>{slide.icon}</span>
            <span>{slide.sport}</span>
          </div>

          {/* Games — side by side with divider */}
          <div className="flex items-center justify-center gap-0">
            {slide.games.map((game, i) => (
              <div key={i} className="flex items-center">
                <GameCardView game={game} />
                {i < slide.games.length - 1 && (
                  <div className="h-20 w-px bg-white/10 mx-6" />
                )}
              </div>
            ))}
          </div>

        </>
      )}

      {/* Diagnostic strip: per-league counts + current slide */}
      {!loading && slides.length > 0 && (
        <div className="absolute bottom-4 left-4 text-white/40 text-xs tracking-widest tabular-nums flex gap-3">
          <span>LMX:{leagueCounts.LMX}</span>
          <span>MLS:{leagueCounts.MLS}</span>
          <span>LAL:{leagueCounts.LAL}</span>
          <span>MLB:{leagueCounts.MLB}</span>
          <span>NBA:{leagueCounts.NBA}</span>
          <span>NFL:{leagueCounts.NFL}</span>
          <span>NHL:{leagueCounts.NHL}</span>
          <span className="text-white/60">· {current + 1}/{slides.length}</span>
        </div>
      )}

      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>
    </div>
  );
}
