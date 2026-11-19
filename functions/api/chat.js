const MODEL = '@cf/zai-org/glm-4.7-flash';
const MAX_HISTORY = 10;
const MAX_CHARS = 1000;

const SITE_PAGES = [
  { title: 'VYOM AI home', url: '/', keywords: 'home landing vyom ai creators growth lab overview about start', summary: 'Overview of VYOM AI and its four tools for creators.' },
  { title: 'Reel Hook Analyzer', url: '/hooks.html', keywords: 'hook hooks analyze analyzer reel story pacing hashtags trends score retention intro', summary: 'Scores a reel hook and story, suggests edits and trend-based hashtags. Works in English, Hindi, Kannada and Tamil.' },
  { title: 'Free SFX Library', url: '/sfx.html', keywords: 'sfx sound effects sound library whoosh ping transition audio free download', summary: 'Royalty-free sound effects for reels and short videos.' },
  { title: 'Beatline', url: '/beatline.html', keywords: 'beatline beat timeline scene sfx cuts plan storyboard music sync', summary: 'Plan a reel with a scene and sound-effect timeline, lined up to cuts and beats.' },
  { title: 'Captions Studio', url: '/captions.html', keywords: 'captions caption subtitles subtitle transcribe transcription language english hindi kannada tamil font style export download video', summary: 'Auto-captions in English, Hindi, Kannada or Tamil, creator styles and browser export.' }
];

function searchSite(query) {
  const terms = new Set(String(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2));
  if (!terms.size) return [];
  return SITE_PAGES
    .map(page => {
      const words = page.keywords.split(' ');
      const score = [...terms].filter(t => words.includes(t) || page.title.toLowerCase().includes(t)).length;
      return { page, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => ({ title: r.page.title, url: r.page.url, summary: r.page.summary }));
}

function buildSystemPrompt(links) {
  const pages = SITE_PAGES.map(p => `- ${p.title} (${p.url}): ${p.summary}`).join('\n');
  const matches = links.length
    ? `\nMost relevant pages for the latest question:\n${links.map(l => `- ${l.title} (${l.url})`).join('\n')}\nMention the best match by name.`
    : '';
  return `You are Vyo, the friendly assistant inside VYOM AI, a free toolkit for short-form creators (Instagram Reels). The site pages are:
${pages}${matches}
Answer briefly (under 120 words), in the language the user writes in. You cannot see the user's videos or accounts. If asked about errors with AI features, suggest enabling Workers AI on the Cloudflare account. Politely decline requests unrelated to content creation or these tools.`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  if (typeof result?.choices?.[0]?.message?.content === 'string') return result.choices[0].message.content;
  return '';
}

function fallbackReply(links, intro) {
  if (!links.length) return 'Sorry, I could not find that on VYOM AI. Try asking about hooks, SFX, beat timing or captions.';
  return `${intro}\n${links.map(l => `${l.title}: ${l.url}`).join('\n')}`;
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Send a JSON body.' }, 400); }
  const messages = cleanHistory(body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return json({ error: 'Send a message to start the chat.' }, 400);
  }
  const question = messages[messages.length - 1].content;
  const links = searchSite(question);
  if (!env.AI) {
    return json({ reply: fallbackReply(links, 'Vyo AI is offline right now, but these pages may help.'), links, mode: 'fallback' });
  }
  try {
    const result = await env.AI.run(MODEL, {
      messages: [{ role: 'system', content: buildSystemPrompt(links) }, ...messages],
      max_tokens: 400
    });
    const reply = extractText(result).trim().slice(0, 1200);
    if (!reply) throw new Error('Empty reply');
    return json({ reply, links, mode: 'ai' });
  } catch (err) {
    return json({ reply: fallbackReply(links, 'I could not reach the AI just now, but these pages may help.'), links, mode: 'fallback', aiError: String(err?.message || 'Workers AI request failed').slice(0, 180) });
  }
}
