#!/usr/bin/env node
/* Real Google-tag (gtag.js) Consent Mode v2 capture — the qualifying suite.
 *
 *   Run:  bash tests/ga4-realtag.test.sh     (from the repo root)
 *
 * What this is:
 *   Loads the ACTUAL Google tag (real gtag.js served by Google for
 *   G-9MG87ETLPT) in a real headless Chromium, on real pages of the served
 *   site. Every request the tag would send to Google's analytics/ad endpoints
 *   is intercepted at the network layer (CDP Fetch), captured verbatim, and
 *   answered locally (empty 204) — so NOTHING reaches the GA account, while
 *   nothing is stubbed on the page side: the real consent-mode engine, real
 *   cookie code, and the real minimization paths all execute for real.
 *
 * What it proves (assertions below):
 *   T1 no consent  -> zero Google egress, zero cookies, choice UI present
 *   T2 consent     -> real tag loads; pageview captured with dl path-only,
 *                     no referrer value, no secret query token; zero ad-tech;
 *                     consent signaling on the wire; dataLayer order:
 *                     default (all denied) -> update (analytics granted,
 *                     ads denied) -> config
 *   T3 reject      -> zero egress + zero cookies across a real second page
 *   T4 withdraw    -> pre-withdraw send observed; explicit denial issued;
 *                     GA cookies gone; teardown reload happens; then ZERO
 *                     further Google egress on the reloaded document AND on
 *                     the next real page; tag is never loaded after withdraw
 *   T5 persistence -> prior consent honored on a second real page (one view)
 *   T6 outbound    -> merchant URL + token never sent (owner EM outbound OFF)
 *   T7 history     -> pushState/popstate produce no second pageview
 *                     (owner EM history-based page views OFF)
 *   T8 UI/a11y     -> accessible region + native focusable buttons; compact,
 *                     non-obscuring card before choice; compact pill after
 *
 * Requires: google-chrome, Node >= 20 (global fetch / WebSocket), outbound
 * HTTPS to www.googletagmanager.com (the real tag). Exit 0 all-pass / 1 fail.
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME_BIN || 'google-chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8236';
const PORT_BASE = parseInt(process.env.RT_PORT_BASE || '9500', 10);
const SETTLE = 1600;
const SECRET = 'SECRETTOKEN-99x';

let pass = 0, fail = 0, fatalCount = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra != null ? '  -- got: ' + JSON.stringify(extra).slice(0, 500) : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function httpJson(url, tries) {
  for (let i = 0; i < (tries || 100); i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(400) }); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await sleep(120);
  }
  return null;
}

const TAG_EXPR = 'Array.prototype.some.call(document.scripts, function (x) { return /googletagmanager\\.com\\/gtag\\/js/.test(x.src || ""); })';
function gaHost(u) { return /https?:\/\/([a-z0-9.-]+\.)*(google-analytics\.com|analytics\.google\.com)([:/?#]|$)/i.test(String(u)); }
function adHost(u) { return /https?:\/\/([a-z0-9.-]+\.)*(googleadservices\.com|doubleclick\.net|googlesyndication\.com)([:/?#]|$)/i.test(String(u)) || /google\.com\/(pagead|ads)\b/i.test(String(u)); }
function capText(c) { return (c.url || '') + ' ' + (c.postData || ''); }

class Cdp {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.waiters = new Map(); this.handlers = new Set();
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id != null && this.waiters.has(msg.id)) {
        const w = this.waiters.get(msg.id); this.waiters.delete(msg.id);
        if (msg.error) w.reject(new Error((msg.error.message || 'cdp error') + ' in ' + w.method));
        else w.resolve(msg.result);
      } else if (msg.method) { for (const h of this.handlers) { try { h(msg); } catch (e) { } } }
    });
  }
  static ready(ws) {
    return new Promise((res, rej) => {
      ws.addEventListener('open', () => res(), { once: true });
      const to = setTimeout(() => rej(new Error('ws open timeout')), 8000);
      ws.addEventListener('error', () => { clearTimeout(to); rej(new Error('ws error')); }, { once: true });
      ws.addEventListener('open', () => clearTimeout(to), { once: true });
    });
  }
  send(method, params) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => { if (this.waiters.has(id)) { this.waiters.delete(id); reject(new Error('timeout: ' + method)); } }, 20000);
      this.waiters.set(id, {
        resolve: (v) => { clearTimeout(to); resolve(v); },
        reject: (e) => { clearTimeout(to); reject(e); }, method
      });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(fn) { this.handlers.add(fn); }
}

async function startScenario(idx, pageUrl) {
  const port = PORT_BASE + idx;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ga4rt-'));
  const child = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1280,900', '--disable-dev-shm-usage',
    '--user-data-dir=' + prof, '--remote-debugging-port=' + port,
    pageUrl
  ], { stdio: 'ignore' });

  const cleanup = async () => {
    try { if (cdp) cdp.ws.close(); } catch (e) { }
    try { child.kill('SIGKILL'); } catch (e) { }
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { }
  };

  const ctx = { captures: [], allReqs: [], nav: 0 };
  const ver = await httpJson('http://127.0.0.1:' + port + '/json/version', 120);
  if (!ver) { await cleanup(); return { fatal: 'chrome devtools port not reachable' }; }
  const list = await httpJson('http://127.0.0.1:' + port + '/json/list', 30) || [];
  const t = list.find(x => x.type === 'page' && String(x.url).startsWith(BASE)) ||
            list.find(x => x.type === 'page');
  if (!t) { await cleanup(); return { fatal: 'no CDP page target for ' + pageUrl }; }

  let cdp = null;
  try {
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await Cdp.ready(ws);
    cdp = new Cdp(ws);
  } catch (e) { await cleanup(); return { fatal: 'CDP connect failed: ' + e.message }; }

  try {
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Fetch.enable', { patterns: [
      { urlPattern: '*google-analytics.com*' },
      { urlPattern: '*analytics.google.com*' },
      { urlPattern: '*googleadservices.com*' },
      { urlPattern: '*doubleclick.net*' },
      { urlPattern: '*googlesyndication.com*' },
      { urlPattern: '*google.com/pagead*' }
    ]});
  } catch (e) { await cleanup(); return { fatal: 'CDP enable failed: ' + e.message }; }

  cdp.on((msg) => {
    if (msg.method === 'Page.frameNavigated') ctx.nav++;
    if (msg.method === 'Network.requestWillBeSent') {
      const u = (msg.params.request && msg.params.request.url) || '';
      if (u && u.indexOf('data:') !== 0) ctx.allReqs.push({ url: u, method: (msg.params.request && msg.params.request.method) || 'GET' });
    }
    if (msg.method === 'Fetch.requestPaused') {
      const req = msg.params.request || {};
      ctx.captures.push({ url: req.url, method: req.method, postData: req.postData || '' });
      cdp.send('Fetch.fulfillRequest', {
        requestId: msg.params.requestId, responseCode: 204,
        responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }], body: ''
      }).catch(() => { });
    }
  });

  const evalJs = (expression) =>
    cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false })
      .then(r => (r && r.result ? r.result.value : undefined));

  const state = async () => ({
    consentState: await evalJs('typeof window.offbeatConsentState === "function" ? window.offbeatConsentState() : null'),
    cookie: await evalJs('document.cookie'),
    tagLoaded: await evalJs(TAG_EXPR),
    buttons: await evalJs('Array.prototype.map.call(document.querySelectorAll(".ob-consent-btn"), function (b) { return b.textContent; })'),
    text: await evalJs('(function () { var t = document.querySelector(".ob-consent-text"); return t ? t.textContent : null; })()'),
    region: await evalJs('(function () { var r = document.querySelector(".ob-consent"); if (!r) return null; return { role: r.getAttribute("role"), label: r.getAttribute("aria-label"), live: r.getAttribute("aria-live"), cls: r.className }; })()'),
    dataLayer: await evalJs('try { JSON.stringify(window.dataLayer || []) } catch (e) { "ERR" }')
  });

  const clickBtn = (label) =>
    evalJs('(function () { var bs = document.querySelectorAll(".ob-consent-btn"); for (var i = 0; i < bs.length; i++) { if (bs[i].textContent === ' + JSON.stringify(label) + ') { bs[i].click(); return true; } } return false; })()');

  const waitFor = async (expr, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 12000)) {
      try { if (await evalJs(expr)) return true; } catch (e) { }
      await sleep(250);
    }
    return false;
  };
  const waitLoaded = (ms) => waitFor('document.readyState === "complete"', ms);

  try {
    await cdp.send('Page.navigate', { url: pageUrl });
    await waitLoaded(20000);
    await sleep(SETTLE);
  } catch (e) { await cleanup(); return { fatal: 'initial navigation failed: ' + e.message }; }

  const navigate = async (u) => {
    await cdp.send('Page.navigate', { url: u });
    await waitLoaded(15000);
    await sleep(SETTLE);
  };

  return { ctx, cdp, state, clickBtn, evalJs, waitFor, waitLoaded, navigate, cleanup, fatal: null };
}

function gaEgressList(s) { return s.ctx.allReqs.filter(r => gaHost(r.url) || adHost(r.url)); }
function hasGaCookie(c) { return /(^|; )_ga[=_]/.test(String(c || '')); }
function parseDL(t) { let dl = []; try { dl = JSON.parse(t || '[]'); } catch (e) { } return Array.isArray(dl) ? dl : []; }
// dataLayer entries survive as [object Arguments]; after JSON round-trip they
// are objects with numeric string keys. Normalize to a plain array.
function ent(e) {
  if (!e) return null;
  if (Array.isArray(e)) return e;
  if (typeof e === 'object') {
    const a = [];
    for (const k of Object.keys(e)) if (/^\d+$/.test(k)) a[parseInt(k, 10)] = e[k];
    if (a.length) return a;
  }
  return null;
}
function findDL(t, cmd, sub) {
  const dl = parseDL(t);
  for (let i = 0; i < dl.length; i++) {
    const e = ent(dl[i]);
    if (!e || e[0] !== cmd) continue;
    if (sub && e[1] !== sub) continue;
    return i;
  }
  return -1;
}
// Search text = raw + URL-decoded (so encoded values are inspected too).
function searchText(s) {
  const parts = s.ctx.captures.map(c => (c.url || '') + ' ' + (c.postData || ''));
  const dec = s.ctx.captures.map(c => { try { return decodeURIComponent(c.url || ''); } catch (e) { return ''; } });
  return parts.concat(dec).join('\n');
}

async function main() {
  const secrets = [SECRET];

  /* ---- T1 no consent ----------------------------------------------------- */
  console.log('\n== T1 no consent: zero Google egress, zero cookies (real tag must never load) ==');
  let s = await startScenario(1, BASE + '/index.html?secret=' + SECRET);
  if (s.fatal) { fatalCount++; assert('T1 startup: ' + s.fatal, false); s = null; }
  if (s) {
    const st = await s.state();
    assert('T1 zero Google analytics/ad egress', gaEgressList(s).length === 0, gaEgressList(s).slice(0, 6));
    assert('T1 zero captured requests (collect endpoints)', s.ctx.captures.length === 0, s.ctx.captures.map(c => c.url).slice(0, 4));
    assert('T1 no _ga cookie', !hasGaCookie(st.cookie), st.cookie);
    assert('T1 choice UI present with Allow + Do not allow', !!st.region && (st.buttons || []).includes('Allow analytics') && (st.buttons || []).includes('Do not allow'), st.buttons);
    assert('T1 consent state unknown', st.consentState === 'unknown', st.consentState);
    await s.cleanup();
  }

  /* ---- T2 consent: real tag, minimized pageview, consent order ----------- */
  console.log('\n== T2 consent: real gtag.js loads, ONE minimized pageview, explicit consent order ==');
  s = await startScenario(2, BASE + '/best-dj-headphones-under-100-2026.html?secret=' + SECRET);
  if (s.fatal) { fatalCount++; assert('T2 startup: ' + s.fatal, false); s = null; }
  if (s) {
    const st0 = await s.state();
    assert('T2 choice UI first (tag NOT loaded yet)', (st0.buttons || []).includes('Allow analytics') && st0.tagLoaded !== true, { buttons: st0.buttons, tagLoaded: st0.tagLoaded });
    await s.clickBtn('Allow analytics');
    const tagUp = await s.waitFor(TAG_EXPR, 25000);
    if (tagUp) await sleep(SETTLE * 2);
    const st = await s.state();
    const caps = s.ctx.captures;
    assert('T2 real tag script present after Allow', st.tagLoaded === true, st.tagLoaded);
    assert('T2 real gtag.js fetched from Google (network egress)', s.ctx.allReqs.some(r => /googletagmanager\.com\/gtag\/js/.test(r.url)), s.ctx.allReqs.filter(r => /googletagmanager/.test(r.url)).slice(0, 2));
    assert('T2 >=1 GA collect captured (sent + intercepted locally)', caps.length >= 1, caps.map(c => (c.url || '').slice(0, 140)).slice(0, 4));
    const st2Text = searchText(s);
    assert('T2 a pageview is among the captured hits', /page_view|PAGE_VIEW/.test(st2Text), st2Text.slice(0, 300));
    assert('T2 secret query token NEVER sent (raw + decoded)', st2Text.indexOf(SECRET) === -1, st2Text.slice(0, 300));
    let dlDec = null;
    const dlM = /(?:[?&]dl=|[\s"]dl=)([^&\s",]+)/.exec(st2Text);
    if (dlM) { try { dlDec = decodeURIComponent(dlM[1]); } catch (e) { dlDec = dlM[1]; } }
    assert('T2 dl (page_location) decoded = path-only, ends in page path', !!dlDec && dlDec.indexOf('?') === -1 && dlDec.indexOf('#') === -1 && /\/best-dj-headphones-under-100-2026\.html$/.test(dlDec), dlDec);
    const drVals = (st2Text.match(/[?&]dr=([^&]*)/g) || []).map(m => { try { return decodeURIComponent(m.split('=')[1]); } catch (e) { return m.split('=')[1]; } });
    assert('T2 referrer (dr) empty or absent', drVals.every(v => v === '' || v === undefined), drVals);
    assert('T2 consent signaling on the wire (gcd param present)', /[?&]gcd=/.test(st2Text), st2Text.slice(0, 200));
    assert('T2 zero advertising-tech endpoints touched', s.ctx.allReqs.filter(r => adHost(r.url)).length === 0 && caps.filter(c => adHost(c.url)).length === 0, s.ctx.allReqs.filter(r => adHost(r.url)).slice(0, 3));
    assert('T2 _ga cookie set by the real tag', hasGaCookie(st.cookie), st.cookie);
    const dlq = parseDL(st.dataLayer);
    const iDefault = findDL(st.dataLayer, 'consent', 'default');
    const iCfg = findDL(st.dataLayer, 'config');
    let iUpdGr = -1;
    for (let i = 0; i < dlq.length; i++) { const e = ent(dlq[i]); if (e && e[0] === 'consent' && e[1] === 'update' && e[2] && e[2].analytics_storage === 'granted') { iUpdGr = i; break; } }
    const dflt = iDefault !== -1 ? ent(dlq[iDefault]) : null;
    const upd = iUpdGr !== -1 ? ent(dlq[iUpdGr]) : null;
    const names = dlq.slice(0, 8).map(x => { const e = ent(x); return e ? String(e[0]) + (e[1] ? '/' + e[1] : '') : '?'; });
    assert('T2 dataLayer: consent default declared (4 types)', iDefault !== -1, names);
    assert('T2 default: ad_storage + ad_user_data + ad_personalization + analytics_storage ALL denied', !!dflt && !!dflt[2] && dflt[2].ad_storage === 'denied' && dflt[2].ad_user_data === 'denied' && dflt[2].ad_personalization === 'denied' && dflt[2].analytics_storage === 'denied', dflt && dflt[2]);
    assert('T2 update: analytics_storage granted; all ad types stay denied', iUpdGr !== -1 && !!upd && upd[2].analytics_storage === 'granted' && upd[2].ad_storage === 'denied' && upd[2].ad_user_data === 'denied' && upd[2].ad_personalization === 'denied', upd && upd[2]);
    assert('T2 command order: default BEFORE update-grant BEFORE config', iDefault !== -1 && iUpdGr !== -1 && iCfg !== -1 && iDefault < iUpdGr && iUpdGr < iCfg, { iDefault, iUpdGr, iCfg });
    assert('T2 dataLayer contains exactly one config (one pageview)', dlq.filter(x => { const e = ent(x); return e && e[0] === 'config'; }).length === 1, names);
    await s.cleanup();
  }

  /* ---- T3 reject: zero egress across a real second page ------------------ */
  console.log('\n== T3 reject: zero Google egress + zero cookies across a real second page ==');
  s = await startScenario(3, BASE + '/index.html?secret=' + SECRET);
  if (s.fatal) { fatalCount++; assert('T3 startup: ' + s.fatal, false); s = null; }
  if (s) {
    await s.clickBtn('Do not allow');
    await sleep(1200);
    let st = await s.state();
    assert('T3 consent denied', st.consentState === 'denied', st.consentState);
    assert('T3 zero Google egress after reject', gaEgressList(s).length === 0, gaEgressList(s).slice(0, 6));
    assert('T3 no _ga cookie', !hasGaCookie(st.cookie), st.cookie);
    assert('T3 persistent "Turn on analytics" control', (st.buttons || []).includes('Turn on analytics'), st.buttons);
    await s.navigate(BASE + '/best-dj-mixers-beginners.html');
    st = await s.state();
    assert('T3 second page: tag NOT loaded', st.tagLoaded === false || st.tagLoaded === undefined, st.tagLoaded);
    assert('T3 second page: STILL zero Google egress', gaEgressList(s).length === 0, gaEgressList(s).slice(0, 6));
    assert('T3 second page: no _ga cookie', !hasGaCookie(st.cookie), st.cookie);
    assert('T3 second page: secret in URL still never sent', s.ctx.captures.map(capText).join('\n').indexOf(SECRET) === -1);
    await s.cleanup();
  }

  /* ---- T4 withdraw: denial + cookie expiry + teardown reload + zero after- */
  console.log('\n== T4 withdraw: explicit denial, cookies cleared, teardown reload, then ZERO further egress ==');
  s = await startScenario(4, BASE + '/index.html?secret=' + SECRET);
  if (s.fatal) { fatalCount++; assert('T4 startup: ' + s.fatal, false); s = null; }
  if (s) {
    await s.clickBtn('Allow analytics');
    await s.waitFor(TAG_EXPR, 25000);
    await sleep(SETTLE * 2);
    const pre = await s.state();
    assert('T4 pre: real tag loaded + pageview captured', pre.tagLoaded === true && s.ctx.captures.length >= 1, { tagLoaded: pre.tagLoaded, caps: s.ctx.captures.length });
    assert('T4 pre: _ga cookie set', hasGaCookie(pre.cookie), pre.cookie);
    const preCount = s.ctx.captures.length;
    const navBefore = s.ctx.nav;
    await s.evalJs('window.__t4 = "alive"');
    await s.clickBtn('Withdraw consent');
    let navSeen = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) { if (s.ctx.nav > navBefore) { navSeen = true; break; } await sleep(250); }
    assert('T4 teardown reload occurred after the denial', navSeen, { nav: s.ctx.nav, navBefore });
    await s.waitLoaded(15000);
    await sleep(SETTLE);
    const win = s.ctx.captures.slice(preCount);
    console.log('  info  T4 captures between click and reload: ' + win.length + (win.length ? ' -> ' + win.map(c => (c.url || '').slice(0, 120)).join(' | ') : ' (none)'));
    assert('T4 window click->reload: nothing carries the secret token', win.map(capText).join('\n').indexOf(SECRET) === -1, win.slice(0, 3).map(c => c.url));
    const mid = await s.state();
    const midCount = s.ctx.captures.length;
    assert('T4 reloaded document: tag NOT loaded', mid.tagLoaded === false || mid.tagLoaded === undefined, mid.tagLoaded);
    assert('T4 reloaded document: _ga cookie GONE', !hasGaCookie(mid.cookie), mid.cookie);
    assert('T4 reloaded document: consent persisted as denied', mid.consentState === 'denied', mid.consentState);
    assert('T4 reloaded document: dataLayer has no consent/config (tag never ran)', parseDL(mid.dataLayer).filter(e => Array.isArray(e) && (e[0] === 'config' || (e[0] === 'consent' && e[1] === 'default'))).length === 0, mid.dataLayer);
    // Try to make the (supposedly dead) analytics send anything:
    await s.evalJs('(function () { if (typeof window.offbeatTrack === "function") window.offbeatTrack("affiliate_click", { merchant: "zzounds", category: "headphone" }); return "ok"; })()');
    await s.evalJs('(function () { try { history.pushState({}, "", "/after-withdraw.html"); } catch (e) { } window.dispatchEvent(new PopStateEvent("popstate")); return "ok"; })()');
    await sleep(1800);
    const sameDoc = s.ctx.captures.length - midCount;
    assert('T4 post-reload same doc: ZERO further Google egress (affiliate event + history)', sameDoc === 0, s.ctx.captures.slice(midCount).map(c => c.url).slice(0, 5));
    await s.navigate(BASE + '/best-dj-mixers-beginners.html');
    const fin = await s.state();
    const nextPage = s.ctx.captures.length - midCount - sameDoc;
    assert('T4 next real page: ZERO Google egress', nextPage === 0, s.ctx.captures.slice(midCount).map(c => c.url));
    assert('T4 next real page: tag NOT loaded', fin.tagLoaded === false || fin.tagLoaded === undefined, fin.tagLoaded);
    assert('T4 next real page: no _ga cookie', !hasGaCookie(fin.cookie), fin.cookie);
    assert('T4 next real page: denied + Turn-on control', fin.consentState === 'denied' && (fin.buttons || []).includes('Turn on analytics'), fin);
    await s.cleanup();
  }

  /* ---- T5 persistence: prior consent honored on a second real page -------- */
  console.log('\n== T5 persistence: consented reload loads the real tag + one pageview per page ==');
  s = await startScenario(5, BASE + '/index.html');
  if (s.fatal) { fatalCount++; assert('T5 startup: ' + s.fatal, false); s = null; }
  if (s) {
    await s.clickBtn('Allow analytics');
    await s.waitFor(TAG_EXPR, 25000);
    await sleep(SETTLE * 2);
    await s.navigate(BASE + '/best-dj-mixers-beginners.html');
    // The real tag may deliver page 2's pageview with a delay (~5s observed,
    // batched by GA); poll for it instead of guessing a fixed sleep.
    let got2 = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      if (/best-dj-mixers-beginners\.html/.test(searchText(s))) { got2 = true; break; }
      await sleep(400);
    }
    await sleep(400);
    const st2 = await s.state();
    const allText = searchText(s);
    assert('T5 tag loaded on the second page too', st2.tagLoaded === true, { tagLoaded: st2.tagLoaded, caps: s.ctx.captures.length });
    assert('T5 pageview for page 1 captured (decoded)', /index\.html/.test(allText), s.ctx.captures.map(c => c.url).slice(0, 4).map(u => u.slice(0, 90)));
    assert('T5 pageview for page 2 captured (decoded)', got2 && /best-dj-mixers-beginners\.html/.test(allText), s.ctx.captures.map(c => c.url).slice(0, 6).map(u => u.slice(0, 90)));
    assert('T5 at least one page_view per page', (allText.match(/page_view|PAGE_VIEW/g) || []).length >= 2, (allText.match(/page_view|PAGE_VIEW/g) || []).length);
    assert('T5 _ga cookie persists across pages', hasGaCookie(st2.cookie), st2.cookie);
    await s.cleanup();
  }

  /* ---- T6 outbound merchant link: nothing leaks --------------------------- */
  console.log('\n== T6 outbound link: merchant URL + token never sent (EM outbound OFF) ==');
  s = await startScenario(6, BASE + '/index.html');
  if (s.fatal) { fatalCount++; assert('T6 startup: ' + s.fatal, false); s = null; }
  if (s) {
    await s.clickBtn('Allow analytics');
    await s.waitFor(TAG_EXPR, 25000);
    await sleep(SETTLE * 2);
    const n0 = s.ctx.captures.length;
    const clicked = await s.evalJs('(function () { var a = document.createElement("a"); a.href = "https://merchant.example/shop?aff=' + SECRET + '&ref=cart"; a.id = "__obLink"; a.rel = "noopener"; a.target = "_blank"; document.body.appendChild(a); window.addEventListener("click", function (ev) { if (ev.target && ev.target.id === "__obLink") ev.preventDefault(); }, true); a.click(); return "clicked"; })()');
    assert('T6 test click executed', clicked === 'clicked', clicked);
    await sleep(2400);
    const allText = searchText(s);
    assert('T6 merchant domain + token NEVER in any captured request (raw + decoded)', allText.indexOf('merchant.example') === -1 && allText.indexOf(SECRET) === -1, allText.slice(0, 300));
    assert('T6 no outbound-click (link_out) event captured', allText.indexOf('link_out') === -1, allText.slice(0, 300));
    assert('T6 no new capture mentions the merchant', s.ctx.captures.slice(n0).map(capText).join(' ').indexOf('merchant.example') === -1, s.ctx.captures.slice(n0).length);
    await s.cleanup();
  }

  /* ---- T7 history: no double pageview ------------------------------------- */
  console.log('\n== T7 history: pushState/popstate produce no second pageview (EM history OFF) ==');
  s = await startScenario(7, BASE + '/index.html?secret=' + SECRET);
  if (s.fatal) { fatalCount++; assert('T7 startup: ' + s.fatal, false); s = null; }
  if (s) {
    await s.clickBtn('Allow analytics');
    await s.waitFor(TAG_EXPR, 25000);
    await sleep(SETTLE * 2);
    const n0 = s.ctx.captures.length;
    await s.evalJs('(function () { try { history.pushState({}, "", "/after-history.html"); } catch (e) { } window.dispatchEvent(new PopStateEvent("popstate")); return "ok"; })()');
    await sleep(2000);
    const after = s.ctx.captures.slice(n0);
    assert('T7 NO additional pageview after pushState/popstate', after.filter(c => /page_view|PAGE_VIEW/.test(capText(c))).length === 0, after.map(c => c.url).slice(0, 4));
    assert('T7 zero new GA egress from history navigation', after.length === 0 || after.every(c => !/page_view|PAGE_VIEW/.test(capText(c))), after.map(c => c.url).slice(0, 4));
    assert('T7 secret token never sent (whole scenario, raw + decoded)', searchText(s).indexOf(SECRET) === -1);
    await s.cleanup();
  }

  /* ---- T8 UI / accessibility ---------------------------------------------- */
  console.log('\n== T8 consent UI: accessible, unobtrusive, honest ==');
  s = await startScenario(8, BASE + '/index.html');
  if (s.fatal) { fatalCount++; assert('T8 startup: ' + s.fatal, false); s = null; }
  if (s) {
    const st = await s.state();
    assert('T8 region is an accessible landmark (role + label + live)', !!st.region && st.region.role === 'region' && !!st.region.label && st.region.live === 'polite', st.region);
    const btns = await s.evalJs('Array.prototype.map.call(document.querySelectorAll(".ob-consent-btn"), function (b) { return { tag: b.tagName, type: b.type, name: b.textContent.trim(), tabindex: b.tabIndex }; })') || [];
    assert('T8 native <button type=button>, named, in tab order', btns.length >= 2 && btns.every(b => b.tag === 'BUTTON' && b.type === 'button' && !!b.name && b.tabindex >= 0), btns);
    const rect = await s.evalJs('(function () { var r = document.querySelector(".ob-consent"); if (!r) return null; var b = r.getBoundingClientRect(); var cs = getComputedStyle(r); return { pos: cs.position, h: Math.round(b.height), w: Math.round(b.width), vw: window.innerWidth, vh: window.innerHeight }; })()');
    assert('T8 pre-choice: fixed, compact card (does not obscure)', !!rect && rect.pos === 'fixed' && rect.h <= rect.vh * 0.6 && rect.w <= 460, rect);
    assert('T8 wording does not call analytics "anonymous"', String(st.text || '').toLowerCase().indexOf('anonymous') === -1, st.text);
    await s.clickBtn('Allow analytics');
    await sleep(400);
    const st2 = await s.state();
    const rect2 = await s.evalJs('(function () { var r = document.querySelector(".ob-consent"); if (!r) return null; var b = r.getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width) }; })()');
    assert('T8 post-choice: collapsed to a compact pill (not a banner)', !!rect2 && rect2.h <= 120 && /pill/.test(st2.region ? st2.region.cls : ''), { rect2, cls: st2.region && st2.region.cls });
    assert('T8 post-choice: control persists (Change/withdraw visible)', (st2.buttons || []).some(b => /Change|Withdraw/.test(b)), st2.buttons);
    await s.cleanup();
  }

  console.log('\n== SUMMARY ==');
  console.log('REAL-TAG PASS ' + pass + '  FAIL ' + fail + (fatalCount ? '  FATAL ' + fatalCount : ''));
  process.exit(fail === 0 && fatalCount === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL DRIVER ERROR: ' + (e && e.stack || e));
    console.log('REAL-TAG PASS ' + pass + '  FAIL ' + (fail + 1) + ' (driver fatal)');
    process.exit(1);
  });
}

module.exports = { startScenario, TAG_EXPR, gaHost, adHost, capText, parseDL };
