import { onRequestPost as analyzePost } from './functions/api/analyze.js';
import { onRequestGet as trendsGet } from './functions/api/trends.js';
import { onRequestPost as beatlinePost } from './functions/api/beatline.js';
import { onRequestPost as captionsPost } from './functions/api/captions.js';
import { onRequestPost as chatPost } from './functions/api/chat.js';

const LEGACY_HOST = 'vyom.kurminkexam.workers.dev';
const CANONICAL_ORIGIN = 'https://www.vyomcreator.ai';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOST) {
      return Response.redirect(CANONICAL_ORIGIN + url.pathname + url.search, 301);
    }
    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      return analyzePost({ request, env, ctx });
    }
    if (url.pathname === '/api/trends' && request.method === 'GET') {
      return trendsGet({ request, env, ctx });
    }
    if (url.pathname === '/api/beatline' && request.method === 'POST') {
      return beatlinePost({ request, env, ctx });
    }
    if (url.pathname === '/api/captions' && request.method === 'POST') {
      return captionsPost({ request, env, ctx });
    }
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return chatPost({ request, env, ctx });
    }
    // Legacy/cached links to the old .html paths: send them to the clean URL instead of a dead end.
    const legacyRedirects = { '/index.html': '/hooks', '/sfx.html': '/sfx', '/beatline.html': '/beatline' };
    if (legacyRedirects[url.pathname]) {
      url.pathname = legacyRedirects[url.pathname];
      return Response.redirect(url.toString(), 301);
    }
    // The Worker runs before static assets, so serve them here and keep a plain 404 when nothing matches.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    return new Response('Not found', { status: 404 });
  }
};
