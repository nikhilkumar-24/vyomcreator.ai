const CACHE_SECONDS = 3600;
const RETENTION_DAYS = 180;
const CHUNK_DAYS = 90;
const WORKER_CHUNK_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

const WORKER_QUERY = `query ($accountTag: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        limit: 10000
        filter: { datetime_geq: $since, datetime_leq: $until }
      ) {
        sum { requests }
        dimensions { coloCode }
      }
    }
  }
}`;

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
  const cacheKey = new Request(new URL(request.url).origin + '/api/stats-v2');
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) {
    return Response.json({ visits: null }, { status: 503 });
  }

  const [visitResults, workerResults] = await Promise.all([
    Promise.all(windowsFor(CHUNK_DAYS).map((w) => fetchWindow(env, QUERY, 'rumPageloadEventsAdaptiveGroups', w))),
    Promise.all(windowsFor(WORKER_CHUNK_DAYS).map((w) => fetchWindow(env, WORKER_QUERY, 'workersInvocationsAdaptive', w))),
  ]);
  if (visitResults.includes(null) || workerResults.includes(null)) {
    return Response.json({ visits: null }, { status: 502 });
  }

  const totals = new Map();
  for (const groups of visitResults) {
    for (const g of groups) {
      const code = g.dimensions?.countryName;
      const visits = Number(g.sum?.visits) || 0;
      if (code && visits > 0) totals.set(code, (totals.get(code) || 0) + visits);
    }
  }
  const countries = [...totals].map(([code, visits]) => ({ code, visits })).sort((a, b) => b.visits - a.visits);
  const visits = countries.reduce((total, c) => total + c.visits, 0);
  const invocations = workerResults.flat().reduce((total, g) => total + (Number(g.sum?.requests) || 0), 0);
  const coloTotals = new Map();
  for (const g of workerResults.flat()) {
    const code = g.dimensions?.coloCode;
    const requests = Number(g.sum?.requests) || 0;
    if (code && requests > 0) coloTotals.set(code, (coloTotals.get(code) || 0) + requests);
  }
  const colos = [...coloTotals].map(([code, requests]) => ({ code, requests })).sort((a, b) => b.requests - a.requests);

  const response = Response.json(
    { visits, invocations, scope: 'last-180-days', countries, colos },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } },
  );
  await cache.put(cacheKey, response.clone());
  return response;
}

function windowsFor(days) {
  const floor = Date.now() - RETENTION_DAYS * DAY_MS;
  const windows = [];
  for (let end = Date.now(); end > floor; end -= days * DAY_MS) {
    windows.push({
      since: new Date(Math.max(end - days * DAY_MS, floor)).toISOString(),
      until: new Date(end).toISOString(),
    });
  }
  return windows;
}

async function fetchWindow(env, query, field, { since, until }) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { accountTag: env.CF_ACCOUNT_ID, since, until },
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const groups = body?.data?.viewer?.accounts?.[0]?.[field];
  return Array.isArray(groups) ? groups : null;
}

