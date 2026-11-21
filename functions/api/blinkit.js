const SCRAPPA_URL = 'https://scrappa.co/api/blinkit/search';
const CACHE_SECONDS = 1800;

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function normalize(item) {
  return {
    id: String(item.id ?? ''),
    name: clean(item.name),
    brand: clean(item.brand) || null,
    pack: clean(item.pack ?? item.quantity) || null,
    price: money(item.price),
    mrp: money(item.regular_price ?? item.mrp),
    inStock: item.availability ? item.availability === 'in_stock' : null
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const latRaw = (url.searchParams.get('lat') || '').trim();
  const lonRaw = (url.searchParams.get('lon') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (q.length < 2 || q.length > 60) {
    return Response.json({ ok: false, error: 'Type at least 2 characters.' }, { status: 400 });
  }
  if (!latRaw || !lonRaw || !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) {
    return Response.json({ ok: false, error: 'A valid delivery location is required.' }, { status: 400 });
  }
  if (!env.SCRAPPA_API_KEY) {
    return Response.json({ ok: false, error: 'Blinkit prices are not configured.' }, { status: 503 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.origin + '/api/blinkit?q=' + encodeURIComponent(q.toLowerCase()) +
    '&lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4) + '&page=' + page);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let data;
  try {
    const params = new URLSearchParams({ query: q, lat: String(lat), lon: String(lon), page: String(page) });
    const upstream = await fetch(`${SCRAPPA_URL}?${params}`, {
      headers: { 'X-API-KEY': env.SCRAPPA_API_KEY, Accept: 'application/json' }
    });
    if (!upstream.ok) throw new Error('scrappa ' + upstream.status);
    data = await upstream.json();
  } catch {
    return Response.json({ ok: false, error: 'Blinkit prices are unavailable right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const body = {
    ok: true,
    query: q,
    page,
    hasNextPage: data?.data?.has_next_page === true,
    items: (data?.data?.items || []).map(normalize)
  };
  const response = Response.json(body, { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
  await cache.put(cacheKey, response.clone());
  return response;
}
