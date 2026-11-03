/**
 * Optional, manual, read-only discovery of public search results.
 * No crawling profiles, contact harvesting, database writes or outreach.
 * Each hit is an unverified research suggestion, NOT a qualified prospect.
 */
export const SEARCHES = Object.freeze({
  creator: [
    'site:instagram.com UK beauty IPL hair removal creator',
    'site:tiktok.com/@ UK beauty IPL hair removal review'
  ],
  partner: [
    'UK independent online beauty retailers home hair removal IPL',
    'UK beauty technology retailer partnership'
  ]
});

export function normaliseSearchResults(payload, channel) {
  if (!["creator", "partner"].includes(channel)) throw new RangeError("Unsupported channel");
  const results = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  const output = [], seen = new Set();
  for (const result of results.slice(0, 10)) {
    if (typeof result?.link !== "string") continue;
    let url;
    try { url = new URL(result.link); } catch { continue; }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) continue;
    url.hash = "";
    const canonical = url.toString();
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    output.push({
      channel,
      title: String(result.title || "").slice(0, 180),
      sourceUrl: canonical,
      snippet: String(result.snippet || "").slice(0, 400),
      status: "unverified_search_result",
      contactAllowed: false
    });
  }
  return output;
}

export async function discover({ channel, apiKey, fetcher = fetch }) {
  if (!SEARCHES[channel]) throw new RangeError("Unsupported discovery channel");
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("SERPAPI_API_KEY required");
  const records = new Map();
  for (const query of SEARCHES[channel]) {
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({
      engine: "google", google_domain: "google.co.uk", gl: "uk", hl: "en",
      q: query, num: "10", api_key: apiKey
    }).toString();
    const response = await fetcher(url, { method: "GET", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Search provider failed with HTTP ${response.status}`);
    const data = await response.json();
    if (data?.error) throw new Error("Search provider returned an error");
    for (const record of normaliseSearchResults(data, channel)) {
      records.set(record.sourceUrl, record);
    }
  }
  return [...records.values()].slice(0, 20);
}
