const CACHE_SECONDS = 3600;
const WINDOW_DAYS = 90;

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
  const since = new Date(until.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        accountTag: env.CF_ACCOUNT_ID,
        since: since.toISOString(),
        until: until.toISOString(),
      },
    }),
  });

  if (!res.ok) {
    return Response.json({ visits: null }, { status: 502 });
  }

  const body = await res.json();
  const groups = body?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
  if (!Array.isArray(groups)) {
    return Response.json({ visits: null }, { status: 502 });
  }

  const countries = groups
    .map((g) => ({ code: g.dimensions?.countryName, visits: Number(g.sum?.visits) || 0 }))
    .filter((c) => c.code && c.visits > 0);
  const visits = countries.reduce((total, c) => total + c.visits, 0);

  const response = Response.json(
    { visits, days: WINDOW_DAYS, countries },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } },
  );
  await cache.put(cacheKey, response.clone());
  return response;
}
