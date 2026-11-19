const MODEL = '@cf/openai/whisper-large-v3-turbo';
const TRANSLATE_MODEL = '@cf/meta/m2m100-1.2b';
// 16 kHz mono 16-bit WAV is ~1.9 MB per minute; 12 MB of base64 covers roughly 5 minutes of audio.
const MAX_AUDIO_BASE64 = 12 * 1024 * 1024;
const TRANSLATE_CONCURRENCY = 6;
const LANGUAGES = new Set(['en', 'hi', 'kn', 'ta', 'bn', 'ml', 'te', 'fr', 'es', 'zh', 'ms', 'ro', 'de', 'ja', 'pt', 'it', 'ko']);
const LANGUAGE_NAMES = {
  english: 'en', hindi: 'hi', kannada: 'kn', tamil: 'ta',
  bengali: 'bn', malayalam: 'ml', telugu: 'te', french: 'fr', spanish: 'es',
  mandarin: 'zh', chinese: 'zh', malay: 'ms', roman: 'ro', romanian: 'ro',
  german: 'de', japanese: 'ja', portuguese: 'pt', italian: 'it', korean: 'ko'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function normalizeSegments(result) {
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  return segments
    .map(s => ({
      start: num(s.start),
      end: num(s.end),
      text: String(s.text || '').trim(),
      words: Array.isArray(s.words)
        ? s.words
          .map(w => ({ word: String(w.word || '').trim(), start: num(w.start), end: num(w.end) }))
          .filter(w => w.word)
        : []
    }))
    .filter(s => s.text && s.end > s.start);
}

function langCode(value) {
  const v = String(value || '').toLowerCase().trim();
  return LANGUAGE_NAMES[v] || v;
}

// Translating segment by segment keeps the original timings. Segments that
// fail to translate keep their original text rather than failing the request.
async function translateSegments(env, segments, from, to) {
  const out = [];
  for (let i = 0; i < segments.length; i += TRANSLATE_CONCURRENCY) {
    const batch = segments.slice(i, i + TRANSLATE_CONCURRENCY);
    const translated = await Promise.all(batch.map(async seg => {
      try {
        const r = await env.AI.run(TRANSLATE_MODEL, { text: seg.text, source_lang: from, target_lang: to });
        const text = String(r?.translated_text || '').trim();
        return { ...seg, text: text || seg.text, words: text ? [] : seg.words };
      } catch {
        return seg;
      }
    }));
    out.push(...translated);
  }
  return out;
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request body.' }, 400); }
  const audio = typeof body.audio === 'string' ? body.audio.replace(/^data:[^;]+;base64,/, '') : '';
  if (!audio) return json({ error: 'No audio was provided.' }, 400);
  if (audio.length > MAX_AUDIO_BASE64) return json({ error: 'Audio is too long for auto-captions. Try a shorter clip or type captions manually.' }, 413);
  if (!env.AI) return json({ error: 'Auto-captions need Workers AI enabled. You can still add captions manually.' }, 503);

  const target = body.language === undefined ? 'en' : langCode(body.language);
  if (!LANGUAGES.has(target)) return json({ error: 'Unsupported caption language.' }, 400);

  try {
    if (target === 'en') {
      // Whisper's translate task writes English for speech in any language.
      const result = await env.AI.run(MODEL, { audio, task: 'translate', vad_filter: true, condition_on_previous_text: false });
      return json({
        text: String(result?.text || '').trim(),
        language: 'en',
        segments: normalizeSegments(result)
      });
    }

    // Other targets: keep speech in the language spoken, then translate the captions into the target.
    const result = await env.AI.run(MODEL, { audio, task: 'transcribe', vad_filter: true, condition_on_previous_text: false });
    let segments = normalizeSegments(result);
    const detected = langCode(result?.transcription_info?.language) || 'en';
    if (segments.length && detected !== target) {
      segments = await translateSegments(env, segments, LANGUAGES.has(detected) ? detected : 'en', target);
    }
    return json({
      text: segments.map(s => s.text).join(' '),
      language: target,
      segments
    });
  } catch (err) {
    return json({ error: 'Transcription failed. Try again or type captions manually.' }, 502);
  }
}
