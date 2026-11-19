const MODEL = '@cf/google/gemma-4-26b-a4b-it';
const TEXT_MODEL = '@cf/zai-org/glm-4.7-flash';
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi (Devanagari script)', kn: 'Kannada (Kannada script)', ta: 'Tamil (Tamil script)',
  bn: 'Bengali (Bengali script)', ml: 'Malayalam (Malayalam script)', te: 'Telugu (Telugu script)',
  fr: 'French', es: 'Spanish', zh: 'Chinese (Simplified, Mandarin)', ms: 'Malay', ro: 'Romanian',
  de: 'German', ja: 'Japanese (Japanese script)', pt: 'Portuguese', it: 'Italian', ko: 'Korean (Hangul script)'
};

// Returns the report in one language by replacing the English text with that language's block.
function localize(result, lang) {
  const { hindi, kannada, tamil, ...english } = result;
  const block = { hi: hindi, kn: kannada, ta: tamil }[lang];
  return block ? { ...english, ...block, language: lang } : { ...english, language: 'en' };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function clamp(n) { return Math.max(0, Math.min(100, Math.round(Number(n) || 0))); }
function extractText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  if (typeof result?.output_text === 'string') return result.output_text;
  if (typeof result?.result === 'string') return result.result;
  if (typeof result?.choices?.[0]?.message?.content === 'string') return result.choices[0].message.content;
  if (typeof result?.content === 'string') return result.content;
  return '';
}
function parseJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI returned an unreadable report');
  return JSON.parse(cleaned.slice(start, end + 1));
}
function fallback(input, trendItems) {
  const hasHook = input.hook.trim().length > 8;
  const hasCaption = input.caption.trim().length > 30;
  const categories = [
    { name: 'Opening hook', score: hasHook ? 70 : 42, reason: hasHook ? 'A hook was provided; test whether it creates a clear curiosity gap.' : 'No hook text was provided, so the opening cannot be fully assessed.' },
    { name: 'Story & clarity', score: hasCaption ? 68 : 48, reason: hasCaption ? 'A caption or script is available to assess the message.' : 'Add a concise script or caption for a stronger story review.' },
    { name: 'Visual storytelling', score: input.frames.length ? 55 : 35, reason: input.frames.length ? 'Frames were extracted, but visual AI is unavailable in fallback mode.' : 'Video frames were unavailable for inspection.' },
    { name: 'Audience fit', score: input.audience ? 67 : 50, reason: input.audience ? 'Audience was specified; make the benefit immediately relevant to them.' : 'Define a specific audience to make the reel more targeted.' },
    { name: 'Share & save potential', score: hasCaption ? 62 : 45, reason: 'This is a heuristic estimate; actual sharing behavior cannot be known before posting.' }
  ];
  const score = clamp(categories.reduce((sum, c) => sum + c.score * ({'Opening hook':.25,'Story & clarity':.2,'Visual storytelling':.2,'Audience fit':.15,'Share & save potential':.2}[c.name]), 0));
  const nicheTag = input.niche.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hindiCategories = [
    { name: 'शुरुआती हुक', score: categories[0].score, reason: hasHook ? 'हुक दिया गया है; देखें कि क्या यह दर्शकों में स्पष्ट जिज्ञासा जगाता है।' : 'हुक का पाठ नहीं दिया गया, इसलिए शुरुआत का पूरा आकलन संभव नहीं है।' },
    { name: 'कहानी और स्पष्टता', score: categories[1].score, reason: hasCaption ? 'संदेश का आकलन करने के लिए कैप्शन या स्क्रिप्ट उपलब्ध है।' : 'बेहतर कहानी के आकलन के लिए संक्षिप्त स्क्रिप्ट या कैप्शन जोड़ें।' },
    { name: 'दृश्य कहानी', score: categories[2].score, reason: input.frames.length ? 'फ्रेम निकाले गए, लेकिन इस मोड में दृश्य AI उपलब्ध नहीं है।' : 'जांच के लिए वीडियो फ्रेम उपलब्ध नहीं थे।' },
    { name: 'दर्शकों के लिए उपयुक्तता', score: categories[3].score, reason: input.audience ? 'दर्शक बताए गए हैं; लाभ को उनके लिए तुरंत प्रासंगिक बनाएं।' : 'रील को अधिक लक्षित बनाने के लिए विशिष्ट दर्शक तय करें।' },
    { name: 'शेयर और सेव की संभावना', score: categories[4].score, reason: 'यह एक अनुमान है; पोस्ट करने से पहले वास्तविक शेयर व्यवहार ज्ञात नहीं हो सकता।' }
  ];
  return {
    mode: 'fallback', score, label: 'CONTENT READINESS', headline: score >= 70 ? 'Good foundations — sharpen the details' : 'A few focused edits could help',
    summary: 'This is a transparent heuristic baseline, not a model-based review or a prediction of views.', categories,
    recommendations: [
      hasHook ? 'Make the opening more specific: promise a clear payoff or challenge a familiar belief in the first 1–2 seconds.' : 'Write a punchy first-line hook before editing. Lead with a surprising result, a specific problem, or a clear promise.',
      'Remove pauses and repeated points; make each cut earn the next second of attention.',
      'Add high-contrast, readable subtitles and keep key text away from Instagram’s interface overlays.',
      'End with one natural action that matches your goal: save this, share with a friend, or comment with an opinion.'
    ],
    hashtags: [''+nicheTag, 'reelsinstagram', 'reelscreator', 'contentcreator', 'explorepage'],
    suggestedHook: hasHook ? input.hook.trim().slice(0, 200) : `Stop scrolling if you're into ${input.niche.toLowerCase()} — here's what nobody tells you.`,
    suggestedCaption: hasCaption ? input.caption.trim().slice(0, 300) : `A quick, honest take on ${input.niche.toLowerCase()} for ${input.audience || 'anyone getting started'}. Save this for later and tell me your take in the comments.`,
    trends: trendItems.slice(0, 4).map(t => ({ title: t.title, reason: 'Trend signal to investigate; adapt it to your niche rather than copying blindly.' })),
    periodLabel: input.period === 'month' ? 'Monthly trend angles to explore' : 'Weekly trend angles to explore',
    disclaimer: 'Fallback mode: no AI model was available. Scores are rule-based estimates and trends are public search signals, not Instagram virality data.',
    hindi: {
      label: 'सामग्री की तैयारी',
      headline: score >= 70 ? 'अच्छी शुरुआत है, अब कुछ बारीकियां सुधारें' : 'कुछ छोटे बदलावों से रील बेहतर हो सकती है',
      summary: 'यह नियम-आधारित शुरुआती आकलन है, AI समीक्षा या व्यूज़ का अनुमान नहीं।',
      categories: hindiCategories,
      recommendations: [
        hasHook ? 'शुरुआत को अधिक खास बनाएं: पहले 1–2 सेकंड में स्पष्ट नतीजे का वादा करें या आम धारणा को चुनौती दें।' : 'एडिटिंग से पहले एक दमदार शुरुआती पंक्ति लिखें। चौंकाने वाला नतीजा, खास समस्या या स्पष्ट वादा पेश करें।',
        'रुकावटें और दोहराई गई बातें हटाएं; हर कट दर्शक का अगला सेकंड पाने लायक हो।',
        'पढ़ने में आसान, स्पष्ट सबटाइटल लगाएं और जरूरी टेक्स्ट को Instagram के इंटरफेस से दूर रखें।',
        'अपने लक्ष्य के अनुसार एक सहज आग्रह के साथ खत्म करें: सेव करें, दोस्त को भेजें या अपनी राय बताएं।'
      ],
      suggestedHook: `रुकिए, ${input.niche.toLowerCase()} के बारे में यह बात शायद आपको किसी ने नहीं बताई।`,
      suggestedCaption: `${input.audience || 'शुरुआत कर रहे लोगों'} के लिए ${input.niche.toLowerCase()} पर एक छोटा और सच्चा सुझाव। बाद के लिए सेव करें और अपनी राय कमेंट में बताएं।`,
      trends: trendItems.slice(0, 4).map(t => ({ title: t.title, reason: 'यह खोज रुचि का संकेत है; नकल करने के बजाय इसे अपने विषय के अनुसार ढालें।' })),
      periodLabel: input.period === 'month' ? 'महीने के लिए ट्रेंड विषय' : 'हफ्ते के लिए ट्रेंड विषय',
      disclaimer: 'फॉलबैक मोड: AI मॉडल उपलब्ध नहीं था। स्कोर नियम-आधारित अनुमान हैं और ट्रेंड सार्वजनिक खोज संकेत हैं, Instagram वायरलिटी डेटा नहीं।'
    },
    kannada: {
      label: 'ಸಾಮಗ್ರಿ ಸಿದ್ಧತೆ',
      headline: score >= 70 ? 'ಚೆನ್ನಾಗಿ ಪ್ರಾರಂಭವಾಗಿದೆ, ಈಗ ವಿವರಗಳು ಸುಧಾರಿಸಿ' : 'ಕೆಲವು ಸಣ್ಣ ಪರಿವರ್ತನೆಗಳು ರೀಲ್ ಅನ್ನು ಉತ್ತಮಗೊಳಿಸುತ್ತವೆ',
      summary: 'ಇದು ನಿಯಮ-ಆಧಾರಿತ ಆರಂಭಿಕ ಮೂಲ್ಯಮಾಪನವಾಗಿದೆ, AI ವಿಮರ್ಶೆ ಅಥವಾ ವಿವ್ರಗಳ ಅನುಮಾನವಲ್ಲ।',
      categories: [
        { name: 'ಪ್ರಾರಂಭಿಕ ಆಕರ್ಷಣ', score: categories[0].score, reason: hasHook ? 'ಆಕರ್ಷಣೆ ನೀಡಲಾಗಿದೆ; ಇದು ಸ್ಪಷ್ಟ ಕುತೂಹಲ ಅಂತರವನ್ನು ರಚಿಸುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ಪರೀಕ್ಷಿಸಿ।' : 'ಆಕರ್ಷಣೆ ಪಠ್ಯವನ್ನು ನೀಡಲಾಗಿಲ್ಲ, ಆದ್ದರಿಂದ ಆರಂಭವನ್ನು ಸಂಪೂರ್ಣವಾಗಿ ನಿರ್ಣಯಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ।' },
        { name: 'ಕಥೆ ಮತ್ತು ಸ್ಪಷ್ಟತೆ', score: categories[1].score, reason: hasCaption ? 'ವಿಷಯವನ್ನು ನಿರ್ಣಯಿಸಲು ಶೀರ್ಷಿಕೆ ಅಥವಾ ಸ್ಕ್ರಿಪ್ಟ್ ಲಭ್ಯವಿದೆ।' : 'ಉತ್ತಮ ಕಥೆ ನಿರ್ಣಯಕ್ಕಾಗಿ ಸಂಕ್ಷಿಪ್ತ ಸ್ಕ್ರಿಪ್ಟ್ ಅಥವಾ ಶೀರ್ಷಿಕೆ ಸೇರಿಸಿ।' },
        { name: 'ದೃಷ್ಟಿಗೋಚರ ಕಥೆ', score: categories[2].score, reason: input.frames.length ? 'ಫ್ರೇಮ್ ತೆಗೆದುಕೊಳ್ಳಲಾಗಿದೆ, ಆದರೆ ದೃಷ್ಟಿ AI ಈ ವಿಧಾನದಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ।' : 'ಪರಿಶೀಲನೆಗಾಗಿ ವೀಡಿಯೊ ಫ್ರೇಮ್ ಲಭ್ಯವಿರಲಿಲ್ಲ।' },
        { name: 'ಪ್ರೇಕ್ಷಕರ ಹೊಂದಾಣಿಕೆ', score: categories[3].score, reason: input.audience ? 'ಪ್ರೇಕ್ಷಕರನ್ನು ನಿರ್ದಿಷ್ಟಪಡಿಸಲಾಗಿದೆ; ಅವರ ಪ್ರಯೋಜನವನ್ನು ತಕ್ಷಣವೇ ಪ್ರাಸಂಗಿಕವಾಗಿ ಮಾಡಿ।' : 'ರೀಲ್ ಅನ್ನು ಹೆಚ್ಚು ಗುರಿಸಿದ್ಧವಾಗಿ ಮಾಡಲು ನಿರ್ದಿಷ್ಟ ಪ್ರೇಕ್ಷಕರನ್ನು ವ್ಯಾಖ್ಯಾನಿಸಿ।' },
        { name: 'ಹಂಚಿಕೆ ಮತ್ತು ಸಂರಕ್ಷಣ ಸಾಮರ್ಥ್ಯ', score: categories[4].score, reason: 'ಇದು ಅನುಮಾನವಾಗಿದೆ; ಪೋಸ್ಟ್ ಮಾಡುವ ಮೊದಲು ನೈಜ ಹಂಚಿಕೆ ನಿರ್ವಹಣೆ ತಿಳಿಯಲಾಗುವುದಿಲ್ಲ।' }
      ],
      recommendations: [
        hasHook ? 'ಆರಂಭವನ್ನು ಹೆಚ್ಚು ನಿರ್ದಿಷ್ಟವಾಗಿ ಮಾಡಿ: ಮೊದಲ 1–2 ಸೆಕೆಂಡಿನಲ್ಲಿ ಸ್ಪಷ್ಟ ಫಲಾಫಲ ಪ್ರತಿಶ್ರುತಿ ಅಥವಾ ಸಾಮಾನ್ಯ ಧಾರಣೆಗೆ ಸವಾಲು ಹಾಕಿ।' : 'ಸಂಪಾದನೆಯ ಮೊದಲು ಎಂಟು ಮುಖ್ಯ ಸಾಲನ್ನು ಬರೆಯಿರಿ। ಆಶ್ಚರ್ಯಸೂಚಕ ಫಲಾಫಲ, ನಿರ್ದಿಷ್ಟ ಸಮಸ್ಯೆ ಅಥವಾ ಸ್ಪಷ್ಟ ಪ್ರತಿಶ್ರುತಿ ಪ್ರಸ್ತುತ ಮಾಡಿ।',
        'ವಿರಾಮ ಮತ್ತು ಪುನರಾವರ್ತನೆ ಮಾಡಿದ ಬಿಂದುಗಳನ್ನು ತೆಗೆದುಹಾಕಿ; ಪ್ರತಿಟಿ ಕಟ್ ಮುಂದಿನ ಸೆಕೆಂಡನ್ನು ಪಡೆಯಲು ಯೋಗ್ಯವಾಗಿರಬೇಕು।',
        'ಓದಲು ಸುಲಭವಾದ, ಸ್ಪಷ್ಟ ಉಪಶೀರ್ಷಿಕೆಗಳನ್ನು ಸೇರಿಸಿ ಮತ್ತು ಮುಖ್ಯ ಪಠ್ಯವನ್ನು Instagram ಜೋಡಣೆಯಿಂದ ದೂರವಿರಿಸಿ।',
        'ನಿಮ್ಮ ಲಕ್ಷ್ಯಕ್ಕೆ ಹೊಂದಾಣಿಕೆ ಮಾಡುವ ನೈಸರ್ಗಿಕ ಕ್ರಿಯೆಯೊಂದಿಗೆ ಮುಗಿಸಿ: ಸಂರಕ್ಷಿಸಿ, ಸ್ನೇಹಿತನಿಗೆ ಕಳುಹಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಹೇಳಿ।'
      ],
      suggestedHook: `ನಿಲ್ಲಿಸಿ, ${input.niche.toLowerCase()} ಎಂಬುದನ್ನು ನೋಡಿ - ಈ ಸಂಗತಿಯನ್ನು ಬಹುಶಃ ಯಾರೂ ನಿಮಗೆ ಹೇಳಿಲ್ಲ।`,
      suggestedCaption: `${input.audience || 'ಆರಂಭಿಸಿದವರ'} ಎಂಬುದಕ್ಕಾಗಿ ${input.niche.toLowerCase()} ಮೇಲಿನ ಹಿಂದೆ ಒಂದು ಸಣ್ಣ ಸತ್ಯ ಸುಝಾವು. ನಂತರದ ಬಳಕೆಗಾಗಿ ಸಂರಕ್ಷಿಸಿ ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆ ಟೀಕೆಯಲ್ಲಿ ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಹೇಳಿ।`,
      trends: trendItems.slice(0, 4).map(t => ({ title: t.title, reason: 'ಇದು ಹುಡುಕಾಟ ಆಸಕ್ತಿಯ ಸೂಚನೆ; ನಕಲು ಮಾಡುವ ಬದಲಿಗೆ ನಿಮ್ಮ ವಿಷಯದ ಅನುಸಾರ ಅದನ್ನು ರೂಪಾಂತರಿಸಿ।' })),
      periodLabel: input.period === 'month' ? 'ತಿಂಗಳಿನ ಟ್ರೆಂಡ್ ವಿಷಯ' : 'ಸಪ್ತಾಹದ ಟ್ರೆಂಡ್ ವಿಷಯ',
      disclaimer: 'ಫಾಲ್‌ಬ್ಯಾಕ್ ಮೋಡ್: AI ಮಾದರಿ ಲಭ್ಯವಿರುವುದಿಲ್ಲ. ಸ್ಕೋರ್ ನಿಯಮ-ಆಧಾರಿತ ಅನುಮಾನಗಳು ಮತ್ತು ಟ್ರೆಂಡ್ ಸಾರ್ವಜನಿಕ ಹುಡುಕಾಟ ಸೂಚನೆಗಳಿಂದ, Instagram ವೈರಲಿಟಿ ಡೇಟಾ ಅಲ್ಲ।'
    },
    tamil: {
      label: 'உள்ளடக்க தயாரிப்பு',
      headline: score >= 70 ? 'நல்ல அஸ்திவாரம் உள்ளது, இப்போது விவரங்களை மேம்படுத்தவும்' : 'சிறிய மாற்றங்கள் வீடியோவை மேம்படுத்தக்கூடும்',
      summary: 'இது விதி-அடிப்படைக் குறிப்பாக உள்ளது, AI விமர்சனம் அல்லது பார்வைகளின் மதிப்பீடு அல்ல।',
      categories: [
        { name: 'தொடக்கக் கொக்கி', score: categories[0].score, reason: hasHook ? 'கொக்கி வழங்கப்பட்டுள்ளது; இது தெளிவான ஆர்வ இடைவெளியை உருவாக்குமா என்பதை சோதிக்கவும்.' : 'கொக்கி உரை வழங்கப்படவில்லை, எனவே உற்பத்திக் கூறுகளை முற்றிலுமாக மதிப்பீடு செய்ய முடியாது.' },
        { name: 'கதை மற்றும் தெளிவு', score: categories[1].score, reason: hasCaption ? 'தலைப்பு அல்லது ஸ்கிரிப்ட் செய்திக்கு மதிப்பீடு செய்ய உள்ளது.' : 'சிறந்த கதை மதிப்பீட்டுக்கான ஒரு சுருக்கமான ஸ்கிரிப்ட் அல்லது தலைப்பு சேர்க்கவும்.' },
        { name: 'பார்வை கதை சொல்லல்', score: categories[2].score, reason: input.frames.length ? 'பிரேம்கள் பிரித்தெடுக்கப்பட்டன, ஆனால் பார்வை AI இந்த முறையில் கிடைக்கவில்லை.' : 'பரிசோதனைக்கான வீடியோ பிரேம்கள் கிடைக்கவில்லை.' },
        { name: 'பார்வையாளர் பொருத்தம்', score: categories[3].score, reason: input.audience ? 'பார்வையாளர்கள் குறிப்பிடப்பட்டுள்ளனர்; அவர்களுக்கான நன்மை உடனடியாக பொருத்தமாக்கவும்.' : 'வீடியோவை மிகவும் লக্ష்যযुক்ததாக செய்ய குறிப்பிட்ட பார்வையாளர்களை வரையறுக்கவும்.' },
        { name: 'பகிர்வு மற்றும் சேமிப்பு சாத்தியம்', score: categories[4].score, reason: 'இது மதிப்பீடு; வெளியிட முன் உண்மையான பகிர்வு நடத்தை தெரியாது.' }
      ],
      recommendations: [
        hasHook ? 'தொடக்கத்தை மேலும் குறிப்பிட்டு மாக்கவும்: முதல் 1–2 வினாடிகளில் தெளிவான முடிவுக்கான வாக்குறுதி அல்லது பொதுவான நம்பிக்கைக்கு சவாலுண்டு பாலவேவும்.' : 'திருத்துவதற்கு முன் ஒரு எட்டு முக்கிய வரியை எழுதவும். ஆச்சரிய முடிவு, குறிப்பிட்ட சிக்கல் அல்லது தெளிவான வாக்குறுதி வழங்கவும்.',
        'இடைவேளை மற்றும் மீண்டும் மீண்டும் உள்ள புள்ளிகளை அகற்றவும்; ஒவ்வொரு கட்டும் அடுத்த வினாடியைப் பெற மதிப்பிடப்பட வேண்டும்।',
        'படிக்கவும் சுலபமாக, தெளிவான உபசரண ஆதாரங்களை சேர்க்கவும் மற்றும் முக்கிய உரையை Instagram ইন்টারফেஸிலிருந்து தொலைவில் வைக்கவும்।',
        'உங்கள் লক்ష்যுடன் பொருந்தக் கூடிய ஒரு প्राकृतिक कार्যযைத் முடிக்கவும்: சேமிக்கவும், ஒரு நண்பருக்கு அனுப்பவும் அல்லது உங்கள் கருத்து சொல்லவும்।'
      ],
      suggestedHook: `நிறுத்தவும், ${input.niche.toLowerCase()} ஐ பார்க்கவும் - இந்த விஷயம் ஬யர் யாரும் உங்களுக்கு சொல்லலை.`,
      suggestedCaption: `${input.audience || 'தொடங்குவதற்கு'} பொருட்டு ${input.niche.toLowerCase()} பற்றிய ஒரு சிறிய உண்மை. பின்வரும் வாழ்வுக்கான சேமிக்கவும் மற்றும் கருத்து மூலம் உங்கள் கருத்து சொல்லவும்.`,
      trends: trendItems.slice(0, 4).map(t => ({ title: t.title, reason: 'இது தேடல் ஆர்வத்தின் அறிகுறி; நகலெடுப்பதற்கு பதிலாக உங்கள் விஷயத்திற்கு அதை தழுவிக்கொள்ளவும்.' })),
      periodLabel: input.period === 'month' ? 'மாசு நடவடிக்கை விஷயம்' : 'வாரத்திய நடவடிக்கை விஷயம்',
      disclaimer: '஫ொல்ब்ैக் முறை: AI மாதிரி கிடைக்கவில்லை. ஸ்கோர் விதி-அடிப்படைக் மதிப்பீடு மற்றும் நடவடிக்கை பொது தேடல் அறிகுறிகள், Instagram வைரலிட்டி தரவு அல்ல।'
    }
  };
}

export async function onRequestPost({ request, env }) {
  let input;
  let trends = [];
  try {
    const form = await request.formData();
    // The browser extracts frames and sends only metadata, so the video size is not limited by the request body cap.
    const videoSize = Number(form.get('videoSize') || 0);
    const videoType = String(form.get('videoType') || '');
    if (!videoSize) return json({ error: 'Please upload a video.' }, 400);
    if (videoSize > MAX_VIDEO_BYTES) return json({ error: 'Video exceeds the 500 MB limit.' }, 413);
    if (!/^video\/(mp4|quicktime|webm|x-m4v)$/i.test(videoType)) return json({ error: 'Use an MP4, MOV or WebM video.' }, 415);
    const language = String(form.get('language') || 'en');
    input = {
      niche: String(form.get('niche') || 'General').slice(0, 100), audience: String(form.get('audience') || '').slice(0, 240),
      hook: String(form.get('hook') || '').slice(0, 2000), caption: String(form.get('caption') || '').slice(0, 6000),
      period: form.get('period') === 'month' ? 'month' : 'week', goal: String(form.get('goal') || 'Reach and shares').slice(0, 100),
      language: LANGUAGE_NAMES[language] ? language : 'en', frames: []
    };
    try { input.frames = JSON.parse(String(form.get('frames') || '[]')).filter(x => typeof x === 'string' && x.startsWith('data:image/jpeg;base64,')).slice(0, 3); } catch {}
    try { const t = await fetch(new URL('/api/trends', request.url), { headers: { accept: 'application/json' } }); if (t.ok) trends = ((await t.json()).trends || []).slice(0, 8); } catch {}
    if (!env.AI) return json(localize(fallback(input, trends), input.language));
    const prompt = `You are a careful Instagram Reels content coach. Review the supplied frame images (if any) and creator-provided text. Never claim you know Instagram's ranking system, future reach, live viral audio, or exact virality probability. Use the trends list only as public search-interest context, not Instagram trend proof. Return ONLY valid JSON with schema: {"score":integer 0-100,"label":"CONTENT READINESS","headline":string,"summary":string,"categories":[{"name":"Opening hook","score":0-100,"reason":string},{"name":"Story & clarity","score":0-100,"reason":string},{"name":"Visual storytelling","score":0-100,"reason":string},{"name":"Audience fit","score":0-100,"reason":string},{"name":"Share & save potential","score":0-100,"reason":string}],"recommendations":[string,string,string,string],"hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"],"suggestedHook":string,"suggestedCaption":string,"trends":[{"title":string,"reason":string}],"periodLabel":string,"disclaimer":string}. Write every user-facing text field (label, headline, summary, category names and reasons, recommendations, suggestedHook, suggestedCaption, trend reasons, periodLabel, disclaimer) only in ${LANGUAGE_NAMES[input.language]}, using natural, creator-friendly wording rather than transliterated English. Keep scores, the exact five hashtags and public trend titles unchanged. Give exactly 5 relevant, non-spammy hashtags; mix niche and broader tags. Avoid generic #viral/#fyp unless justified. Scores measure content readiness, never predict views. Make recommendations concrete and refer to visible evidence only when supported by frames. suggestedHook must be a punchy, specific rewrite of the opening 1-3 seconds (first-person, ready to use on screen); suggestedCaption must be a ready-to-post caption matching the niche, audience and goal. If info is missing, write plausible, honest suggestions rather than leaving them blank. Use the requested period to label trend angles. Include up to 4 trend items from the provided public data; do not invent live trends.\nCreator input: ${JSON.stringify({niche:input.niche,audience:input.audience,hook:input.hook,caption:input.caption,goal:input.goal,period:input.period,publicTrendSignals:trends.map(t=>({title:t.title,traffic:t.traffic}))})}`;
    let messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];
    for (const frame of input.frames) messages[0].content.push({ type: 'image_url', image_url: { url: frame } });
    let result;
    let aiMode = 'ai-vision';
    try {
      result = await env.AI.run(MODEL, {
        messages,
        max_tokens: 2400,
        chat_template_kwargs: { enable_thinking: false }
      });
    } catch (visionError) {
      // If vision inference is unavailable, retry with GLM-4.7-Flash (text-only).
      aiMode = 'ai-text-only';
      result = await env.AI.run(TEXT_MODEL, {
        messages: [{ role: 'user', content: prompt + '\nNOTE: Vision processing was unavailable. Do not claim to have seen video frames; assess only the text provided.' }],
        max_tokens: 2400
      });
    }
    const raw = extractText(result);
    const parsed = parseJson(raw);
    const categories = Array.isArray(parsed.categories) ? parsed.categories.slice(0, 5).map(c => ({ name: String(c.name || 'Category').slice(0, 80), score: clamp(c.score), reason: String(c.reason || '').slice(0, 350) })) : [];
    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5).map(x => String(x).slice(0, 500)) : [];
    let hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 5).map(x => { const tag = String(x).replace(/[^#\p{L}\p{N}_]/gu, ''); return tag.startsWith('#') ? tag : '#'+tag; }) : [];
    while (hashtags.length < 5) hashtags.push(['#reelscreator','#contentstrategy','#creatorcommunity','#reelsideas','#instagramtips'][hashtags.length]);
    return json({ mode: aiMode, score: clamp(parsed.score), label: String(parsed.label || 'CONTENT READINESS'), headline: String(parsed.headline || 'Your report is ready').slice(0, 140), summary: String(parsed.summary || '').slice(0, 500), categories, recommendations: recs, hashtags, suggestedHook: String(parsed.suggestedHook || '').slice(0, 200), suggestedCaption: String(parsed.suggestedCaption || '').slice(0, 400), trends: Array.isArray(parsed.trends) ? parsed.trends.slice(0, 4).map(t => ({title:String(t.title||'').slice(0,120),reason:String(t.reason||'').slice(0,220)})) : [], periodLabel: String(parsed.periodLabel || (input.period === 'month' ? 'Monthly trend angles' : 'Weekly trend angles')), disclaimer: String(parsed.disclaimer || 'Content-readiness score only; not a guarantee of reach or virality.').slice(0, 400), language: input.language });
  } catch (err) {
    // Keep the product usable when a model is unavailable, its quota is exhausted,
    // or the model returns malformed JSON. The UI will clearly label this as fallback.
    if (input) {
      const result = localize(fallback(input, trends), input.language);
      result.aiError = String(err?.message || 'Workers AI request failed').slice(0, 180);
      return json(result);
    }
    return json({ error: 'Could not read the uploaded video. Please try an MP4, MOV, or WebM file under 500 MB.', detail: String(err?.message || '').slice(0, 180) }, 500);
  }
}
