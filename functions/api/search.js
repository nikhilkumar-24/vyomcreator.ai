const MUSCLEBLAZE_ORIGIN = 'https://www.muscleblaze.com';
const HEALTHKART_ORIGIN = 'https://www.healthkart.com';
const CACHE_SECONDS = 3600;
// Bump when the response shape changes so stale cached searches are not served.
const CACHE_VERSION = 2;
const MAX_SUGGESTIONS = 8;

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

async function fetchJson(url, origin) {
  const upstream = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; vyom-price-search/1.0)',
      Accept: 'application/json',
      Referer: origin + '/'
    }
  });
  if (!upstream.ok) throw new Error('upstream ' + upstream.status);
  return upstream.json();
}

async function suggestions(q) {
  const data = await fetchJson(`${MUSCLEBLAZE_ORIGIN}/veronica/ac/comp/v2?q=${encodeURIComponent(q)}&noRs=10&plt=1&st=9`, MUSCLEBLAZE_ORIGIN);
  return (data.results?.acSuggest || [])
    .filter((s) => s.type === 'sp' && /^sp_\d+$/.test(s.suggestion_id))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => ({ id: s.suggestion_id.slice(3), name: clean(s.nm), query: clean(s.nm), brand: clean(s.brName) || 'MuscleBlaze' }));
}

async function variantsBySp(origin, spIds) {
  const data = await fetchJson(`${origin}/veronica/variant/mul/basic/id?svIdList=&spIds=${spIds}&plt=1&st=9`, origin);
  return new Map((data.results?.variants || []).map((v) => [String(v.sp_id), v]));
}

function priceOf(v, origin) {
  const price = Number(v.hkUserLoyaltyPricingDto?.hkNormalOfferPrice);
  const mrp = Number(v.mrp);
  return {
    url: v.urlFragment ? `${origin}/sv${v.urlFragment}` : null,
    price: Number.isFinite(price) && price > 0 ? price : null,
    mrp: Number.isFinite(mrp) && mrp > 0 ? mrp : null,
    inStock: !v.oos
  };
}

// One lookup per site for all suggested products gives price, MRP, stock and product page.
// HealthKart failing must not hide MuscleBlaze results, so its lookup falls back to an empty map.
async function withPrices(items) {
  if (items.length === 0) return [];
  const spIds = items.map((i) => i.id).join(',');
  const [mbVariants, hkVariants] = await Promise.all([
    variantsBySp(MUSCLEBLAZE_ORIGIN, spIds),
    variantsBySp(HEALTHKART_ORIGIN, spIds).catch(() => new Map())
  ]);
  return items.map((item) => {
    const hk = hkVariants.get(item.id);
    const healthkart = hk ? { ...priceOf(hk, HEALTHKART_ORIGIN), name: clean(hk.nm) || item.name } : null;
    const v = mbVariants.get(item.id);
    if (!v) return { ...item, url: null, price: null, mrp: null, inStock: null, variant: null, healthkart };
    const mb = priceOf(v, MUSCLEBLAZE_ORIGIN);
    return {
      ...item,
      name: clean(v.nm) || item.name,
      variant: clean(v.nm) && clean(v.nm) !== item.name ? clean(v.nm) : null,
      ...mb,
      healthkart
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
  const cacheKey = new Request(url.origin + '/api/search?v=' + CACHE_VERSION + '&q=' + encodeURIComponent(q.toLowerCase()));
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
