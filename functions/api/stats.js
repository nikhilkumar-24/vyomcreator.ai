const CACHE_SECONDS = 3600;
const SINCE = '2024-01-01T00:00:00Z';

const QUERY = `query ($accountTag: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $since, datetime_leq: $until }) {
        sum { visits }
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

  const until = new Date().toISOString();
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { accountTag: env.CF_ACCOUNT_ID, since: SINCE, until },
    }),
  });

  if (!res.ok) {
    return Response.json({ visits: null }, { status: 502 });
  }

  const body = await res.json();
  const groups = body?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
  const visits = groups?.[0]?.sum?.visits;
  if (!Number.isFinite(visits)) {
    return Response.json({ visits: null }, { status: 502 });
  }

  const response = Response.json(
    { visits, since: SINCE },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } },
  );
  await cache.put(cacheKey, response.clone());
  return response;
}
