const CACHE_SECONDS = 3600;
const START_DATE = '2024-01-01T00:00:00Z';
const CHUNK_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const QUERY = `query ($accountTag: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(
        limit: 300
        orderBy: [sum_visits_DESC]
        filter: { datetime_geq: $since, datetime_leq: $until }
      ) {
        sum { visits }
        dimensions { countryName }
      }
    }
  }
}`;

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/stats');
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) {
    return Response.json({ visits: null }, { status: 503 });
  }

  const until = new Date();
  const windows = [];
  for (let end = until; end > new Date(START_DATE); end = new Date(end.getTime() - CHUNK_DAYS * DAY_MS)) {
    const start = new Date(Math.max(end.getTime() - CHUNK_DAYS * DAY_MS, new Date(START_DATE).getTime()));
    windows.push({ since: start.toISOString(), until: end.toISOString() });
  }

  const results = await Promise.all(windows.map((w) => fetchWindow(env, w)));
  if (results.some((r) => r === null)) {
    return Response.json({ visits: null }, { status: 502 });
  }

  const totals = new Map();
  for (const groups of results) {
    for (const g of groups) {
      const code = g.dimensions?.countryName;
      const visits = Number(g.sum?.visits) || 0;
      if (code && visits > 0) totals.set(code, (totals.get(code) || 0) + visits);
    }
  }
  const countries = [...totals].map(([code, visits]) => ({ code, visits })).sort((a, b) => b.visits - a.visits);
  const visits = countries.reduce((total, c) => total + c.visits, 0);

  const response = Response.json(
    { visits, scope: 'all-time', countries },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } },
  );
  await cache.put(cacheKey, response.clone());
  return response;
}

async function fetchWindow(env, { since, until }) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { accountTag: env.CF_ACCOUNT_ID, since, until },
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const groups = body?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
  return Array.isArray(groups) ? groups : null;
}

