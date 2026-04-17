const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RSS_SOURCES = [
  "https://news.google.com/rss/search?q=raleigh+nc&hl=en-US&gl=US&ceid=US:en",
  "https://www.wral.com/rss/",
  "https://abc11.com/feed/",
];

function parseRSS(xml: string): { title: string; pubDate: string }[] {
  const items: { title: string; pubDate: string }[] = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const match of itemMatches) {
    const itemXml = match[1];

    const titleMatch =
      itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) ??
      itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s);

    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

    const rawTitle = titleMatch?.[1]?.trim();
    if (!rawTitle) continue;

    // Google News appends " - Source Name", strip it
    const title = rawTitle.replace(/ - [^-]+$/, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

    items.push({
      title,
      pubDate: pubDateMatch?.[1]
        ? new Date(pubDateMatch[1]).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  for (const url of RSS_SOURCES) {
    try {
      console.log("Trying:", url);
      const res = await fetchWithTimeout(url, 6000);

      if (!res.ok) {
        console.log("Non-OK response:", res.status, url);
        continue;
      }

      const text = await res.text();
      const items = parseRSS(text);
      console.log("Parsed items:", items.length, "from", url);

      if (items.length > 0) {
        return new Response(JSON.stringify({ items }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error(`Failed ${url}:`, e);
    }
  }

  return new Response(JSON.stringify({ items: [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
