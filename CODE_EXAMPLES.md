# VYOM - Code Implementation Examples

## 1. Frontend Language Selection (index.html)

### HTML Markup
```html
<!-- Language Selector -->
<div class="report-language">
  <label for="report-language">Output language</label>
  <select id="report-language">
    <option value="en">English</option>
    <option value="hi">हिंदी</option>
    <option value="kn">ಕನ್ನಡ</option>
    <option value="ta">தమిழ்</option>
  </select>
</div>
```

### JavaScript Language Handling
```javascript
let reportLanguage = 'en';
let latestReport = null;
const renderEnglishReport = renderReport;

// Update renderReport to support all 4 languages
renderReport = function(data) {
  latestReport = data;
  const localized = 
    reportLanguage === 'hi' && data.hindi ? data.hindi :
    reportLanguage === 'kn' && data.kannada ? data.kannada :
    reportLanguage === 'ta' && data.tamil ? data.tamil :
    data;
  
  renderEnglishReport({
    ...data,
    ...localized,
    score: data.score,           // Scores stay consistent
    hashtags: data.hashtags,     // Hashtags stay consistent
    mode: data.mode
  });
};

// Listen for language changes
$('report-language').addEventListener('change', event => {
  reportLanguage = event.target.value;
  if (latestReport) renderReport(latestReport);
});
```

---

## 2. Loader Animation (styles.css)

### Spinner Animation
```css
/* Define rotation animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Define pulsing animation */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Loader Container */
.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px 22px;
  text-align: center;
  min-height: 260px;
}

/* Animated Spinner */
.loader-spinner {
  width: 60px;
  height: 60px;
  border: 3px solid #3a292a;              /* Dark background border */
  border-top-color: #f28387;              /* Red accent (matches vyom theme) */
  border-radius: 50%;
  animation: spin 1.2s linear infinite;   /* Continuous rotation */
}

/* Animated Loading Text */
.loader-text {
  font-size: 14px;
  color: var(--muted);
  animation: pulse 1.5s ease-in-out infinite;  /* Pulsing opacity */
}
```

### HTML Markup
```html
<div class="loader-container" id="loader" style="display:none">
  <div class="loader-spinner"></div>
  <div class="loader-text">Analyzing your reel...</div>
</div>
```

---

## 3. Loader Control Functions (index.html)

### JavaScript Functions
```javascript
// Show loader during analysis
function showLoader() {
  $('loader').style.display = 'flex';
  $('status').textContent = '';
}

// Hide loader after analysis completes
function hideLoader() {
  $('loader').style.display = 'none';
}

// Usage in analysis flow
async function runAnalysis() {
  if (!selectedFile || analyzing) return;
  
  analyzing = true;
  const btn = $('analyze');
  btn.disabled = true;
  btn.textContent = 'Analyzing your reel…';
  
  // ✅ SHOW LOADER
  showLoader();
  
  try {
    const frames = await framesFromVideo(selectedFile);
    const fd = new FormData();
    fd.append('video', selectedFile);
    fd.append('frames', JSON.stringify(frames));
    // ... other form data ...
    
    const res = await fetch('/api/analyze', {method: 'POST', body: fd});
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Analysis failed');
    
    // ✅ HIDE LOADER
    hideLoader();
    
    // ✅ RENDER RESULTS
    renderReport(data);
    setStatus('Analysis completed...');
    
  } catch (err) {
    hideLoader();
    setStatus(err.message || 'Could not analyze video.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Analyze my reel';
    analyzing = false;
  }
}
```

---

## 4. Backend Language Support (functions/api/analyze.js)

### Kannada Translation Object
```javascript
kannada: {
  label: 'ಸಾಮಗ್ರಿ ಸಿದ್ಧತೆ',
  headline: score >= 70 ? 'ಚೆನ್ನಾಗಿ ಪ್ರಾರಂಭವಾಗಿದೆ, ಈಗ ವಿವರಗಳು ಸುಧಾರಿಸಿ' : 
    'ಕೆಲವು ಸಣ್ಣ ಪರಿವರ್ತನೆಗಳು ರೀಲ್ ಅನ್ನು ಉತ್ತಮಗೊಳಿಸುತ್ತವೆ',
  summary: 'ಇದು ನಿಯಮ-ಆಧಾರಿತ ಆರಂಭಿಕ ಮೂಲ್ಯಮಾಪನವಾಗಿದೆ...',
  categories: [
    {
      name: 'ಪ್ರಾರಂಭಿಕ ಆಕರ್ಷಣ',
      score: 70,
      reason: 'ಆಕರ್ಷಣೆ ನೀಡಲಾಗಿದೆ; ಇದು ಸ್ಪಷ್ಟ ಕುತೂಹಲ ಅಂತರವನ್ನು ರಚಿಸುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ಪರೀಕ್ಷಿಸಿ।'
    },
    // ... more categories ...
  ],
  recommendations: [
    'ಆರಂಭವನ್ನು ಹೆಚ್ಚು ನಿರ್ದಿಷ್ಟವಾಗಿ ಮಾಡಿ...',
    // ... more recommendations ...
  ],
  suggestedHook: 'ನಿಲ್ಲಿಸಿ, ಫಿಟ್ನೆಸ್ನ ಬಗ್ಗೆ ನೋಡಿ - ಈ ಸಂಗತಿಯನ್ನು ಬಹುಶಃ ಯಾರೂ ನಿಮಗೆ ಹೇಳಿಲ್ಲ।',
  suggestedCaption: '...',
  trends: [
    { title: 'trend-name', reason: 'ಇದು ಹುಡುಕಾಟ ಆಸಕ್ತಿಯ ಸೂಚನೆ...' }
  ],
  periodLabel: 'ತಿಂಗಳಿನ ಟ್ರೆಂಡ್ ವಿಷಯ',
  disclaimer: 'ಫಾಲ್‌ಬ್ಯಾಕ್ ಮೋಡ್...'
}
```

### Tamil Translation Object
```javascript
tamil: {
  label: 'உள்ளடக்க தயாரிப்பு',
  headline: score >= 70 ? 'நல்ல அஸ்திவாரம் உள்ளது...' : 
    'சிறிய மாற்றங்கள் வீடியோவை மேம்படுத்தக்கூடும்',
  summary: 'இது விதி-அடிப்படைக் குறிப்பாக உள்ளது...',
  categories: [
    {
      name: 'தொடக்கக் கொக்கி',
      score: 70,
      reason: 'கொக்கி வழங்கப்பட்டுள்ளது; இது தெளிவான ஆர்வ இடைவெளியை உருவாக்குமா...'
    },
    // ... more categories ...
  ],
  recommendations: [
    'தொடக்கத்தை மேலும் குறிப்பிட்டு மாக்கவும்...',
    // ... more recommendations ...
  ],
  suggestedHook: 'நிறுத்தவும், ஃபிட்னெஸ் ஐ பார்க்கவும் - இந்த விஷயம் ஬யர் யாரும் உங்களுக்கு சொல்லலை.',
  suggestedCaption: '...',
  trends: [
    { title: 'trend-name', reason: 'இது தேடல் ஆர்வத்தின் அறிகுறி...' }
  ],
  periodLabel: 'வாரத்திய நடவடிக்கை விஷயம்',
  disclaimer: 'ஃஃொல்ப்ैक் முறை...'
}
```

### Response Structure
```javascript
// Backend returns all languages
return json({
  mode: aiMode,
  score: 75,
  label: 'CONTENT READINESS',
  headline: 'Your reel report is ready',
  summary: 'Use these recommendations...',
  categories: [...],
  recommendations: [...],
  hashtags: ['#tag1', '#tag2', ...],
  
  // All 3 regional languages
  hindi: { ... },      // हिंदी
  kannada: { ... },    // ಕನ್ನಡ
  tamil: { ... }       // தமிழ்
});
```

---

## 5. Data Flow Diagram

```
User Interaction Flow:
========================

1. Upload Video
   ↓
2. Fill Details (niche, audience, hook, caption)
   ↓
3. Click "Analyze my reel"
   ↓
4. showLoader() — Display spinning loader
   ↓
5. Extract video frames
   ↓
6. Send FormData to /api/analyze
   ↓
7. Backend processes (AI or fallback)
   ↓
8. Backend returns JSON with all 4 languages
   ↓
9. hideLoader() — Hide spinner
   ↓
10. renderReport(data) — Show English results
    ↓
11. User switches language dropdown
    ↓
12. renderReport(data) — Show selected language
    ↓
13. Loop back to step 11 for different language
```

---

## 6. Translation Consistency

### Score & Hashtags (Consistent Across All Languages)
```javascript
// These NEVER change regardless of language
score: 75,                                    // Same number
hashtags: ['#reelscreator', '#contentcreator', '#explorepage'],  // Same tags
```

### Translated Content (Language-Specific)
```javascript
// These change based on selected language
headline: "Your reel report is ready" 
  → "आपकी रील रिपोर्ट तैयार है"
  → "ನಿಮ್ಮ ರೀಲ್ ವರದಿ ಸಿದ್ಧವಾಗಿದೆ"
  → "உங்கள் வீடியோ அறிக்கை தயாரமாக உள்ளது"
```

---

## 7. Error Handling with Multilingual Support

```javascript
// When AI is unavailable, fallback still provides all languages
function fallback(input, trendItems) {
  return {
    mode: 'fallback',
    score: calculatedScore,
    label: 'CONTENT READINESS',
    headline: 'Score-based message',
    
    // Always include all 4 languages
    hindi: { /* Hindi translations */ },
    kannada: { /* Kannada translations */ },
    tamil: { /* Tamil translations */ }
  };
}

// No language-specific errors; all gracefully fall back
```

---

## 8. Mobile Responsiveness

The loader works seamlessly on mobile:

```css
/* Loader adapts to mobile */
@media(max-width: 480px) {
  .loader-container {
    padding: 24px 16px;
    min-height: 220px;
  }
  
  .loader-spinner {
    width: 50px;
    height: 50px;
  }
  
  .loader-text {
    font-size: 13px;
  }
}
```

---

## Summary

✅ **Frontend**: HTML + JavaScript for language selection and loader control
✅ **Styling**: CSS animations for smooth, professional loading experience
✅ **Backend**: Full translation support in 4 languages
✅ **UX**: Seamless language switching without re-analysis
✅ **Consistency**: Scores and hashtags remain unified across languages
✅ **Fallback**: All languages available even without AI

