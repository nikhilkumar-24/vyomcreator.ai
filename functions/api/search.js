const MUSCLEBLAZE_ORIGIN = 'https://www.muscleblaze.com';
const CACHE_SECONDS = 3600;
const MAX_SUGGESTIONS = 8;
const UPSTREAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; vyom-price-search/1.0)',
  Accept: 'application/json',
  Referer: MUSCLEBLAZE_ORIGIN + '/'
};

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

async function fetchJson(url) {
  const upstream = await fetch(url, { headers: UPSTREAM_HEADERS });
  if (!upstream.ok) throw new Error('upstream ' + upstream.status);
  return upstream.json();
}

async function suggestions(q) {
  const data = await fetchJson(`${MUSCLEBLAZE_ORIGIN}/veronica/ac/comp/v2?q=${encodeURIComponent(q)}&noRs=10&plt=1&st=9`);
  return (data.results?.acSuggest || [])
    .filter((s) => s.type === 'sp' && /^sp_\d+$/.test(s.suggestion_id))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => ({ id: s.suggestion_id.slice(3), name: clean(s.nm), query: clean(s.nm), brand: clean(s.brName) || 'MuscleBlaze' }));
}

// One lookup for all suggested products gives their price, MRP, stock and product page.
async function withPrices(items) {
  if (items.length === 0) return [];
  const spIds = items.map((i) => i.id).join(',');
  const data = await fetchJson(`${MUSCLEBLAZE_ORIGIN}/veronica/variant/mul/basic/id?svIdList=&spIds=${spIds}&plt=1&st=9`);
  const bySp = new Map((data.results?.variants || []).map((v) => [String(v.sp_id), v]));
  return items.map((item) => {
    const v = bySp.get(item.id);
    if (!v) return { ...item, url: null, price: null, mrp: null, inStock: null, variant: null };
    const price = Number(v.hkUserLoyaltyPricingDto?.hkNormalOfferPrice);
    const mrp = Number(v.mrp);
    return {
      ...item,
      name: clean(v.nm) || item.name,
      variant: clean(v.nm) && clean(v.nm) !== item.name ? clean(v.nm) : null,
      url: v.urlFragment ? `${MUSCLEBLAZE_ORIGIN}/sv${v.urlFragment}` : null,
      price: Number.isFinite(price) && price > 0 ? price : null,
      mrp: Number.isFinite(mrp) && mrp > 0 ? mrp : null,
      inStock: !v.oos
    };
  });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2 || q.length > 60) {
    return Response.json({ ok: false, error: 'Type at least 2 characters.' }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.origin + '/api/search?q=' + encodeURIComponent(q.toLowerCase()));
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let body;
  try {
    body = { ok: true, query: q, results: await withPrices(await suggestions(q)), fetchedAt: new Date().toISOString() };
  } catch {
    return Response.json({ ok: false, error: 'Search is unavailable right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const response = Response.json(body, { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
  await cache.put(cacheKey, response.clone());
  return response;
}
