// HammerIT lite for claude.ai. 0.13, 10 November 2026, from the two reviews of the day and Micheline's rulings on them.
// One circle per message of yours (fill: what you did with the response, ring: you gave the AI the next task). One panel:
// each message as one line, "Did we read you right?", Yes or your own words. Nothing is asked while you work.
// Reads the conversation on this page and posts it to the local engine (127.0.0.1:4333, this machine only).
(() => {
  if (window.__hammerit09) return;
  window.__hammerit09 = true;
  const VERSION = '0.14.0-trinity.1';
  const ENGINE = 'http://127.0.0.1:4333';
  const FULL_URL = 'https://hammerai.ai/hammerit/full/';

  const USER_SEL = '[data-testid="user-message"]';
  const CLAUDE_SEL = '.font-claude-response, .font-claude-message, [data-testid="assistant-message"]';
  function conversationId() { const m = location.pathname.match(/\/chat\/([0-9a-f-]{20,})/i); return m ? m[1] : null; }
  const CHROME_LINE = /^(Claude responded:|You said:|[-\s]+$|(just now|\d+\s*(second|minute|hour|day|week|month|year)s?\s*ago)$|(edited|retry|copy|share|good response|bad response)$)/i;
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
  function readConversation() {
    const nodes = [...document.querySelectorAll(USER_SEL + ', ' + CLAUDE_SEL)].filter((n, i, all) => !all.some(o => o !== n && o.contains(n)));
    nodes.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    return nodes.map((n, i) => ({ i, who: n.matches(USER_SEL) ? 'you' : 'claude', text: messageText(n), node: n }));
  }

  // Drawing, inside a shadow root.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:24px;left:24px;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "SF Pro Text", "Source Sans 3", Helvetica, Arial, sans-serif; }
    .wrap { --bg:#ffffff; --ink:#1c2026; --mute:#5c646e; --line:#d6dad3; --soft:#eef0ec; --accent:#2d5f72; --hollow:#b9c2cc; --ok:#2f7a45;
      --acc:#2f7a45; --que:#3b7dc4; --cor:#c98a1a; --rej:#a3432f; --dir:#6b4e8a; display:grid; justify-items:end; gap:8px; }
    @media (prefers-color-scheme: dark) { .wrap { --bg:#1c2026; --ink:#e4e6e1; --mute:#9aa2ab; --line:#2f353c; --soft:#20252b; --accent:#86bccd; --hollow:#55636f; --ok:#86cf98;
      --acc:#86cf98; --que:#8cc3f2; --cor:#e8b04b; --rej:#e58c77; --dir:#c2a6e0; } }
    .wrap.left { justify-items:start; }
    /* Trinity prototype: the closed button is the Hammer H inside a reply ring (direction C). */
    .wrap { --cor-h:#b5770f; }
    @media (prefers-color-scheme: dark) { .wrap { --cor-h:#e8b04b; } }
    .hbtn { position:relative; display:block; width:60px; height:60px; padding:0; border:0; background:none; border-radius:50%; cursor:grab; touch-action:none; user-select:none; filter:drop-shadow(0 3px 8px rgba(18,26,34,.22)); transition:filter .15s; }
    .hbtn:hover { filter:drop-shadow(0 6px 14px rgba(18,26,34,.30)); }
    .hbtn.dragging { cursor:grabbing; }
    .hbtn:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    .hbtn svg { display:block; }
    .hbtn.done::after { content:""; position:absolute; right:2px; bottom:2px; width:12px; height:12px; border-radius:50%; background:var(--ok); border:2px solid var(--bg); }
    .hbtn.reading .seg { animation:pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity:.35 } }
    .seg { transition:stroke-width .15s; cursor:pointer; }
    .seg.empty { cursor:default; }
    .seg.hl { stroke-width:7.5; }
    .phead { display:flex; align-items:center; gap:12px; }
    .phead .ptxt { flex:1; min-width:0; display:grid; gap:2px; }
    .phead .sub { margin-top:0; }
    .row.hl { background:var(--soft); border-color:var(--line); }
    .d.hl { transform:scale(1.35); }
    .row.ask { border:1px solid var(--line); margin:2px 0; }
    .row.ask.first { border:2px solid var(--accent); background:var(--soft); }
    .row.ask .acts .ask { font-size:13px; }
    .row.ask button.sec { padding:5px 14px; font-size:12.5px; }
    .pips { display:flex; gap:5px; }
    .pips i { flex:1; height:5px; border-radius:3px; background:var(--line); }
    .pips i.on { background:var(--ok); }
    .offbox { display:grid; gap:10px; padding:14px; border-radius:10px; background:var(--soft); }
    .offbox .offt { display:flex; align-items:center; gap:8px; font-size:15px; font-weight:600; color:var(--ink); }
    .offbox ol { margin:0; padding-left:20px; display:grid; gap:5px; font-size:13px; color:var(--ink); }
    .offbox .offr { display:flex; align-items:center; gap:10px; }
    .strips { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:0 4px; }
    .d { width:9px; height:9px; border-radius:50%; display:block; background:var(--hollow); flex:0 0 auto; border:0; padding:0; cursor:pointer; }
    .d.h { background:none; border:1.5px solid var(--hollow); }
    .d.r { box-shadow:0 0 0 1.5px var(--bg), 0 0 0 3px var(--dir); }
    .d.wait { background:none; border:1.5px dashed var(--hollow); }
    .d.new { animation: land .9s ease-out; }
    @keyframes land { from { transform:scale(.2); opacity:0 } to { transform:none; opacity:1 } }
    .panel { position:fixed; width:min(400px, calc(100vw - 48px)); max-height:min(620px, calc(100vh - 120px)); overflow:hidden; background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:14px; box-shadow:0 12px 32px rgba(18,26,34,.18); padding:14px 16px; display:flex; flex-direction:column; gap:10px; font-size:13px; line-height:1.4; }
    .panel > * { flex:none; }
    .mid { flex:1 1 auto; min-height:90px; overflow-y:auto; display:grid; gap:2px; align-content:start; margin:0 -6px; padding:0 6px; }
    .panel[hidden] { display:none; }
    .head { display:flex; justify-content:space-between; align-items:baseline; }
    .eyebrow { font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--mute); }
    .t { font-weight:600; font-size:15px; color:var(--ink); }
    .sub { color:var(--mute); font-size:12px; margin-top:-6px; }
    .panel .strips { padding:10px 10px 10px 12px; background:var(--soft); border-radius:10px; gap:12px; }
    .panel .strips .d { width:12px; height:12px; }
    .panel .strips .d.r { box-shadow:0 0 0 2px var(--soft), 0 0 0 4.5px var(--dir); }
    .row { display:grid; grid-template-columns:14px 1fr; gap:3px 10px; align-items:start; padding:8px 8px 10px; border-radius:8px; border:1px solid transparent; }
    .row .d { margin-top:4px; margin-left:2px; }
    .row .d.r { box-shadow:0 0 0 2px var(--bg), 0 0 0 4px var(--dir); }
    .row > *:not(.d) { grid-column:2; }
    .row .s { color:var(--ink); font-size:13px; }
    .row .q { color:var(--mute); font-style:italic; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
    .row .w { color:var(--mute); font-size:12px; }
    .row .acts { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:3px; }
    .row .acts .ask { font-size:12px; font-weight:600; color:var(--ink); margin-right:4px; }
    .row .acts .ok { color:var(--ok); font-weight:600; font-size:12px; }
    .row.open { background:var(--soft); border-color:var(--line); }
    .pick { display:grid; gap:7px; margin-top:4px; }
    .pick .lab { font-size:11.5px; color:var(--mute); margin-right:2px; }
    .pick .chips { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
    .chip { border:1px solid var(--line); background:var(--bg); color:var(--ink); border-radius:999px; padding:3px 10px; font:600 11.5px inherit; font-family:inherit; cursor:pointer; }
    .chip.on { background:var(--accent); border-color:var(--accent); color:#fff; }
    .pick input { width:100%; border:1px dashed var(--line); border-radius:8px; padding:6px 8px; font:12px inherit; font-family:inherit; color:var(--ink); background:var(--bg); }
    button.pri { border:0; border-radius:8px; padding:6px 14px; font:600 12.5px inherit; font-family:inherit; background:var(--accent); color:#fff; cursor:pointer; }
    button.sec { border:1px solid var(--line); background:var(--soft); color:var(--ink); border-radius:999px; padding:3px 10px; font:600 11.5px inherit; font-family:inherit; cursor:pointer; }
    button.sec.pri2 { background:var(--accent); border-color:var(--accent); color:#fff; }
    button.lnk { border:0; background:none; padding:0; color:var(--accent); font-weight:600; font-size:12px; cursor:pointer; font-family:inherit; }
    button[disabled] { opacity:.5; cursor:default; }
    .foot { display:flex; justify-content:space-between; align-items:center; gap:10px; border-top:1px solid var(--line); padding-top:10px; font-size:12px; color:var(--mute); }
    .vwrap { display:flex; align-items:center; gap:10px; flex:1; }
    .vbar { flex:1; min-width:80px; height:4px; background:var(--line); border-radius:2px; overflow:hidden; }
    .vbar i { display:block; height:100%; background:var(--ok); transition:width .3s; }
    .stats { display:grid; gap:9px; padding:10px 12px; background:var(--soft); border-radius:10px; }
    .stats .srow { display:grid; grid-template-columns:74px 1fr 44px; gap:10px; align-items:center; font-size:11.5px; color:var(--mute); }
    .stats .srow b { color:var(--ink); font-weight:600; font-size:11.5px; }
    .stats .srow .n { text-align:right; color:var(--ink); font-weight:600; font-variant-numeric:tabular-nums; }
    .stats .bar { height:6px; background:var(--line); border-radius:3px; overflow:hidden; display:flex; }
    .stats .bar i { display:block; height:100%; transition:width .3s; }
    .stats .bar i.open { opacity:.35; }
    .ins { display:grid; gap:6px; padding:2px 4px 0; }
    .ins .w { display:flex; flex-wrap:wrap; gap:6px; }
    .ins .w span { font-size:13px; font-weight:600; color:var(--ink); padding:3px 10px; border:1px solid var(--line); border-radius:999px; }
    .ins .from, .ins .wait { font-size:12px; color:var(--mute); }
    .stats .seg { display:flex; gap:12px; flex-wrap:wrap; font-size:11px; color:var(--mute); }
    .stats .seg span::before { content:""; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align:-0.5px; background:var(--c); }
    .stats .seg b { color:var(--ink); font-weight:600; }
    .row.done { grid-template-columns:14px 1fr 18px; padding:5px 8px 6px; }
    .row.done .s, .row.done .q { grid-column:2; }
    .row .chk { grid-column:3; grid-row:1 / span 2; align-self:center; width:18px; height:18px; border-radius:50%; border:0; background:var(--ok); color:#fff; font-size:11px; display:grid; place-items:center; cursor:pointer; padding:0; font-family:inherit; }
    .bottom { display:grid; gap:6px; border-top:1px solid var(--line); padding-top:10px; margin-top:4px; }
    .bt { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--mute); }
    .upl { font-size:11px; color:var(--mute); text-decoration:underline; justify-self:end; margin-top:2px; }
    .upl:hover { color:var(--ink); }
    .key { display:grid; gap:6px; }
    .key .k { display:grid; grid-template-columns:18px 1fr; gap:10px; align-items:center; font-size:12.5px; }
    .key .k b { font-weight:600; margin-right:6px; }
    .key .k span { color:var(--mute); }
    .key .d { margin-left:3px; }
    .key .d.r { box-shadow:0 0 0 2px var(--bg), 0 0 0 4px var(--dir); }
    .warn { font-size:11.5px; color:var(--cor); }
    .status { font-size:12px; color:var(--mute); }
  </style>
  <div class="wrap" id="wrap"><button class="hbtn off" id="badge" aria-expanded="false" aria-label="HammerIT" title="HammerIT"><span id="bring"></span></button><section class="panel" id="panel" hidden></section></div>`;
  const attach = () => {
    if (conversationId() || /^\/new\b/.test(location.pathname)) { if (!host.isConnected) (document.body || document.documentElement).appendChild(host); }
    else if (host.isConnected) host.remove();
  };
  attach(); setInterval(attach, 1000);

  const $ = id => root.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // The six words. Fill: verification. Ring: directed. Short labels in the person's voice; definitions for the key.
  const VC = { accepted: 'acc', questioned: 'que', corrected: 'cor', rejected: 'rej' };
  const VL = { accepted: 'kept it', questioned: 'questioned it', corrected: 'corrected it', rejected: 'rejected it' };
  const SL = { directed: 'gave the next task', none: 'gave nothing to do' };
  let VDEF = { accepted: 'you kept the response', questioned: 'you asked about or doubted the response', corrected: 'you said part of the response is wrong', rejected: 'you refused the response or its form' };
  let SDEF = { directed: 'you gave the AI something to do', none: 'you gave the AI nothing to do' };
  let VWORDS = ['accepted', 'questioned', 'corrected', 'rejected'], SWORDS = ['directed', 'none'];
  const vl = w => VL[w] || w, sl = w => SL[w] || w;
  function takeWords(V) {
    if (!V || !V.words) return;
    VWORDS = V.words.verification.map(x => x[0]); SWORDS = V.words.steering.map(x => x[0]);
    V.words.verification.forEach(([w, d]) => { if (!VDEF[w]) VDEF[w] = 'you ' + d; });
    V.words.steering.forEach(([w, d]) => { if (!SDEF[w]) SDEF[w] = 'you ' + d; });
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function sentence(v, s, mine) { return (mine ? 'I ' : 'You ') + vl(v) + (s === 'directed' ? ' and ' + sl(s) : '') + '.'; }
  function hoverText(v, s) { return cap(vl(v)) + '. ' + cap(sl(s)) + '.'; }
  function glyph(v, s, extra, attrs) {
    if (!v) return `<i class="d wait ${extra || ''}" ${attrs || ''} title="Not read yet"></i>`;
    const style = VC[v] ? `background:var(--${VC[v]});` : '';
    return `<i class="d${s === 'directed' ? ' r' : ''} ${extra || ''}" style="${style}" ${attrs || ''} title="${esc(hoverText(v, s))}"></i>`;
  }
  // Trinity prototype: the reply ring. Six slots, your last six messages, oldest at the top going clockwise.
  // The H takes the colour of the latest read message; a purple outer ring when that message gave the next task.
  function ringItems(V) {
    if (!V || V.fallback) return [];
    return rowMessages(V).map(({ m, row }) => {
      if (!row || row.state !== 'read') return { i: m.i, col: 'var(--hollow)', read: false };
      const [v, s] = wordsOf(row);
      return { i: m.i, col: VC[v] ? `var(--${VC[v]})` : 'var(--hollow)', hcol: VC[v] === 'cor' ? 'var(--cor-h)' : (VC[v] ? `var(--${VC[v]})` : 'var(--hollow)'), dir: s === 'directed', read: true, tip: hoverText(v, s) };
    });
  }
  function ring(items, px) {
    const slots = items.slice(-6), CIRC = 157.08, SLOT = 26.18, DASH = 21.18;
    const latest = [...items].reverse().find(x => x.read);
    const h = latest ? latest.hcol : 'var(--hollow)';
    let segs = '';
    for (let k = 0; k < 6; k++) {
      const it = slots[k];
      segs += `<circle class="seg${it ? '' : ' empty'}"${it ? ` data-go="${it.i}"` : ''} cx="28" cy="28" r="25" fill="none" style="stroke:${it ? it.col : 'var(--line)'}" stroke-width="4.5" stroke-dasharray="${DASH} ${CIRC - DASH}" stroke-dashoffset="${-(k * SLOT + 2.5)}">${it && it.tip ? `<title>${esc(it.tip)}</title>` : ''}</circle>`;
      // a wider invisible copy of each segment, so it is easy to hover and click
      if (it) segs += `<circle class="hit" data-go="${it.i}" cx="28" cy="28" r="23" fill="none" stroke="transparent" stroke-width="12" pointer-events="stroke" stroke-dasharray="${SLOT} ${CIRC - SLOT}" stroke-dashoffset="${-(k * SLOT)}" style="cursor:pointer">${it.tip ? `<title>${esc(it.tip)}</title>` : ''}</circle>`;
    }
    return `<svg viewBox="-8 -8 72 72" width="${px}" height="${px}" aria-hidden="true">
      <circle cx="28" cy="28" r="32" fill="none" style="stroke:var(--dir)" stroke-width="3.5" opacity="${latest && latest.dir ? 1 : 0}"></circle>
      <circle cx="28" cy="28" r="27" style="fill:var(--bg)"></circle>
      <g transform="rotate(-90 28 28)">${segs}</g>
      <svg x="14" y="14" width="28" height="28" viewBox="0 0 64 64"><rect x="10" y="10" width="10" height="44" rx="3" style="fill:${h}"></rect><rect x="44" y="10" width="10" height="44" rx="3" style="fill:${h}"></rect><ellipse cx="32" cy="32" rx="12" ry="6" fill="none" style="stroke:${h}" stroke-width="3.5"></ellipse></svg>
    </svg>`;
  }

  let FIRST_ASK = null, drag = null, dragged = false, POS = null;
  let open = false, MODE = 'lines', NODES = [], MSGS = [], lastHash = '', loaded = false, VIEW = null, engineUp = null, poll = null, STATUS = '', PICK = {}, SEEN = new Set();

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
    return fetch(url, { method, headers: { 'content-type': 'application/json' }, body }).then(r => { if (!r.ok) throw new Error('engine ' + r.status); return r.json(); });
  }
  const post = (conv, msgs, live) => request('POST', `${ENGINE}/capture`, JSON.stringify({ conversation: conv, url: location.href, live, messages: msgs.map(m => ({ i: m.i, who: m.who, text: m.text })) }));
  const state = conv => request('GET', `${ENGINE}/state/${conv}`);
  async function act(path, body) {
    const conv = conversationId(); if (!conv) return;
    try { VIEW = await request('POST', `${ENGINE}${path}`, JSON.stringify(Object.assign({ conversation: conv }, body))); engineUp = true; STATUS = ''; takeWords(VIEW); }
    catch (e) { STATUS = 'HammerIT did not answer: ' + e.message; }
    draw(VIEW, MSGS);
  }

  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function pageIndex(who, head) {
    const h = norm(head).slice(0, 80); if (!h) return -1;
    const k = MSGS.findIndex(m => m.who === who && norm(m.text).startsWith(h));
    return k >= 0 ? k : MSGS.findIndex(m => m.who === who && norm(m.text).includes(h.slice(0, 40)));
  }
  // one circle per message of yours after the first: message k is the "next" of row k-1; the first message opened the work and has no reading
  function rowMessages(V) {
    const yours = MSGS.filter(m => m.who === 'you');
    const byNext = {};
    (V.rows || []).forEach(r => { if (r.ask) { const idx = pageIndex('you', r.ask); if (idx >= 0) byNext[idx] = r; } });
    return yours.slice(1).map(m => ({ m, row: byNext[m.i] || null }));
  }
  // the words shown for a row: yours when you answered, the reading otherwise
  function wordsOf(row) { const a = row.answer; return a ? [a.verification, a.steering] : [row.verification, row.steering]; }
  function strips(V) {
    return rowMessages(V).map(({ m, row }) => {
      if (!row || row.state === 'reading') return glyph(null, null, '', `data-go="${m.i}"`);
      if (row.state === 'not read') return `<i class="d h" data-go="${m.i}" title="${esc(row.why || 'Not read')}"></i>`;
      if (row.state !== 'read') return glyph(null, null, '', `data-go="${m.i}"`);
      const isNew = !SEEN.has(row.key); if (isNew) SEEN.add(row.key);
      const [v, s] = wordsOf(row);
      return glyph(v, s, isNew ? 'new' : '', `data-go="${m.i}"`);
    }).join('');
  }

  function line({ m, row }) {
    const q = (m.text || '').replace(/\s+/g, ' ').trim();
    const quote = `<span class="q" data-go="${m.i}">“${esc(q.slice(0, 110))}${q.length > 110 ? '…' : ''}”</span>`;
    if (!row || row.state === 'reading') return `<div class="row" data-mi="${m.i}">${glyph(null, null)}<span class="w">Being read.</span>${quote}</div>`;
    if (row.state === 'not read') return `<div class="row" data-mi="${m.i}"><i class="d h"></i><span class="w">${esc(row.why || 'Not read.')}</span>${quote}</div>`;
    const a = row.answer, [v, s] = wordsOf(row), pick = PICK[row.key], opened = pick !== undefined;
    let acts;
    if (opened) {
      acts = `<div class="pick">
        <div class="chips"><span class="lab">I...</span>${VWORDS.map(w => `<button class="chip${pick.v === w ? ' on' : ''}" data-pv="${esc(row.key)}" data-w="${w}">${esc(vl(w))}</button>`).join('')}</div>
        <div class="chips"><span class="lab">and I...</span>${SWORDS.map(w => `<button class="chip${pick.s === w ? ' on' : ''}" data-ps="${esc(row.key)}" data-w="${w}">${esc(sl(w))}</button>`).join('')}</div>
        <input type="text" data-note="${esc(row.key)}" placeholder="Why, in a line. Optional." value="${esc(pick.note || '')}">
        <div class="acts"><button class="sec pri2" data-save="${esc(row.key)}">Save</button><button class="sec" data-cancel="${esc(row.key)}">Cancel</button></div></div>`;
    } else if (a) {
      return `<div class="row done" data-key="${esc(row.key)}" data-mi="${m.i}">${glyph(v, s, '', `data-go="${m.i}"`)}<span class="s">${esc(sentence(v, s, true))}</span>${quote}<button class="chk" data-change="${esc(row.key)}" title="Your line. Click to change.">✓</button></div>`;
    } else {
      acts = `<div class="acts"><span class="ask">Did we read you right?</span><button class="sec pri2" data-yes="${esc(row.key)}">Yes</button><button class="sec" data-no="${esc(row.key)}">No, I...</button></div>`;
    }
    // Trinity prototype: rows waiting for your answer stand out; the first one most of all.
    const askCls = !opened && !a ? (row.key === FIRST_ASK ? ' ask first' : ' ask') : '';
    return `<div class="row${opened ? ' open' : ''}${askCls}" data-key="${esc(row.key)}" data-mi="${m.i}">${glyph(v, s, '', `data-go="${m.i}"`)}<span class="s">${esc(sentence(v, s))}</span>${quote}${acts}</div>`;
  }

  function counts(rows) {
    const c = { kept: 0, questioned: 0, corrected: 0, rejected: 0, directed: 0 };
    rows.forEach(r => { const [v, s] = wordsOf(r); if (v === 'accepted') c.kept++; else if (c[v] !== undefined) c[v]++; if (s === 'directed') c.directed++; });
    return c;
  }
  // The insight lines: chosen by rules from the pattern of your answered lines and from your earlier chats' counts. Two at a time.
  // Chat insights: three words on the engagement, from confirmed lines only. Families and grades from the baseline
  // of 10 November with Trinity: depth, whose reasoning, where you sit in the loop. Nothing under five confirmed lines.
  const MIN_LINES = 5;
  function engagement(rows) {
    const done = rows.filter(r => r.answer), k = done.length;
    if (k < MIN_LINES) return null;
    const w = done.map(r => wordsOf(r));
    const q = w.filter(x => x[0] === 'questioned').length / k;
    const c = w.filter(x => x[0] === 'corrected' || x[0] === 'rejected').length / k;
    const d = w.filter(x => x[1] === 'directed').length / k;
    let depth = 'Passive';
    if (c > 0 && d >= .75) depth = 'Rigorous';
    else if (c > 0 && d >= .5) depth = 'Deliberate';
    else if ((q > 0 || c > 0) && d > 0) depth = 'Attentive';
    else if (q > 0 || c > 0 || d > 0) depth = 'Light';
    const reasoning = (c > 0 && d >= .5) ? 'Your reasoning' : ((q > 0 || c > 0) && d >= .5 ? 'Shared reasoning' : 'AI reasoning');
    const loop = (c > 0 && d >= .75) ? 'In command' : (c > 0 && d >= .5 ? 'In the loop' : (c > 0 || d >= .5 ? 'On the loop' : 'Out of the loop'));
    return { depth, reasoning, loop, k };
  }
  function insights(rows) {
    const k = rows.filter(r => r.answer).length, e = engagement(rows);
    if (!e) return `<div class="ins"><div class="pips">${Array.from({ length: MIN_LINES }, (_, j) => `<i${j < k ? ' class="on"' : ''}></i>`).join('')}</div><div class="wait">Insights after ${MIN_LINES} confirmed lines. ${k} so far.</div></div>`;
    return `<div class="ins"><div class="w">${[e.depth, e.reasoning, e.loop].map(x => `<span>${esc(x)}</span>`).join('')}</div><div class="from">From your ${e.k} confirmed lines.</div></div>`;
  }
  function stats(rows, left) {
    // confirmed lines solid, lines still read by the model faded: the bars fill because you answered
    const n = rows.length, pct = x => n ? Math.round(100 * x / n) : 0;
    const cd = counts(rows.filter(r => r.answer)), co = counts(rows.filter(r => !r.answer)), ct = counts(rows);
    const seg = (k, key) => `<i style="width:${pct(cd[key])}%;background:var(--${k})"></i><i class="open" style="width:${pct(co[key])}%;background:var(--${k})"></i>`;
    return `<div class="stats">
      <div class="srow"><b>Verified</b><span class="bar"><i style="width:${pct(n - left)}%;background:var(--ok)"></i></span><span class="n">${n - left} of ${n}</span></div>
      <div class="srow"><b>Your actions</b><span class="bar">${seg('acc', 'kept')}${seg('que', 'questioned')}${seg('cor', 'corrected')}${seg('rej', 'rejected')}</span><span class="n">${n}</span></div>
      <div class="seg" style="margin-left:84px"><span style="--c:var(--acc)"><b>${ct.kept}</b> kept</span><span style="--c:var(--que)"><b>${ct.questioned}</b> questioned</span><span style="--c:var(--cor)"><b>${ct.corrected}</b> corrected</span><span style="--c:var(--rej)"><b>${ct.rejected}</b> rejected</span></div>
      <div class="srow"><b>Next task</b><span class="bar"><i style="width:${pct(cd.directed)}%;background:var(--dir)"></i><i class="open" style="width:${pct(co.directed)}%;background:var(--dir)"></i></span><span class="n">${ct.directed} of ${n}</span></div>
      </div>`;
  }
  function keyPanel() {
    const row = (g, label, def) => `<div class="k">${g}<div><b>${esc(label)}</b><span>${esc(def)}</span></div></div>`;
    return `<div class="head"><span class="eyebrow">HammerIT</span><button class="lnk" id="keyclose">Close</button></div><div class="t">What the circles say</div><div class="key">
      ${VWORDS.map(w => row(glyph(w, 'none'), cap(vl(w)), VDEF[w] || '')).join('')}
      ${row(glyph('accepted', 'directed'), 'With a ring', SDEF.directed || '')}
      ${row(glyph('accepted', 'none'), 'No ring', SDEF.none || '')}
      ${row(glyph(null, null), 'Dashed', 'not read yet')}</div>`;
  }
  function panel(V) {
    if (MODE === 'key') return keyPanel();
    const items = rowMessages(V);
    const rows = items.map(x => x.row).filter(r => r && r.state === 'read');
    const left = rows.filter(r => !r.answer).length, n = rows.length;
    const firstAsk = items.find(x => x.row && x.row.state === 'read' && !x.row.answer && PICK[x.row.key] === undefined);
    FIRST_ASK = firstAsk ? firstAsk.row.key : null;
    const lines = items.map(line).join('') || '<div class="status">Nothing to read yet. Send a message and reply to the answer; the circles start on your second message.</div>';
    let foot = '';
    if (n) foot = `<div class="bottom"><div class="bt">Chat insights</div>${insights(rows)}<a class="upl" href="${FULL_URL}" target="_blank" rel="noopener">Upgrade for the full record</a></div>`;
    return `<div class="phead">${ring(ringItems(V), 64)}<div class="ptxt"><span class="eyebrow">HammerIT</span><div class="t">Hammer this chat</div><div class="sub">HammerIT. Verify your AI record.</div></div><button class="lnk" id="key">Key</button></div><div class="strips">${strips(V)}</div>${n ? stats(rows, left) : ''}<div class="mid" id="mid">${lines}</div>${foot}`;
  }

  // Trinity prototype: what the panel says when the engine is not answering (wording approved 11 Nov).
  function offPanel() {
    return `<div class="phead">${ring([], 64)}<div class="ptxt"><span class="eyebrow">HammerIT</span><div class="t">Hammer this chat</div></div></div>
      <div class="offbox"><div class="offt"><i class="d"></i>Hammer's model is off</div>
      <div>To start it:</div>
      <ol><li>Open <b>Hammerit Lite</b> from your Applications folder, or press <b>⌘ Space</b>, type <b>Hammerit Lite</b> and press <b>Return</b>.</li>
      <li>Nothing opens on screen. It runs quietly in the background, and that's normal.</li>
      <li>Click <b>Check again</b> below.</li></ol>
      <div class="offr"><button class="pri" id="recheck">Check again</button></div></div>`;
  }

  function draw(V, msgs) {
    if (!V) return;
    NODES = msgs.map(m => m.node); MSGS = msgs;
    const badge = $('badge');
    const rows = V.fallback ? [] : rowMessages(V).map(x => x.row).filter(r => r && r.state === 'read');
    const reading = !V.fallback && (V.reading || (V.rows || []).some(r => r.state === 'reading'));
    const allDone = rows.length && rows.every(r => r.answer);
    badge.className = 'hbtn' + (V.fallback ? ' off' : '') + (reading ? ' reading' : '') + (allDone ? ' done' : '') + (drag && drag.moved ? ' dragging' : '');
    $('bring').innerHTML = ring(ringItems(V), 60);
    const tip = V.fallback ? "HammerIT · Hammer's model is off" : (reading ? 'HammerIT · reading' : 'HammerIT');
    badge.title = tip; badge.setAttribute('aria-label', tip);
    const body = V.fallback ? offPanel() : panel(V);
    const p = $('panel'), act = root.activeElement, keep = act && act.tagName === 'INPUT' && act.dataset.note ? { key: act.dataset.note, value: act.value, pos: act.selectionStart } : null, mid = $('mid'), top = mid ? mid.scrollTop : 0;
    if (keep && PICK[keep.key]) PICK[keep.key].note = keep.value;
    p.innerHTML = body + (STATUS ? `<div class="status">${esc(STATUS)}</div>` : '');
    const m2 = $('mid'); if (m2) m2.scrollTop = top;
    if (keep) { const el = root.querySelector(`[data-note="${keep.key}"]`); if (el) { el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch (e) {} } }
  }

  async function render() {
    setTimeout(() => { try { placePanel(); } catch (e) {} }, 0);
    const msgs = readConversation();
    const conv = conversationId();
    if (!conv || !msgs.some(m => m.who === 'you')) {
      $('badge').className = 'hbtn off'; $('bring').innerHTML = ring([], 60);
      $('panel').innerHTML = '<div class="eyebrow">HammerIT</div><div class="status">No conversation on this page yet. Send the first message and the circles start.</div>';
      return;
    }
    const h = msgs.map(m => m.who + ':' + m.text.length + ':' + m.text.slice(-40)).join('|');
    const changed = h !== lastHash; lastHash = h;
    try {
      VIEW = (changed || !VIEW) ? await post(conv, msgs, loaded) : await state(conv);
      takeWords(VIEW);
      loaded = true; engineUp = true;
    } catch (e) { engineUp = false; VIEW = { fallback: true, rows: [] }; }
    draw(VIEW, msgs);
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
  // Trinity prototype: the button starts top right and can be dragged anywhere. Where you leave it is remembered
  // for every conversation, measured from the nearer side of the window so it stays put when the window is resized.
  const BTN = 60, EDGE = 8, POS_KEY = 'hammeritButtonPos', DEFAULT_POS = { side: 'right', x: 24, y: 68 };
  const store = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ? chrome.storage.local : null;
  function loadPos() {
    try { if (store) store.get(POS_KEY, r => { POS = (r && r[POS_KEY]) || null; placeFixed(); }); } catch (e) {}
  }
  function savePos() { try { if (store) store.set({ [POS_KEY]: POS }); } catch (e) {} }
  const clampX = x => Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - BTN - EDGE));
  const clampY = y => Math.min(Math.max(EDGE, y), Math.max(EDGE, window.innerHeight - BTN - EDGE));
  function placeFixed() {
    if (drag) return;
    const p = POS || DEFAULT_POS;
    const x = clampX(p.side === 'left' ? p.x : window.innerWidth - BTN - p.x), y = clampY(p.y);
    host.style.right = 'auto'; host.style.left = x + 'px'; host.style.top = y + 'px';
    $('wrap').classList.toggle('left', x + BTN / 2 < window.innerWidth / 2);
  }
  function placePanel() {
    const p = $('panel'); if (p.hidden) return;
    const b = $('badge').getBoundingClientRect(), pw = p.getBoundingClientRect().width || 400, ph = p.getBoundingClientRect().height || 300, M = 16;
    const onLeft = b.left + b.width / 2 < window.innerWidth / 2;
    let left = onLeft ? b.left : b.right - pw;
    let top = b.bottom + 8;
    if (top + ph > window.innerHeight - M) {
      if (b.top - ph - 8 >= M) top = b.top - ph - 8;
      else { // no room above or below: open beside the button instead of covering it
        top = Math.min(Math.max(M, b.top), Math.max(M, window.innerHeight - ph - M));
        left = onLeft ? b.right + 8 : b.left - pw - 8;
      }
    }
    left = Math.min(Math.max(M, left), window.innerWidth - pw - M);
    p.style.left = left + 'px'; p.style.top = top + 'px';
  }
  setTimeout(placeFixed, 0); loadPos(); setInterval(() => { placeFixed(); placePanel(); }, 1000); window.addEventListener('resize', () => { placeFixed(); placePanel(); });
  const badgeEl = $('badge');
  badgeEl.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    dragged = false;
    const r = host.getBoundingClientRect();
    drag = { sx: ev.clientX, sy: ev.clientY, ox: r.left, oy: r.top, moved: false };
    try { badgeEl.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  badgeEl.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!drag.moved) { drag.moved = true; badgeEl.classList.add('dragging'); }
    host.style.right = 'auto'; host.style.left = clampX(drag.ox + dx) + 'px'; host.style.top = clampY(drag.oy + dy) + 'px';
    placePanel();
  });
  const endDrag = ev => {
    if (!drag) return;
    const d = drag; drag = null; badgeEl.classList.remove('dragging');
    if (!d.moved) return;
    dragged = true;
    const r = host.getBoundingClientRect();
    POS = r.left + BTN / 2 < window.innerWidth / 2 ? { side: 'left', x: Math.round(r.left), y: Math.round(r.top) } : { side: 'right', x: Math.round(window.innerWidth - r.left - BTN), y: Math.round(r.top) };
    savePos(); placeFixed(); placePanel();
  };
  badgeEl.addEventListener('pointerup', endDrag);
  badgeEl.addEventListener('pointercancel', endDrag);
  // Hovering a ring segment, a dot or a line lights up the others for the same message.
  let HL = null;
  function setHL(i) {
    if (i === HL) return;
    root.querySelectorAll('.hl').forEach(el => el.classList.remove('hl'));
    HL = i;
    if (i != null) root.querySelectorAll(`[data-go="${i}"], [data-mi="${i}"]`).forEach(el => el.classList.add('hl'));
  }
  root.addEventListener('mouseover', ev => {
    const el = ev.target.closest && ev.target.closest('[data-go], [data-mi]');
    setHL(el ? (el.dataset.go != null ? el.dataset.go : el.dataset.mi) : null);
  });
  badgeEl.addEventListener('click', ev => {
    if (dragged) { dragged = false; return; }
    const go = ev.target.closest && ev.target.closest('[data-go]');
    if (go && open) { goTo(NODES[+go.dataset.go]); return; }
    open = !open; $('panel').hidden = !open; $('badge').setAttribute('aria-expanded', String(open)); placePanel(); requestAnimationFrame(placePanel);
  });

  function goTo(node) {
    if (!node || !node.isConnected) return;
    node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    const prev = node.style.outline, prevOff = node.style.outlineOffset, prevR = node.style.borderRadius;
    node.style.outline = '3px solid #C98A1A'; node.style.outlineOffset = '6px'; node.style.borderRadius = '10px';
    setTimeout(() => { node.style.outline = prev; node.style.outlineOffset = prevOff; node.style.borderRadius = prevR; }, 1800);
  }
  const rowOf = key => (VIEW.rows || []).find(r => r.key === key);
  const noteOf = key => (root.querySelector(`[data-note="${key}"]`) || {}).value || '';
  $('panel').addEventListener('click', ev => {
    const t = ev.target;
    if (t.tagName === 'INPUT') return;
    const go = t.closest && t.closest('[data-go]');
    if (go) { const pos = +go.dataset.go; if (pos >= 0) goTo(NODES[pos]); else { STATUS = 'That message is not on the page right now: scroll up and it loads again.'; draw(VIEW, MSGS); } return; }
    if (t.id === 'recheck') { STATUS = ''; lastHash = ''; VIEW = null; render().then(() => { if (VIEW && VIEW.fallback) { STATUS = 'Still not answering. Give it a few seconds after opening it, then try again.'; draw(VIEW, MSGS); placePanel(); } }); return; }
    if (t.id === 'key') { MODE = 'key'; draw(VIEW, MSGS); placePanel(); return; }
    if (t.id === 'keyclose') { MODE = 'lines'; draw(VIEW, MSGS); placePanel(); return; }
    const yes = t.closest && t.closest('[data-yes]'); if (yes) { act('/answer', { key: yes.dataset.yes, choice: 'accept' }); return; }
    const no = t.closest && t.closest('[data-no]'); if (no) { const r = rowOf(no.dataset.no); PICK[no.dataset.no] = { v: r.verification, s: r.steering, note: '' }; draw(VIEW, MSGS); return; }
    const ch = t.closest && t.closest('[data-change]'); if (ch) { const r = rowOf(ch.dataset.change); const [v, s] = wordsOf(r); PICK[ch.dataset.change] = { v, s, note: (r.answer && r.answer.note) || '' }; draw(VIEW, MSGS); return; }
    const pv = t.closest && t.closest('[data-pv]'); if (pv) { const k = pv.dataset.pv; PICK[k] = Object.assign({}, PICK[k], { v: pv.dataset.w, note: noteOf(k) }); draw(VIEW, MSGS); return; }
    const ps = t.closest && t.closest('[data-ps]'); if (ps) { const k = ps.dataset.ps; PICK[k] = Object.assign({}, PICK[k], { s: ps.dataset.w, note: noteOf(k) }); draw(VIEW, MSGS); return; }
    const cancel = t.closest && t.closest('[data-cancel]'); if (cancel) { delete PICK[cancel.dataset.cancel]; draw(VIEW, MSGS); return; }
    const sv = t.closest && t.closest('[data-save]');
    if (sv) {
      const k = sv.dataset.save, r = rowOf(k), p = PICK[k] || {}, note = noteOf(k).trim();
      delete PICK[k];
      if (p.v === r.verification && p.s === r.steering) act('/answer', { key: k, choice: 'accept' });
      else act('/answer', { key: k, choice: 'refuse', verification: p.v, steering: p.s, note });
    }
  });
  let timer = null;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(render, 700); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  let lastPath = location.pathname;
  setInterval(() => { if (location.pathname !== lastPath) { lastPath = location.pathname; lastHash = ''; VIEW = null; loaded = false; MODE = 'lines'; PICK = {}; render(); } }, 1000);
  console.log('HammerIT ' + VERSION + ' loaded');
})();
