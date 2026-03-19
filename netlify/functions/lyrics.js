const API_KEY = process.env.GENIUS_API_KEY;
const GENIUS_BASE = "https://api.genius.com";

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

function cleanLyrics(raw) {
  let lyrics = decodeHtmlEntities(raw);
  lyrics = lyrics.replace(/^\d+\s+Contributor[s]?[\s\S]*?Lyrics\n*/i, "");
  lyrics = lyrics.replace(/\d*Embed\s*$/i, "");
  return lyrics.trim();
}

async function scrapeLyrics(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();
  const marker = 'data-lyrics-container="true"';
  const chunks = [];
  let pos = 0;

  while (true) {
    const start = html.indexOf(marker, pos);
    if (start === -1) break;
    const tagEnd = html.indexOf(">", start);
    if (tagEnd === -1) break;
    let depth = 1;
    let i = tagEnd + 1;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf("<div", i);
      const nextClose = html.indexOf("</div>", i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) chunks.push(html.slice(tagEnd + 1, nextClose));
        i = nextClose + 6;
      }
    }
    pos = tagEnd + 1;
  }

  if (!chunks.length) return null;
  const raw = chunks
    .map(c => c.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleanLyrics(raw) || null;
}

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const body = await req.json();
  const { action, title, artist, query } = body;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    if (action === "search") {
      const res = await fetch(
        `${GENIUS_BASE}/search?q=${encodeURIComponent(query)}&per_page=8`,
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );
      const data = await res.json();
      const results = (data.response?.hits || []).map((h) => ({
        id: h.result.id,
        title: h.result.full_title,
        songTitle: h.result.title,
        artist: h.result.primary_artist?.name || "",
        albumArt: h.result.song_art_image_thumbnail_url,
        url: h.result.url,
      }));
      return new Response(JSON.stringify({ success: true, results }), { status: 200, headers });
    }

    if (action === "getSong") {
      const q = artist ? `${title} ${artist}` : title;
      const res = await fetch(
        `${GENIUS_BASE}/search?q=${encodeURIComponent(q)}&per_page=5`,
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );
      const data = await res.json();
      const hit = data.response?.hits?.[0]?.result;
      if (!hit) return new Response(JSON.stringify({ success: false, error: "Song not found" }), { status: 404, headers });

      const lyrics = await scrapeLyrics(hit.url);
      if (!lyrics) return new Response(JSON.stringify({ success: false, error: "Could not fetch lyrics" }), { status: 404, headers });

      return new Response(JSON.stringify({
        success: true,
        song: { id: hit.id, title: hit.full_title, url: hit.url, albumArt: hit.song_art_image_url, lyrics },
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), { status: 400, headers });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/lyrics" };
