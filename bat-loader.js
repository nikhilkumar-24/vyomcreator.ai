// Bat-carried progress loader shared by the hooks analysis and Captions Studio.
// VyomLoader.show(title) opens it, VyomLoader.set(percent, text) animates 0→100, VyomLoader.hide() closes it.
(function () {
  const BAT = '<svg class="vl-bat" viewBox="0 0 100 50" aria-hidden="true">' +
    '<g class="vl-wings"><path d="M46 24C34 8 18 4 2 10C12 16 16 22 18 30C26 26 34 28 46 32Z"/>' +
    '<path d="M54 24C66 8 82 4 98 10C88 16 84 22 82 30C74 26 66 28 54 32Z"/></g>' +
    '<path class="vl-body" d="M45 8L47 12C48 11 49 10.5 50 10.5C51 10.5 52 11 53 12L55 8C53 13 52 16 50 19C44 19 42 24 42 30C42 36 46 40 50 40C54 40 58 36 58 30C58 24 56 19 50 19C48 16 47 13 45 8Z"/></svg>';

  const CSS = `
#vl-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,10,10,.86);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:inherit}
#vl-overlay[hidden]{display:none}
#vl-card{width:min(92vw,440px);border-radius:18px;background:#111111;border:1px solid #27272a;box-shadow:0 20px 60px rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;padding:24px 28px 28px;color:#fafafa;text-align:center;box-sizing:border-box}
#vl-stage{position:relative;width:100%;height:150px}
#vl-carry{position:absolute;inset:0;animation:vl-bob 2.4s ease-in-out infinite}
@keyframes vl-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.vl-bat{position:absolute;top:6px;width:64px;height:32px;margin-left:-32px;color:#fafafa;overflow:visible}
.vl-bat:nth-of-type(1){left:12%}
.vl-bat:nth-of-type(2){left:36%;top:0}
.vl-bat:nth-of-type(3){left:64%;top:0}
.vl-bat:nth-of-type(4){left:88%;top:6px}
.vl-bat .vl-wings{transform-box:view-box;transform-origin:50px 26px;animation:vl-flap .4s ease-in-out infinite alternate}
.vl-bat:nth-of-type(2) .vl-wings{animation-duration:.34s}
.vl-bat:nth-of-type(3) .vl-wings{animation-duration:.46s}
.vl-bat:nth-of-type(4) .vl-wings{animation-duration:.38s}
.vl-bat path{fill:currentColor}
@keyframes vl-flap{from{transform:scaleY(1)}to{transform:scaleY(.25)}}
.vl-cord{position:absolute;top:38px;height:72px;width:1px;background:#52525b;margin-left:-.5px}
#vl-rail{position:absolute;left:6%;right:6%;top:110px;height:12px;border-radius:999px;background:#27272a;border:1px solid #3f3f46;box-sizing:border-box;overflow:hidden}
#vl-fill{height:100%;width:0;background:#fafafa}
#vl-title{margin-top:18px;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#a1a1aa;font-weight:600}
#vl-pct{margin-top:6px;font-size:44px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.1}
#vl-text{margin-top:10px;min-height:20px;font-size:14px;color:#a1a1aa}
@media (prefers-reduced-motion:reduce){#vl-carry,.vl-bat .vl-wings{animation:none}}
`;

  let root, pctEl, fillEl, textEl, titleEl, raf = 0, shown = 0, target = 0;

  function build() {
    if (root) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'vl-overlay';
    root.hidden = true;
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    const cords = [12, 36, 64, 88].map(x => '<span class="vl-cord" style="left:' + x + '%"></span>').join('');
    root.innerHTML = '<div id="vl-card">' +
      '<div id="vl-stage"><div id="vl-carry">' + BAT + BAT + BAT + BAT + cords +
      '<div id="vl-rail"><div id="vl-fill"></div></div></div></div>' +
      '<div id="vl-title"></div><div id="vl-pct">0%</div><div id="vl-text"></div></div>';
    document.body.appendChild(root);
    pctEl = root.querySelector('#vl-pct');
    fillEl = root.querySelector('#vl-fill');
    textEl = root.querySelector('#vl-text');
    titleEl = root.querySelector('#vl-title');
  }

  // Eases the displayed number toward the target so the counter visibly climbs 0→100.
  function tick() {
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.2) shown = target;
    pctEl.textContent = Math.round(shown) + '%';
    fillEl.style.width = shown + '%';
    raf = shown !== target ? requestAnimationFrame(tick) : 0;
  }

  window.VyomLoader = {
    show(title) {
      build();
      cancelAnimationFrame(raf);
      raf = 0;
      shown = 0;
      target = 0;
      pctEl.textContent = '0%';
      fillEl.style.width = '0%';
      titleEl.textContent = title || 'Working';
      textEl.textContent = '';
      root.hidden = false;
    },
    set(percent, text) {
      if (!root) return;
      target = Math.max(0, Math.min(100, Math.round(percent)));
      if (text) textEl.textContent = text;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    hide() {
      if (!root) return;
      cancelAnimationFrame(raf);
      raf = 0;
      root.hidden = true;
    }
  };
})();
