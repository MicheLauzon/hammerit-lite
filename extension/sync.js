// Hammerit 0.9 sync, prototype of 5 November 2026. Option 1 for Claude Desktop.
// A conversation held in Claude Desktop (or on the phone) is the same claude.ai conversation as in the browser.
// This script runs on any claude.ai page and, every few minutes, asks claude.ai itself for the conversations that
// changed since the last pass, using the same internal API the page uses and the page's own session. Each one is
// posted to the local engine (127.0.0.1:4333) as a capture with live=false and source='sync', so the record and the
// verify sheet cover work done outside this browser. Nothing is shown here; open the conversation on claude.ai to see
// the circles. Progress is written to the console under [hammerit sync]. Limits: no live glance inside Desktop, and the
// API does not say which client wrote a conversation, so a synced conversation is recorded as "not seen live here".
(() => {
  if (window.__hammerit09sync) return;
  window.__hammerit09sync = true;
  const ENGINE = 'http://127.0.0.1:4333';
  const EVERY_MS = 5 * 60 * 1000;      // one pass every five minutes
  const FIRST_MS = 15 * 1000;          // first pass fifteen seconds after the page loads
  const MAX_PER_PASS = 10;             // conversations fetched per pass
  const LOOKBACK_MS = 7 * 24 * 3600 * 1000; // first ever pass: the last seven days only
  const KEY = 'hammerit09.sync';
  const log = (...a) => console.log('[hammerit sync]', ...a);

  const cr = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) ? chrome.runtime : null;
  function engine(method, url, body) {
    if (cr) return new Promise((resolve, reject) => {
      try {
        cr.sendMessage({ type: 'hammerit09', method, url, body }, res => {
          if (cr.lastError || !res) return reject(new Error('engine unreachable'));
          if (!res.ok) return reject(new Error(res.error || ('engine ' + res.status)));
          try { resolve(JSON.parse(res.text)); } catch (e) { reject(new Error('engine reply unreadable')); }
        });
      } catch (e) { reject(new Error('engine unreachable')); }
    });
    return fetch(url, { method, headers: { 'content-type': 'application/json' }, body }).then(r => { if (!r.ok) throw new Error('engine ' + r.status); return r.json(); });
  }
  async function api(path) {
    const r = await fetch('https://claude.ai/api' + path, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`claude.ai api ${r.status} on ${path}`);
    return r.json();
  }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  const openConversation = () => { const m = location.pathname.match(/\/chat\/([0-9a-f-]{20,})/i); return m ? m[1] : null; };

  // One message of the API becomes one line of text for the record. Text blocks are kept whole. The AI's side keeps
  // a short line per tool call and per tool result so the record shows that something acted, which the page DOM hides.
  function textOf(msg) {
    const parts = [];
    for (const b of (Array.isArray(msg.content) ? msg.content : [])) {
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'text' && b.text) parts.push(String(b.text));
      else if (b.type === 'tool_use') parts.push(`[tool: ${b.name || 'unnamed'}${b.input && b.input.query ? ' ' + JSON.stringify(b.input.query) : ''}]`);
      else if (b.type === 'tool_result') parts.push(`[tool result: ${b.name || ''}${b.is_error ? ' error' : ''}]`);
      else if (b.type === 'thinking') parts.push('[thinking, not shown]');
      else if (b.type) parts.push(`[${b.type}]`);
    }
    if (!parts.length && msg.text) parts.push(String(msg.text));
    return parts.join('\n').trim();
  }
  function messagesOf(conv) {
    const raw = Array.isArray(conv.chat_messages) ? conv.chat_messages.slice() : [];
    raw.sort((a, b) => (a.index ?? 0) - (b.index ?? 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const out = [];
    for (const m of raw) {
      const who = m.sender === 'human' ? 'you' : m.sender === 'assistant' ? 'claude' : null;
      if (!who) continue;
      const text = textOf(m);
      if (!text) continue;
      out.push({ i: out.length, who, text });
    }
    return out;
  }

  let running = false;
  async function pass(reason) {
    if (running) return; running = true;
    const st = load();
    try {
      if (!st.org) {
        const orgs = await api('/organizations');
        const list = Array.isArray(orgs) ? orgs : (orgs.organizations || []);
        const pick = list.find(o => (o.capabilities || []).includes('chat')) || list[0];
        if (!pick || !pick.uuid) throw new Error('no organization in /api/organizations: ' + JSON.stringify(orgs).slice(0, 200));
        st.org = pick.uuid; save(st);
        log('organization', pick.name || '', pick.uuid);
      }
      const convs = await api(`/organizations/${st.org}/chat_conversations`);
      const all = Array.isArray(convs) ? convs : (convs.conversations || convs.data || []);
      if (!all.length) { log('no conversations returned, shape:', Object.keys(convs || {})); }
      const since = st.last ? st.last : (Date.now() - LOOKBACK_MS);
      const done = st.done || {};
      const here = openConversation();
      const changed = all
        .filter(c => c.uuid && c.updated_at && Date.parse(c.updated_at) > since && done[c.uuid] !== c.updated_at && c.uuid !== here)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, MAX_PER_PASS);
      log(`${reason}: ${all.length} conversations listed, ${changed.length} changed since last pass`);
      let newest = since;
      for (const c of changed) {
        try {
          const full = await api(`/organizations/${st.org}/chat_conversations/${c.uuid}?tree=True&rendering_mode=messages&render_all_tools=true`);
          const msgs = messagesOf(full);
          if (!msgs.length) { log('empty after mapping', c.uuid, 'keys:', Object.keys(full)); done[c.uuid] = c.updated_at; continue; }
          const v = await engine('POST', `${ENGINE}/capture`, JSON.stringify({ conversation: c.uuid, url: `https://claude.ai/chat/${c.uuid}`, live: false, source: 'sync', messages: msgs }));
          done[c.uuid] = c.updated_at;
          newest = Math.max(newest, Date.parse(c.updated_at));
          log('synced', (c.name || '').slice(0, 50), `${msgs.length} messages`, `rows ${(v.rows || []).length}`);
        } catch (e) { log('failed', c.uuid, e.message); }
        await new Promise(r => setTimeout(r, 1000));
      }
      if (changed.length < MAX_PER_PASS) st.last = Math.max(newest, since);
      st.done = done; st.at = new Date().toISOString(); st.error = null;
    } catch (e) {
      st.error = e.message; log('pass failed:', e.message);
    } finally { save(st); running = false; }
  }
  window.__hammerit09syncNow = () => pass('manual');
  setTimeout(() => pass('first'), FIRST_MS);
  setInterval(() => pass('timer'), EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pass('focus'); });
})();
