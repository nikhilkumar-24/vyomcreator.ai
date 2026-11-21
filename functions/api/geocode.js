const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_SECONDS = 86400;

// Nominatim's usage policy requires an identifying User-Agent.
const USER_AGENT = 'vyom-price-search/1.0 (https://www.vyomcreator.ai)';

// Keeps the first few parts of "Street, Area, City, District, State, Postcode, India".
const shortLabel = (displayName) => String(displayName || '').split(',').slice(0, 3).map((s) => s.trim()).join(', ');

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const address = (url.searchParams.get('address') || '').trim();
  if (address.length < 3 || address.length > 200) {
    return Response.json({ ok: false, error: 'Enter a delivery address.' }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.origin + '/api/geocode?address=' + encodeURIComponent(address.toLowerCase()));
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let places;
  try {
    const params = new URLSearchParams({ q: address, format: 'json', limit: '1', countrycodes: 'in' });
    const upstream = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en', Accept: 'application/json' }
    });
    if (!upstream.ok) throw new Error('nominatim ' + upstream.status);
    places = await upstream.json();
  } catch {
    return Response.json({ ok: false, error: 'Address lookup is unavailable right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const place = places[0];
  const lat = Number(place?.lat);
  const lon = Number(place?.lon);
  if (!place || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ ok: false, error: 'Could not find that address. Try adding the city and PIN code.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const response = Response.json(
    { ok: true, lat, lon, label: shortLabel(place.display_name) },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } }
  );
  await cache.put(cacheKey, response.clone());
  return response;
}
