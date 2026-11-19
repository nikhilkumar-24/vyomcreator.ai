const MUSCLEBLAZE_URL = 'https://www.muscleblaze.com/sv/muscleblaze-biozyme-performance-whey/SP-88093?navKey=VRNT-165145';
const CACHE_SECONDS = 3600;

function extractOffer(html) {
  const scripts = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const types = [].concat(item['@type'] || []);
        if (!types.includes('Product') || !item.offers) continue;
        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        const price = Number(offer.price);
        if (!Number.isFinite(price)) continue;
        return { price, inStock: /InStock/i.test(offer.availability || '') };
      }
    } catch {
      // Ignore malformed JSON-LD blocks and keep looking.
    }
  }
  return null;
}

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/price/muscleblaze');
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let body;
  try {
    const upstream = await fetch(MUSCLEBLAZE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; vyom-price-check/1.0)', Accept: 'text/html' }
    });
    if (!upstream.ok) throw new Error('upstream ' + upstream.status);
    const offer = extractOffer(await upstream.text());
    if (!offer) throw new Error('no offer data');
    body = { ok: true, store: 'MuscleBlaze', url: MUSCLEBLAZE_URL, fetchedAt: new Date().toISOString(), ...offer };
  } catch {
    return Response.json({ ok: false, store: 'MuscleBlaze', url: MUSCLEBLAZE_URL, error: 'Live price unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const response = Response.json(body, { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
  await cache.put(cacheKey, response.clone());
  return response;
}
