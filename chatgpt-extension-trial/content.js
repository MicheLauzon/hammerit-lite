// HammerIT lite for chatgpt.com: Trinity's trial copy of 0.15 (25 Nov 2026). Same panel and engine as claude.ai;
// only the page reading changes. Chats are saved as gpt-<id> so they stay apart from the claude.ai chats.
// HammerIT lite for claude.ai. 0.15, 22 November 2026.
// Purpose: a person generates a record of how they worked with the AI. The reader drafts it, the person verifies it.
// The H beside Share tracks the chat as it is read. Click it for the panel: one reading at a time, a tick to confirm,
// a tap on a word to change it, every message as a circle, then Generate record (light on this computer, full on request).
// First view after the demo by Trinity. Reads the conversation on this page and posts it to the local engine.
(() => {
  if (window.__hammerit09) return;
  window.__hammerit09 = true;
  const VERSION = '0.15.0-chatgpt-trial';
  const TEST = window.__hammeritTest || {};
  const ENGINE = TEST.engine || 'http://127.0.0.1:4333';

  // chatgpt.com marks each message with its author's role
  const USER_SEL = '[data-message-author-role="user"]';
  const CLAUDE_SEL = '[data-message-author-role="assistant"]';
  // /c/<id>, also inside a GPT or a project: /g/<gpt>/c/<id>
  function conversationId() { if (TEST.conv) return TEST.conv; const m = location.pathname.match(/\/c\/([0-9a-f-]{20,})/i); return m ? 'gpt-' + m[1] : null; }
  const CHROME_LINE = /^(ChatGPT said:|You said:|[-\s]+$|(just now|\d+\s*(second|minute|hour|day|week|month|year)s?\s*ago)$|(edited|retry|copy|share|good response|bad response)$)/i;
  function messageText(n) {
    const kept = [];
    for (const raw of (n.innerText || '').split('\n')) {
      const l = raw.replace(/[-]/g, '').trim();
      if (raw.trim() && !l) continue;
      if (CHROME_LINE.test(l)) continue;
      kept.push(l);
    }
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // ChatGPT trial (25 Nov page check): each turn is [data-turn-key] holding your bubble ([data-user-message-bubble])
  // and the reply ([data-markdown-text-style="assistant-message"]). ChatGPT keeps only a few turns on the page and drops
  // the rest as you scroll, so turns already seen are remembered, in page order, for as long as this chat is open.
  let TURNS = { conv: null, order: [], seen: {} };
  function readConversation() {
    const conv = conversationId();
    if (TURNS.conv !== conv) TURNS = { conv, order: [], seen: {} };
    const onPage = [...document.querySelectorAll('[data-turn-key]')].filter((n, i, all) => !all.some(o => o !== n && o.contains(n)));
    const keys = onPage.map(n => n.getAttribute('data-turn-key'));
    keys.forEach((k, j) => {
      if (TURNS.order.includes(k)) return;
      const after = keys.slice(j + 1).find(x => TURNS.order.includes(x));   // a turn found above ones already seen goes before them
      if (after) TURNS.order.splice(TURNS.order.indexOf(after), 0, k); else TURNS.order.push(k);
    });
    onPage.forEach((t, j) => {
      const you = [...t.querySelectorAll('[data-user-message-bubble]')];
      const ai = [...t.querySelectorAll('[data-markdown-text-style="assistant-message"]')];
      const fallbackAi = ai.length ? ai : [...t.querySelectorAll('[data-response-body]')];
      TURNS.seen[keys[j]] = {
        you: you.length ? { text: you.map(messageText).join('\n\n'), node: you[0] } : null,
        ai: fallbackAi.length ? { text: fallbackAi.map(messageText).join('\n\n'), node: fallbackAi[0] } : null,
      };
    });
    const out = [];
    for (const k of TURNS.order) {
      const t = TURNS.seen[k]; if (!t) continue;
      if (t.you && t.you.text) out.push({ who: 'you', text: t.you.text, node: t.you.node });
      if (t.ai && t.ai.text) out.push({ who: 'claude', text: t.ai.text, node: t.ai.node });
    }
    return out.map((m, i) => Object.assign(m, { i }));
  }
  // ChatGPT trial: when no message of yours is found, the panel says what the page marks (names only, no text)
  function pageMarks() {
    const out = {};
    document.querySelectorAll('main *').forEach(e => { for (const a of e.attributes) if (/^data-(message|turn|testid|user-message|markdown)/.test(a.name)) { const k = a.name + '=' + a.value.replace(/[0-9a-f]{8,}[0-9a-f-]*/gi, 'ID').slice(0, 30); out[k] = (out[k] || 0) + 1; } });
    return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ×' + v).join(' · ') || 'none';
  }
  // ChatGPT trial: the layout of the first two turns, for fixing the reading. Names, classes and text lengths only.
  function pageCheck() {
    const lines = ['HammerIT ChatGPT page check ' + new Date().toISOString(), 'url path: ' + location.pathname.replace(/[0-9a-f-]{20,}/g, 'ID')];
    const turns = [...document.querySelectorAll('[data-turn-key]')];
    lines.push('turns: ' + turns.length);
    const walk = (el, d) => {
      if (d > 9 || lines.length > 400) return;
      const attrs = [...el.attributes].filter(a => /^(data-|role$|aria-label$|dir$)/.test(a.name)).map(a => a.name + '=' + String(a.value).replace(/[0-9a-f]{8,}[0-9a-f-]*/gi, 'ID').slice(0, 40)).join(' ');
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim().length;
      lines.push('  '.repeat(d) + el.tagName.toLowerCase() + (attrs ? ' [' + attrs + ']' : '') + (el.className && typeof el.className === 'string' ? ' .' + el.className.trim().split(/\s+/).slice(0, 12).join('.') : '') + ' text=' + (el.innerText || '').length + (own ? ' own=' + own : ''));
      [...el.children].forEach(c => walk(c, d + 1));
    };
    turns.slice(0, 2).forEach((t, k) => { lines.push('--- turn ' + k); walk(t, 0); });
    return lines.join('\n');
  }


  // Drawing, inside a shadow root.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:24px;left:24px;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", "SF Pro Text", Helvetica, Arial, sans-serif; }
    .wrap { --bg:#ffffff; --ink:#1c2026; --mute:#5c646e; --line:#d6dad3; --soft:#eef0ec; --accent:#2d5f72; --hollow:#b9c2cc; --ok:#2f7a45; --ask:#f3f7fb; --alert:#e5484d; --on:#ffffff;
      --acc:#2f7a45; --que:#3b7dc4; --cor:#c98a1a; --rej:#a3432f; --dir:#6b4e8a; }
    @media (prefers-color-scheme: dark) { .wrap { --bg:#1c2026; --ink:#e4e6e1; --mute:#9aa2ab; --line:#2f353c; --soft:#20252b; --accent:#86bccd; --hollow:#55636f; --ok:#86cf98; --ask:#1f2a35; --alert:#ff6b6b; --on:#10181c;
      --acc:#86cf98; --que:#8cc3f2; --cor:#e8b04b; --rej:#e58c77; --dir:#c2a6e0; } }
    button { font-family: inherit; }
    .hb { width:40px; height:40px; border:0; background:none; padding:0; cursor:pointer; line-height:0; border-radius:50%; filter:drop-shadow(0 3px 7px rgba(18,26,34,.22)); }
    .hb:focus-visible, button:focus-visible, input:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .panel { position:fixed; width:min(340px, calc(100vw - 32px)); max-height:min(640px, calc(100vh - 96px)); overflow-y:auto; background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:14px; box-shadow:0 16px 40px rgba(18,26,34,.22); padding:10px; display:grid; gap:9px; font-size:13px; line-height:1.4; }
    .panel[hidden] { display:none; }
    .d { display:inline-block; width:14px; height:14px; border-radius:50%; flex:none; background:var(--hollow); }
    .d.r { box-shadow:0 0 0 2px var(--bg), 0 0 0 3.6px var(--dir); }
    .d.big { width:20px; height:20px; }
    .d.wait { background:none; border:1.5px dashed var(--hollow); }
    .latest { display:grid; gap:6px; padding:10px; border-radius:12px; background:var(--soft); }
    .latest .top { display:flex; gap:10px; align-items:center; }
    .latest .d.big.r { box-shadow:0 0 0 2.5px var(--soft), 0 0 0 4.5px var(--dir); }
    .disp { font-weight:700; font-size:15px; line-height:1.35; }
    .said { font-size:12.5px; color:var(--mute); cursor:pointer; overflow-wrap:anywhere; }
    .tw { border:0; background:none; padding:0; font:inherit; color:inherit; cursor:pointer; text-decoration:underline dotted var(--mute); text-underline-offset:3px; }
    .vsel { display:inline-flex; gap:4px; flex-wrap:wrap; vertical-align:middle; padding-bottom:3px; }
    .vo { display:inline-flex; gap:5px; align-items:center; border:1px solid var(--line); background:var(--bg); color:var(--ink); border-radius:999px; padding:2px 8px; font-size:11.5px; font-weight:600; cursor:pointer; }
    .vo.on { box-shadow:inset 0 0 0 1.5px var(--ink); }
    .vo .d { width:8px; height:8px; }
    .okb { margin-left:auto; flex:none; width:28px; height:28px; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--ink); cursor:pointer; font-size:13px; line-height:1; padding:0; }
    .okb:hover { border-color:var(--ok); color:var(--ok); }
    .okd { margin-left:auto; flex:none; width:28px; text-align:center; color:var(--ok); font-weight:700; }
    input[type=text] { width:100%; border:1px dashed var(--line); border-radius:8px; padding:6px 8px; font-size:12px; color:var(--ink); background:var(--bg); }
    .strip { display:flex; gap:6px; flex-wrap:wrap; padding:2px; }
    .strip button { border:0; background:none; padding:4px 3px 1px; border-radius:8px; cursor:pointer; display:grid; justify-items:center; gap:4px; line-height:0; }
    .strip button.sel { background:var(--soft); }
    .strip button.sel .d.r { box-shadow:0 0 0 2px var(--soft), 0 0 0 3.6px var(--dir); }
    .rd { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--alert); flex:none; }
    .rd.off { visibility:hidden; }
    .legend { display:flex; flex-wrap:wrap; gap:5px 12px; font-size:11px; color:var(--mute); }
    .legend span { display:inline-flex; gap:6px; align-items:center; }
    .legend .d { width:8px; height:8px; }
    .legend .d.r { box-shadow:0 0 0 1.5px var(--bg), 0 0 0 2.8px var(--dir); margin-left:3px; }
    .foot { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
    .sub { font-size:12px; color:var(--mute); }
    .ins { display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
    .ins .w { font-size:11.5px; font-weight:600; border:1px solid var(--line); border-radius:999px; padding:1px 8px; background:var(--bg); color:var(--ink); cursor:pointer; }
    .ins .w[aria-expanded="true"] { box-shadow:inset 0 0 0 1.5px var(--ink); }
    .expl { display:grid; gap:6px; padding:9px 10px; border-radius:10px; background:var(--ask); font-size:12px; }
    .expl .eh { display:flex; justify-content:space-between; align-items:baseline; }
    .esc { display:flex; gap:3px; flex-wrap:wrap; }
    .esc span { font-size:10.5px; padding:1px 6px; border-radius:999px; background:var(--bg); color:var(--mute); border:1px solid var(--line); }
    .esc span.on { background:var(--accent); color:var(--on); border-color:var(--accent); font-weight:700; }
    .tocheck { display:inline-flex; align-items:center; gap:6px; border:0; background:none; padding:0; font-size:12.5px; font-weight:600; color:var(--ink); cursor:pointer; }
    .tocheck.none { color:var(--mute); cursor:default; }
    .hint { font-size:12px; background:var(--ask); border-radius:8px; padding:6px 9px; }
    .pri { border:0; border-radius:8px; padding:8px 14px; font-size:12.5px; font-weight:600; background:var(--accent); color:var(--on); cursor:pointer; width:100%; }
    .sec { border:1px solid var(--line); border-radius:8px; padding:7px 14px; font-size:12.5px; font-weight:600; background:var(--bg); color:var(--ink); cursor:pointer; }
    button[disabled] { opacity:.5; cursor:default; }
    .lnk { border:0; background:none; padding:0; color:var(--accent); font-weight:600; font-size:12px; cursor:pointer; }
    .small { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--mute); font-weight:600; }
    .rec { display:grid; gap:6px; padding:10px; border-radius:12px; background:var(--soft); }
    .rec b { font-size:13.5px; }
    .rec .row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .warn { font-size:12px; color:var(--cor); }
  </style>
  <div class="wrap" id="wrap"><button class="hb" id="hb" aria-label="HammerIT" aria-expanded="false" title="HammerIT"></button><section class="panel" id="panel" hidden></section></div>`;
  const attach = () => {
    if (conversationId() || location.pathname === '/') { if (!host.isConnected) (document.body || document.documentElement).appendChild(host); }
    else if (host.isConnected) host.remove();
  };
  attach(); setInterval(attach, 1000);

  const $ = id => root.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VC = { accepted: 'acc', questioned: 'que', corrected: 'cor', rejected: 'rej' };
  const VL = { accepted: 'kept it', questioned: 'questioned it', corrected: 'corrected it', rejected: 'rejected it' };
  const SHORT = { accepted: 'Kept', questioned: 'Questioned', corrected: 'Corrected', rejected: 'Rejected' };
  const SL = { directed: 'gave the next task', none: 'gave nothing to do' };
  const VWORDS = ['accepted', 'questioned', 'corrected', 'rejected'];
  const vl = w => VL[w] || w, sl = w => SL[w] || w;
  const SCALES = [['Depth', ['Passive', 'Light', 'Attentive', 'Deliberate', 'Rigorous']], ['Reasoning', ['AI reasoning', 'Shared reasoning', 'Your reasoning']], ['In the loop', ['Out of the loop', 'On the loop', 'In the loop', 'In command']]];
  const MEAN = {
    'Passive': 'You kept the answers as they came, without questioning, correcting or giving the next task.',
    'Light': 'Now and then you questioned, corrected or gave the next task.',
    'Attentive': 'You questioned or corrected answers, and gave the next task some of the time.',
    'Deliberate': 'You corrected at least one answer and gave the next task in at least half your lines.',
    'Rigorous': 'You corrected at least one answer and gave the next task in at least three quarters of your lines.',
    'AI reasoning': 'The answers of the AI carried the thinking. You rarely pushed back while steering the work.',
    'Shared reasoning': 'You questioned or corrected answers and gave the next task in at least half your lines.',
    'Your reasoning': 'You corrected the AI and set the next task in at least half your lines, so the thinking was yours.',
    'Out of the loop': 'You did not correct the AI and gave the next task in fewer than half your lines.',
    'On the loop': 'You corrected the AI, or gave the next task in at least half your lines, but not both.',
    'In the loop': 'You corrected the AI and gave the next task in at least half your lines.',
    'In command': 'You corrected the AI and gave the next task in at least three quarters of your lines.',
  };
  const dot = (v, s, extra) => v ? `<i class="d${s === 'directed' ? ' r' : ''}${extra ? ' ' + extra : ''}" style="background:var(--${VC[v] || 'hollow'})"></i>` : `<i class="d wait${extra ? ' ' + extra : ''}"></i>`;

  let open = false, NODES = [], MSGS = [], lastHash = '', loaded = false, VIEW = null, engineUp = null, poll = null, STATUS = '';
  let SEL = null, FIX = null, STEP = false, NEED = false, WORD = null, MODE = 'first', JOB = { light: null, full: null }, jobPoll = null;

  function request(method, url, body) {
    const cr = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) ? chrome.runtime : null;
    if (cr) {
      return new Promise((resolve, reject) => {
        try {
          cr.sendMessage({ type: 'hammerit09', method, url, body }, res => {
            if (cr.lastError || !res) return reject(new Error('engine unreachable'));
            if (!res.ok) return reject(new Error(res.error || ('engine ' + res.status)));
            try { resolve(JSON.parse(res.text)); } catch (e) { reject(new Error('engine reply unreadable')); }
          });
        } catch (e) { reject(new Error('engine unreachable')); }
      });
    }
    return fetch(url, { method, headers: { 'content-type': 'application/json', 'X-Hammerit-Local': '1' }, body }).then(r => { if (!r.ok) throw new Error('engine ' + r.status); return r.json(); });
  }
  const post = (conv, msgs, live) => request('POST', `${ENGINE}/capture`, JSON.stringify({ conversation: conv, url: location.href, live, tool: 'ChatGPT', messages: msgs.map(m => ({ i: m.i, who: m.who, text: m.text })) }));
  const state = conv => request('GET', `${ENGINE}/state/${conv}`);
  async function act(path, body) {
    const conv = conversationId(); if (!conv) return;
    try { VIEW = await request('POST', `${ENGINE}${path}`, JSON.stringify(Object.assign({ conversation: conv }, body))); engineUp = true; STATUS = ''; }
    catch (e) { STATUS = 'HammerIT did not answer: ' + e.message; }
    draw();
  }

  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function pageIndex(who, head) {
    const h = norm(head).slice(0, 80); if (!h) return -1;
    const k = MSGS.findIndex(m => m.who === who && norm(m.text).startsWith(h));
    return k >= 0 ? k : MSGS.findIndex(m => m.who === who && norm(m.text).includes(h.slice(0, 40)));
  }
  // one circle per message of yours after the first: message k is the "next" of row k-1; the first message opened the work
  function items() {
    if (!VIEW || VIEW.fallback) return [];
    const yours = MSGS.filter(m => m.who === 'you'), byNext = {};
    (VIEW.rows || []).forEach(r => { if (r.ask) { const idx = pageIndex('you', r.ask); if (idx >= 0) byNext[idx] = r; } });
    return yours.slice(1).map((m, k) => ({ m, n: k + 2, row: byNext[m.i] || null }));
  }
  const isRead = it => it.row && it.row.state === 'read';
  const wordsOf = row => row.answer ? [row.answer.verification, row.answer.steering] : [row.verification, row.steering];
  const left = its => its.filter(it => isRead(it) && !it.row.answer);

  function hlogo(px, its) {
    const read = its.filter(isRead), last6 = read.slice(-6), CIRC = 157.08, SLOT = 26.18, DASH = 21.18; let segs = '';
    for (let k = 0; k < 6; k++) { const it = last6[k]; segs += `<circle cx="28" cy="28" r="25" fill="none" style="stroke:${it ? `var(--${VC[wordsOf(it.row)[0]] || 'hollow'})` : 'var(--line)'}" stroke-width="4.5" stroke-dasharray="${DASH} ${CIRC - DASH}" stroke-dashoffset="${-(k * SLOT + 2.5)}"/>`; }
    const last = read[read.length - 1], h = last ? `var(--${VC[wordsOf(last.row)[0]] || 'accent'})` : 'var(--accent)', ring = last && wordsOf(last.row)[1] === 'directed' ? 1 : 0;
    return `<svg viewBox="-8 -8 72 72" width="${px}" height="${px}" aria-hidden="true"><circle cx="28" cy="28" r="32" fill="none" style="stroke:var(--dir)" stroke-width="3.5" opacity="${ring}"/><circle cx="28" cy="28" r="27" style="fill:var(--bg)"/><g transform="rotate(-90 28 28)">${segs}</g><svg x="14" y="14" width="28" height="28" viewBox="0 0 64 64"><rect x="10" y="10" width="10" height="44" rx="3" style="fill:${h}"/><rect x="44" y="10" width="10" height="44" rx="3" style="fill:${h}"/><ellipse cx="32" cy="32" rx="12" ry="6" fill="none" style="stroke:${h}" stroke-width="3.5"/></svg></svg>`;
  }
  function grade(pairs) {
    const k = pairs.length; if (k < 5) return null;
    const q = pairs.filter(x => x[0] === 'questioned').length / k, c = pairs.filter(x => x[0] === 'corrected' || x[0] === 'rejected').length / k, d = pairs.filter(x => x[1] === 'directed').length / k;
    let depth = 'Passive';
    if (c > 0 && d >= .75) depth = 'Rigorous'; else if (c > 0 && d >= .5) depth = 'Deliberate'; else if ((q > 0 || c > 0) && d > 0) depth = 'Attentive'; else if (q > 0 || c > 0 || d > 0) depth = 'Light';
    const reasoning = (c > 0 && d >= .5) ? 'Your reasoning' : ((q > 0 || c > 0) && d >= .5 ? 'Shared reasoning' : 'AI reasoning');
    const loop = (c > 0 && d >= .75) ? 'In command' : (c > 0 && d >= .5 ? 'In the loop' : (c > 0 || d >= .5 ? 'On the loop' : 'Out of the loop'));
    return [depth, reasoning, loop];
  }
  const explain = w => { const sc = SCALES.find(x => x[1].includes(w)); return `<div class="expl"><div class="eh"><b>${w}</b><span class="sub">${sc[0]}</span></div><div class="esc">${sc[1].map(x => `<span class="${x === w ? 'on' : ''}">${x}</span>`).join('')}</div><span>${MEAN[w]}</span></div>`; };

  function card(it) {
    const q = (it.m.text || '').replace(/\s+/g, ' ').trim(), said = `<div class="said" data-go="${it.m.i}" title="Show in the chat">“${esc(q.slice(0, 220))}${q.length > 220 ? '…' : ''}”</div>`;
    if (!it.row || it.row.state === 'reading') return `<div class="latest"><div class="top">${dot(null, null, 'big')}<span class="disp">Being read.</span></div>${said}</div>`;
    if (it.row.state !== 'read') return `<div class="latest"><div class="top"><i class="d big"></i><span class="disp">Not read.</span></div><span class="sub">${esc(it.row.why || '')}</span>${said}</div>`;
    const row = it.row, [v, s] = wordsOf(row), key = esc(row.key), done = !!row.answer;
    const vline = FIX === row.key ? `<span class="vsel">${VWORDS.map(w => `<button class="vo${w === v ? ' on' : ''}" data-pv="${key}" data-w="${w}"><i class="d" style="background:var(--${VC[w]})"></i>${SHORT[w]}</button>`).join('')}</span>`
      : `You <button class="tw" data-fix="${key}" title="Tap to change">${esc(vl(v))}</button>.`;
    const why = done && (v === 'corrected' || v === 'rejected') ? `<input type="text" data-note="${key}" placeholder="Why, in a line. Optional." value="${esc(row.answer.note || '')}" aria-label="Why, in a line">` : '';
    return `<div class="latest"><div class="top">${dot(v, s, 'big')}<span class="disp">${vline}<br>You <button class="tw" data-ps="${key}" title="Tap to change">${esc(sl(s))}</button>.</span>${done ? '<span class="okd" title="Checked">✓</span>' : `<button class="okb" data-ok="${key}" aria-label="This is right">✓</button>`}</div>${said}${why}</div>`;
  }
  function firstView(its) {
    const read = its.filter(isRead), todo = left(its);
    if (!its.length) return `<div class="latest"><span class="sub">Nothing to read yet. Reply to the first answer and the circles start.</span></div>`;
    let sel = its.find(it => it.m.i === SEL);
    if (!sel) { sel = its[its.length - 1]; SEL = sel.m.i; }
    const pos = todo.findIndex(it => it.m.i === SEL);
    const check = todo.length ? `<button class="tocheck" data-next="1" title="Next reading to check"><i class="rd"></i>${STEP && pos >= 0 ? `${pos + 1}/${todo.length}` : `${todo.length} to check`} ›</button>` : (read.length ? '<span class="tocheck none">All checked</span>' : '');
    const e = grade(read.filter(it => it.row.answer).map(it => wordsOf(it.row)));
    const nChecked = read.filter(it => it.row.answer).length;
    const ins = e ? `<span class="ins"><span class="sub">Chat insights</span>${e.map(w => `<button class="w" data-word="${esc(w)}" aria-expanded="${WORD === w}">${w}</button>`).join('')}</span>`
      : `<span class="sub">Chat insights after 5 checked readings. ${nChecked} so far.</span>`;
    const strip = its.map(it => `<button data-sel="${it.m.i}" class="${it.m.i === SEL ? 'sel' : ''}" aria-label="Message ${it.n}">${isRead(it) ? dot(...wordsOf(it.row)) : dot(null, null)}<i class="rd${isRead(it) && !it.row.answer ? '' : ' off'}"></i></button>`).join('');
    const legend = `<div class="legend">${VWORDS.map(w => `<span>${dot(w, 'none')}${SHORT[w]}</span>`).join('')}<span><i class="d r" style="background:var(--bg)"></i>Ring: gave the next task</span></div>`;
    return `${card(sel)}<div class="strip">${strip}</div>${legend}<div class="foot">${ins}${check}</div>${e && WORD && e.includes(WORD) ? explain(WORD) : ''}
      ${NEED && todo.length ? `<div class="hint">Check the ${todo.length} ${todo.length === 1 ? 'reading' : 'readings'} left, then the record is generated.</div>` : ''}
      <button class="pri" data-gen="1"${read.length ? '' : ' disabled'}>Generate record</button>`;
  }
  function recordView() {
    const l = JOB.light, f = JOB.full;
    const lightRow = !l || l.state === 'working' ? '<span class="sub">Building.</span>' : l.state === 'done' ? `<button class="sec" data-open="${esc(l.name)}">Open</button>` : `<span class="warn">${esc(l.error || 'Not built.')}</span>`;
    const fullRow = !VIEW.full ? '<span class="sub">Not in this build</span>' : !f ? '<button class="sec" data-full="1">Generate</button>' : f.state === 'working' ? '<span class="sub">Writing, about a minute.</span>' : f.state === 'done' ? `<button class="sec" data-open="${esc(f.name)}" data-ext="${f.pdf ? 'pdf' : 'html'}">Open</button>` : `<button class="sec" data-full="1">Try again</button>`;
    return `<span class="small">Your record</span>
      <div class="rec"><div class="row"><b>Light record</b>${lightRow}</div><span class="sub">Every prompt and reply in full, and what you did with each reply. Built on this computer.</span></div>
      <div class="rec"><div class="row"><b>Full record</b>${fullRow}</div><span class="sub">Adds the account: a title, how you shaped the work, what the AI contributed, the reason beside each line, and what you cut. Generating it sends the text of this chat to a model. No charge during the pilot.</span>${f && f.state === 'failed' ? `<span class="warn">${esc(f.error || 'It did not finish.')}</span>` : ''}</div>
      <button class="lnk" data-back="1" style="justify-self:start">‹ Back</button>`;
  }

  function draw() {
    if (!VIEW) return;
    const its = items();
    $('hb').innerHTML = hlogo(40, its); $('hb').setAttribute('aria-expanded', String(open));
    const p = $('panel'), act0 = root.activeElement, keep = act0 && act0.tagName === 'INPUT' && act0.dataset.note ? { key: act0.dataset.note, value: act0.value, pos: act0.selectionStart } : null;
    const body = VIEW.fallback ? '<div class="warn">HammerIT is not running on this computer. Start the HammerIT app and reload this page.</div>' : (MODE === 'record' ? recordView() : firstView(its));
    p.innerHTML = body + (STATUS ? `<div class="sub">${esc(STATUS)}</div>` : '');
    if (keep) { const el = root.querySelector(`[data-note="${keep.key}"]`); if (el) { el.value = keep.value; el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch (e) {} } }
  }

  async function render() {
    setTimeout(() => { try { placePanel(); } catch (e) {} }, 0);
    const msgs = readConversation(), conv = conversationId();
    NODES = msgs.map(m => m.node); MSGS = msgs;
    if (!conv || !msgs.some(m => m.who === 'you')) { VIEW = { rows: [] }; STATUS = conv ? 'Trial check: 0 messages of yours found. Page marks: ' + pageMarks() : ''; draw(); return; }
    if (STATUS.startsWith('Trial check')) STATUS = '';
    const h = msgs.map(m => m.who + ':' + m.text.length + ':' + m.text.slice(-40)).join('|');
    const changed = h !== lastHash; lastHash = h;
    const follow = SEL === null || (items().length && items()[items().length - 1].m.i === SEL);
    try { VIEW = (changed || !VIEW || !loaded) ? await post(conv, msgs, loaded) : await state(conv); loaded = true; engineUp = true; }
    catch (e) { engineUp = false; VIEW = { fallback: true, rows: [] }; }
    if (follow && !STEP && FIX === null) { const its = items(); if (its.length) SEL = its[its.length - 1].m.i; }
    draw();
    clearTimeout(poll);
    if (engineUp && (VIEW.reading || (VIEW.rows || []).some(r => r.state === 'reading'))) poll = setTimeout(render, 4000);
  }

  function shareButton() {
    return [...document.querySelectorAll('button, a')].find(el => {
      const t = (el.innerText || '').trim(), l = el.getAttribute('aria-label') || '';
      if (!(/^share$/i.test(t) || /^share/i.test(l))) return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.top < 120;
    });
  }
  function placeFixed() {
    const w = 40, h = 40, s = shareButton();
    let x, y;
    if (s) { const r = s.getBoundingClientRect(); x = r.left - w - 12; y = r.top + (r.height - h) / 2; }
    else { x = window.innerWidth - w - 220; y = 8; }
    x = Math.min(Math.max(12, x), Math.max(12, window.innerWidth - w - 12)); y = Math.max(4, y);
    host.style.right = 'auto'; host.style.left = x + 'px'; host.style.top = y + 'px';
  }
  function placePanel() {
    const p = $('panel'); if (p.hidden) return;
    const b = $('hb').getBoundingClientRect(), pw = p.getBoundingClientRect().width || 340, M = 16;
    const leftPx = Math.min(Math.max(M, b.right - pw), window.innerWidth - pw - M);
    p.style.left = leftPx + 'px'; p.style.top = (b.bottom + 8) + 'px';
  }
  setTimeout(placeFixed, 0); setInterval(() => { placeFixed(); placePanel(); }, 1000); window.addEventListener('resize', () => { placeFixed(); placePanel(); });
  $('hb').addEventListener('click', () => { open = !open; $('panel').hidden = !open; draw(); placePanel(); requestAnimationFrame(placePanel); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && open) { open = false; $('panel').hidden = true; draw(); } });

  function goTo(node) {
    if (!node || !node.isConnected) return;
    node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    const prev = node.style.outline, prevOff = node.style.outlineOffset, prevR = node.style.borderRadius;
    node.style.outline = '3px solid #e5484d'; node.style.outlineOffset = '6px'; node.style.borderRadius = '10px';
    setTimeout(() => { node.style.outline = prev; node.style.outlineOffset = prevOff; node.style.borderRadius = prevR; }, 1800);
  }
  const rowOf = key => (VIEW.rows || []).find(r => r.key === key);
  function advance() {
    const todo = left(items());
    if (!todo.length) { STEP = false; if (NEED) { NEED = false; startRecord(); } return; }
    if (STEP) { const nx = todo.find(it => it.m.i > SEL) || todo[0]; SEL = nx.m.i; goTo(NODES[nx.m.i]); }
  }
  async function recordCall(kind, extra) {
    const conv = conversationId(); if (!conv) return;
    JOB[kind] = { state: 'working' }; draw();
    try { JOB[kind] = await request('POST', `${ENGINE}/record`, JSON.stringify(Object.assign({ conversation: conv, kind }, extra))); }
    catch (e) { JOB[kind] = { state: 'failed', error: e.message }; }
    draw();
    if (JOB[kind].state === 'working') watchJob(kind);
  }
  function watchJob(kind) {
    clearTimeout(jobPoll);
    jobPoll = setTimeout(async () => {
      try { const j = await request('GET', `${ENGINE}/record_state/${conversationId()}`); if (j.kind === kind) JOB[kind] = j; } catch (e) { JOB[kind] = { state: 'failed', error: e.message }; }
      draw();
      if (JOB[kind].state === 'working') watchJob(kind);
    }, 4000);
  }
  function startRecord() { MODE = 'record'; JOB = { light: null, full: null }; recordCall('light'); }

  $('panel').addEventListener('change', ev => {
    const t = ev.target;
    if (t.tagName === 'INPUT' && t.dataset.note) { const r = rowOf(t.dataset.note); if (r) { const [v, s] = wordsOf(r); act('/answer', { key: r.key, choice: 'refuse', verification: v, steering: s, note: t.value.trim() }); } }
  });
  $('panel').addEventListener('click', async ev => {
    const t = ev.target; if (t.tagName === 'INPUT') return;
    const hit = a => t.closest && t.closest(`[data-${a}]`);
    if (hit('pagecheck')) { try { await navigator.clipboard.writeText(pageCheck()); $('pcdone').textContent = 'Copied.'; } catch (e) { $('pcdone').textContent = 'Could not copy: ' + e.message; } return; }
    let b;
    if ((b = hit('go'))) { goTo(NODES[+b.dataset.go]); return; }
    if ((b = hit('sel'))) { SEL = +b.dataset.sel; FIX = null; goTo(NODES[SEL]); draw(); return; }
    if ((b = hit('fix'))) { FIX = FIX === b.dataset.fix ? null : b.dataset.fix; draw(); return; }
    if ((b = hit('ok'))) { FIX = null; await act('/answer', { key: b.dataset.ok, choice: 'accept' }); advance(); draw(); return; }
    if ((b = hit('pv'))) { const r = rowOf(b.dataset.pv); FIX = null; if (r) await act('/answer', { key: r.key, choice: 'refuse', verification: b.dataset.w, steering: wordsOf(r)[1], note: (r.answer && r.answer.note) || '' }); return; }
    if ((b = hit('ps'))) { const r = rowOf(b.dataset.ps); if (r) { const [v, s] = wordsOf(r); await act('/answer', { key: r.key, choice: 'refuse', verification: v, steering: s === 'directed' ? 'none' : 'directed', note: (r.answer && r.answer.note) || '' }); } return; }
    if ((b = hit('next'))) { const todo = left(items()), cur = todo.findIndex(it => it.m.i === SEL), nx = !STEP ? todo[0] : (todo[cur + 1] || todo[0]); STEP = true; FIX = null; if (nx) { SEL = nx.m.i; goTo(NODES[SEL]); } draw(); return; }
    if ((b = hit('word'))) { WORD = WORD === b.dataset.word ? null : b.dataset.word; draw(); return; }
    if ((b = hit('gen'))) { const todo = left(items()); if (todo.length) { NEED = true; STEP = true; FIX = null; SEL = todo[0].m.i; goTo(NODES[SEL]); draw(); } else startRecord(); return; }
    if ((b = hit('full'))) { recordCall('full', { consent: true }); return; }
    if ((b = hit('open'))) { window.open(`${ENGINE}/record/${b.dataset.open}.${b.dataset.ext || 'html'}`, '_blank', 'noopener'); return; }
    if ((b = hit('back'))) { MODE = 'first'; draw(); return; }
  });
  let timer = null;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(render, 700); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  let lastPath = location.pathname;
  setInterval(() => { if (location.pathname !== lastPath) { lastPath = location.pathname; lastHash = ''; VIEW = null; loaded = false; SEL = null; FIX = null; STEP = false; NEED = false; WORD = null; MODE = 'first'; JOB = { light: null, full: null }; render(); } }, 1000);
  render();
  console.log('HammerIT ' + VERSION + ' loaded');
})();
