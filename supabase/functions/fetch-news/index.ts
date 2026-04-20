const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bilingual feed mix. Spanish Latam-relevant news first, then local
// English. The widget renders whichever set is returned.
const RSS_BY_LANG = {
  es: [
    "https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419",
    "https://news.google.com/rss/search?q=noticias+latinos+estados+unidos&hl=es-419&gl=US&ceid=US:es-419",
    "https://feeds.univision.com/feeds/rss/latest",
  ],
  en: [
    "https://news.google.com/rss/search?q=raleigh+nc&hl=en-US&gl=US&ceid=US:en",
    "https://www.wral.com/rss/",
    "https://abc11.com/feed/",
  ],
};

interface NewsItem { title: string; pubDate: string; source: string }

function parseRSS(xml: string, lang: "es" | "en"): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const match of itemMatches) {
    const itemXml = match[1];

    const titleMatch =
      itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) ??
      itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s);

    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);

    const rawTitle = titleMatch?.[1]?.trim();
    if (!rawTitle) continue;

    // Google News appends " - Source Name"; capture it and strip
    const dashIdx = rawTitle.lastIndexOf(" - ");
    const hasSuffix = dashIdx > 20 && dashIdx < rawTitle.length - 2;
    const title = (hasSuffix ? rawTitle.slice(0, dashIdx) : rawTitle)
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();

    const source = sourceMatch?.[1]?.trim()
      ?? (hasSuffix ? rawTitle.slice(dashIdx + 3).trim() : "");

    const locale = lang === "es" ? "es-US" : "en-US";
    items.push({
      title,
      pubDate: pubDateMatch?.[1]
        ? new Date(pubDateMatch[1]).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
        : "",
      source,
    });

    if (items.length >= 6) break;
  }

  return items;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdScreenPro/1.0)" },
    });
  } finally {
    clearTimeout(id);
  }
}

async function fetchFromSources(sources: string[], lang: "es" | "en"): Promise<NewsItem[]> {
  for (const url of sources) {
    try {
      console.log("Trying:", url);
      const res = await fetchWithTimeout(url, 6000);
      if (!res.ok) {
        console.log("Non-OK response:", res.status, url);
        continue;
      }
      const text = await res.text();
      const items = parseRSS(text, lang);
      console.log("Parsed items:", items.length, "from", url);
      if (items.length > 0) return items;
    } catch (e) {
      console.error(`Failed ${url}:`, e);
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Lang param: ?lang=es (default) | ?lang=en
  const url = new URL(req.url);
  const lang = (url.searchParams.get("lang") === "en" ? "en" : "es") as "es" | "en";

  // Try the requested language first; if empty, fall back to the other
  const primary = await fetchFromSources(RSS_BY_LANG[lang], lang);
  if (primary.length > 0) {
    return new Response(JSON.stringify({ items: primary, lang }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fallbackLang = lang === "es" ? "en" : "es";
  const fallback = await fetchFromSources(RSS_BY_LANG[fallbackLang], fallbackLang);
  return new Response(JSON.stringify({ items: fallback, lang: fallbackLang }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
