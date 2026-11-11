// Hammerit 0.9, Chrome side. The content script cannot reach 127.0.0.1 from inside claude.ai (the page's connect-src
// policy applies to it), so it asks this worker, which runs in the extension's own context and holds the host permission.
const ENGINE = 'http://127.0.0.1:4333';
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== 'hammerit09' || typeof msg.url !== 'string' || !msg.url.startsWith(ENGINE + '/')) return;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  fetch(msg.url, { method: msg.method || 'GET', headers: { 'content-type': 'application/json', 'X-Hammerit-Local': '1' }, body: msg.body, signal: ctl.signal })
    .then(async r => ({ ok: r.ok, status: r.status, text: await r.text() }))
    .catch(e => ({ ok: false, status: 0, error: e.name === 'AbortError' ? 'engine timeout' : 'engine unreachable' }))
    .then(res => { clearTimeout(t); reply(res); });
  return true;
});
