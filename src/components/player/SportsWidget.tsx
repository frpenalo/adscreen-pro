import { useState, useEffect, useCallback } from "react";

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
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.events ?? [];
  } catch {
    return [];
  }
}

function chunkPairs<T>(arr: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    pairs.push(arr.slice(i, i + 2));
  }
  return pairs;
}

function sortBySport(events: any[], priority: Set<string>): any[] {
  return [...events].sort((a, b) => priorityScore(b, priority) - priorityScore(a, priority));
}

async function buildSlides(): Promise<Slide[]> {
  const [mlbEvents, nbaEvents, nhlEvents] = await Promise.all([
    fetchScoreboard("baseball", "mlb"),
    fetchScoreboard("basketball", "nba"),
    fetchScoreboard("hockey", "nhl"),
  ]);

  console.log("MLB games:", mlbEvents.length, "NBA games:", nbaEvents.length, "NHL games:", nhlEvents.length);

  const slides: Slide[] = [];

  // MLB — all games sorted by priority, 2 per slide
  const mlbSorted = sortBySport(mlbEvents, MLB_PRIORITY);
  for (const pair of chunkPairs(mlbSorted)) {
    slides.push({ sport: "MLB", icon: "⚾", games: pair.map(parseGame) });
  }

  // NBA — all games sorted by priority, 2 per slide
  const nbaSorted = sortBySport(nbaEvents, NBA_PRIORITY);
  for (const pair of chunkPairs(nbaSorted)) {
    slides.push({ sport: "NBA", icon: "🏀", games: pair.map(parseGame) });
  }

  // NHL — Hurricanes first, then any other game if no Canes
  const nhlSorted = nhlEvents.sort((a: any, b: any) => {
    const aCanes = a.competitions?.[0]?.competitors?.some((c: any) => String(c.team?.id) === HURRICANES_ID) ? 1 : 0;
    const bCanes = b.competitions?.[0]?.competitors?.some((c: any) => String(c.team?.id) === HURRICANES_ID) ? 1 : 0;
    return bCanes - aCanes;
  }).slice(0, 2);
  for (const pair of chunkPairs(nhlSorted)) {
    slides.push({ sport: "NHL", icon: "🏒", games: pair.map(parseGame) });
  }

  return slides;
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

// ── Main widget ─────────────────────────────────────────────────────────────
export default function SportsWidget() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    buildSlides().then((s) => {
      setSlides(s);
      setLoading(false);
    });
  }, []);

  // Initial load + refresh every 5 min
  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // Rotate every 12 seconds
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setCurrent((p) => (p + 1) % slides.length), 12000);
    return () => clearInterval(id);
  }, [slides]);

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

      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>
    </div>
  );
}
