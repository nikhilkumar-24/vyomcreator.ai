const HOST = 'webservices.amazon.in';
const REGION = 'eu-west-1';
const SERVICE = 'ProductAdvertisingAPI';
const PATH = '/paapi5/searchitems';
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';
const CACHE_SECONDS = 3600;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}

// AWS Signature Version 4, as required by the Product Advertising API.
async function signedHeaders(body, accessKey, secretKey) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headers = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: HOST,
    'x-amz-date': amzDate,
    'x-amz-target': TARGET
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const signed = names.join(';');
  const canonical = ['POST', PATH, '', canonicalHeaders, signed, await sha256Hex(body)].join('\n');
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonical)].join('\n');

  let key = await hmac(enc.encode('AWS4' + secretKey), dateStamp);
  key = await hmac(key, REGION);
  key = await hmac(key, SERVICE);
  key = await hmac(key, 'aws4_request');
  const signature = hex(await hmac(key, toSign));

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`
  };
}

const LB_TO_KG = 0.453592;

// Returns every pack size mentioned in the text, normalized to kg (lb is converted), rounded to the nearest gram.
function packKg(text) {
  const kg = [];
  for (const m of String(text || '').matchAll(/(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|g|gm|gms|grams?|lbs?|pounds?)\b/gi)) {
    const n = Number(m[1]);
    const unit = m[2][0].toLowerCase();
    const value = unit === 'k' ? n : unit === 'g' ? n / 1000 : n * LB_TO_KG;
    kg.push(Math.round(value * 1000) / 1000);
  }
  return kg;
}

async function lookup(q, size, env) {
  const wanted = packKg(size)[0];
  const body = JSON.stringify({
    Keywords: q,
    SearchIndex: 'All',
    ItemCount: 10,
    PartnerTag: env.AMAZON_PARTNER_TAG,
    PartnerType: 'Associates',
    Resources: ['ItemInfo.Title', 'Offers.Listings.Price']
  });
  const headers = await signedHeaders(body, env.AMAZON_ACCESS_KEY, env.AMAZON_SECRET_KEY);
  const upstream = await fetch(`https://${HOST}${PATH}`, { method: 'POST', headers, body });
  if (!upstream.ok) throw new Error('amazon ' + upstream.status);
  const data = await upstream.json();
  for (const item of data.SearchResult?.Items || []) {
    const title = item.ItemInfo?.Title?.DisplayValue || '';
    if (wanted && !packKg(title).includes(wanted)) continue;
    const listing = item.Offers?.Listings?.[0];
    const price = Number(listing?.Price?.Amount);
    if (Number.isFinite(price) && price > 0) {
      return {
        ok: true,
        name: 'Amazon.in',
        title: item.ItemInfo?.Title?.DisplayValue || null,
        price,
        url: item.DetailPageURL || null
      };
    }
  }
  return { ok: true, name: 'Amazon.in', title: null, price: null, url: null };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const size = (url.searchParams.get('size') || '').trim().slice(0, 40);
  if (q.length < 2 || q.length > 60) {
    return Response.json({ ok: false, error: 'Type at least 2 characters.' }, { status: 400 });
  }
  if (!env.AMAZON_ACCESS_KEY || !env.AMAZON_SECRET_KEY || !env.AMAZON_PARTNER_TAG) {
    return Response.json({ ok: false, error: 'Amazon prices are not configured.' }, { status: 503 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.origin + '/api/amazon?q=' + encodeURIComponent(q.toLowerCase()) + '&size=' + encodeURIComponent(size.toLowerCase()));
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const result = await lookup(q, size, env);
    const response = Response.json(result, {
      headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` }
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (err) {
    return Response.json({ ok: false, error: 'Amazon prices are unavailable right now.' }, { status: 502 });
  }
}
