// Vyo chat widget, shared by every page. Change BOT_NAME to rename the assistant.
(function () {
  const BOT_NAME = 'Vyo';
  const GREETING = `Hi, I'm ${BOT_NAME}. Ask me about hooks, SFX, beat timing or captions.`;

  const ROBOT = `<svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false"><line x1="32" y1="6" x2="32" y2="13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="5" r="3.5" fill="currentColor"/><rect x="12" y="13" width="40" height="32" rx="10" fill="currentColor"/><circle cx="24" cy="28" r="5" fill="#0a0a0a"/><circle cx="40" cy="28" r="5" fill="#0a0a0a"/><circle cx="25" cy="27" r="1.8" fill="currentColor"/><circle cx="41" cy="27" r="1.8" fill="currentColor"/><rect x="23" y="37" width="18" height="4" rx="2" fill="#0a0a0a"/><rect x="18" y="48" width="28" height="10" rx="5" fill="currentColor"/><rect x="5" y="25" width="5" height="11" rx="2.5" fill="currentColor"/><rect x="54" y="25" width="5" height="11" rx="2.5" fill="currentColor"/></svg>`;

  const CSS = `
#vc-launch{position:fixed;right:20px;bottom:20px;z-index:8000;display:flex;align-items:center;gap:8px;height:52px;padding:0 18px 0 6px;border:1px solid #27272a;border-radius:999px;background:#fafafa;color:#0a0a0a;font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#vc-launch:hover{background:#e4e4e7}
#vc-launch:focus-visible,#vc-close:focus-visible,#vc-send:focus-visible,#vc-input:focus-visible,.vc-link:focus-visible{outline:2px solid #fafafa;outline-offset:2px}
.vc-robot{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#0a0a0a;color:#fafafa;flex:none}
#vc-launch .vc-robot{background:#0a0a0a;color:#fafafa}
#vc-panel .vc-robot{width:36px;height:36px;background:#27272a;color:#fafafa}
#vc-panel{position:fixed;right:20px;bottom:84px;z-index:8000;width:min(calc(100vw - 40px),360px);height:min(520px,calc(100vh - 140px));display:none;flex-direction:column;border:1px solid #27272a;border-radius:16px;background:#111111;color:#fafafa;box-shadow:0 20px 60px rgba(0,0,0,.6);font:14px/1.5 Inter,system-ui,sans-serif;overflow:hidden}
#vc-panel.open{display:flex}
#vc-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #27272a}
#vc-head .vc-titles{flex:1;min-width:0}
#vc-title{font-weight:600;font-size:15px}
#vc-sub{font-size:12px;color:#a1a1aa}
#vc-close{width:32px;height:32px;border:1px solid #27272a;border-radius:8px;background:transparent;color:#a1a1aa;font-size:18px;line-height:1;cursor:pointer}
#vc-close:hover{color:#fafafa;border-color:#3f3f46}
#vc-log{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.vc-msg{max-width:85%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}
.vc-bot{align-self:flex-start;background:#18181b;border:1px solid #27272a}
.vc-user{align-self:flex-end;background:#fafafa;color:#0a0a0a}
.vc-typing{color:#a1a1aa;font-size:13px}
.vc-links{align-self:flex-start;display:flex;flex-direction:column;gap:6px;max-width:85%}
.vc-link{display:block;padding:8px 12px;border:1px solid #27272a;border-radius:10px;color:#fafafa;text-decoration:none;font-size:13px}
.vc-link:hover{border-color:#52525b;background:#18181b}
.vc-link span{display:block;color:#a1a1aa;font-size:12px}
#vc-form{display:flex;gap:8px;padding:12px;border-top:1px solid #27272a}
#vc-input{flex:1;min-width:0;height:40px;padding:0 12px;border:1px solid #27272a;border-radius:10px;background:#0a0a0a;color:#fafafa;font:inherit}
#vc-input::placeholder{color:#71717a}
#vc-send{height:40px;padding:0 14px;border:0;border-radius:10px;background:#fafafa;color:#0a0a0a;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}
#vc-send:disabled{opacity:.5;cursor:not-allowed}
@media (max-width:480px){#vc-launch{right:14px;bottom:14px}#vc-panel{right:12px;bottom:78px}}
`;

  const history = [];
  let log, form, input, send, panel, launch;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function addMessage(role, text) {
    const node = el('div', 'vc-msg ' + (role === 'user' ? 'vc-user' : 'vc-bot'), text);
    log.appendChild(node);
    log.scrollTop = log.scrollHeight;
    return node;
  }

  function addLinks(links) {
    const safe = (Array.isArray(links) ? links : []).filter(l => l && typeof l.url === 'string' && l.url.startsWith('/') && !l.url.startsWith('//'));
    if (!safe.length) return;
    const wrap = el('div', 'vc-links', null);
    safe.forEach(l => {
      const a = el('a', 'vc-link', String(l.title || l.url));
      a.href = l.url;
      if (l.summary) a.appendChild(el('span', null, String(l.summary)));
      wrap.appendChild(a);
    });
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  function build() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    launch = el('button', null, null);
    launch.id = 'vc-launch';
    launch.type = 'button';
    launch.setAttribute('aria-label', 'Chat with ' + BOT_NAME);
    launch.setAttribute('aria-expanded', 'false');
    launch.setAttribute('aria-controls', 'vc-panel');
    const launchRobot = el('span', 'vc-robot', null);
    launchRobot.innerHTML = ROBOT;
    launch.append(launchRobot, el('span', null, 'Chat with ' + BOT_NAME));

    panel = el('div', null, null);
    panel.id = 'vc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', BOT_NAME + ' chat');

    const head = el('div', null, null);
    head.id = 'vc-head';
    const headRobot = el('span', 'vc-robot', null);
    headRobot.innerHTML = ROBOT;
    const titles = el('div', 'vc-titles', null);
    titles.append(el('div', null, BOT_NAME), el('div', null, 'Finds pages on VYOM AI and answers with AI'));
    titles.firstChild.id = 'vc-title';
    titles.lastChild.id = 'vc-sub';
    const close = el('button', null, '×');
    close.id = 'vc-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close chat');
    head.append(headRobot, titles, close);

    log = el('div', null, null);
    log.id = 'vc-log';
    log.setAttribute('aria-live', 'polite');

    form = el('form', null, null);
    form.id = 'vc-form';
    input = el('input', null, null);
    input.id = 'vc-input';
    input.type = 'text';
    input.maxLength = 1000;
    input.placeholder = 'Ask a question…';
    input.setAttribute('aria-label', 'Your message');
    send = el('button', null, 'Send');
    send.id = 'vc-send';
    send.type = 'submit';
    form.append(input, send);

    panel.append(head, log, form);
    document.body.append(panel, launch);

    addMessage('bot', GREETING);
    launch.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    close.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    form.addEventListener('submit', e => { e.preventDefault(); ask(); });
  }

  function setOpen(open) {
    panel.classList.toggle('open', open);
    launch.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  }

  async function ask() {
    const text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = '';
    addMessage('user', text);
    history.push({ role: 'user', content: text });
    send.disabled = true;
    const typing = el('div', 'vc-msg vc-bot vc-typing', BOT_NAME + ' is typing…');
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;
    let reply = 'Sorry, something went wrong. Please try again.';
    let links = [];
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) })
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.reply === 'string' && data.reply) reply = data.reply;
      if (Array.isArray(data.links)) links = data.links;
    } catch (err) {
      // Keep the default reply when the network request fails.
    }
    typing.remove();
    addMessage('bot', reply);
    addLinks(links);
    history.push({ role: 'assistant', content: reply });
    send.disabled = false;
    input.focus();
  }

  function init() {
    if (document.getElementById('vc-launch')) return;
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
