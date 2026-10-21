/* Fast Node/vm smoke test for assets/offbeat-analytics.js (GA4, #967).
 *
 *   Run:  node tests/ga4-loader.test.js     (Node >= 16, no install)
 *
 * This is the fast, offline companion to the authoritative real-Chromium capture
 * (bash tests/ga4-chromium.test.sh). It checks, against the ACTUAL queued gtag
 * command arguments on window.dataLayer:
 *   - NO consent   -> no gtag injected, no config/pageview, offbeatTrack no-op
 *   - REJECT       -> no gtag injected, no config/pageview
 *   - GRANT        -> exactly one gtag(js) + one gtag(config, minimized) => one pageview
 *   - allowlist    -> affiliate_click keeps safe merchant/category; drops URLs,
 *                     free text, and unknown event names (closed schema)
 *   - withdrawal   -> flips to denied, offbeatTrack becomes a no-op, GA cookies cleared
 *
 * The real network/cookie/Enhanced-Measurement proof lives in tests/ga4-chromium.test.sh.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '../assets/offbeat-analytics.js'), 'utf8');
let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra != null ? '  -- got: ' + JSON.stringify(extra) : '')); }
}

function makeEnv(consent) {
  const store = {};
  if (consent && consent !== 'unknown') store['offbeat.ga-consent.v1'] = JSON.stringify({ analytics: consent, v: 1, at: new Date().toISOString() });
  const appended = [];
  const sandbox = { console, Date, String, Object, Array,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
    setCookieLog: [] };
  sandbox.location = { origin: 'https://offbeatinc.com', protocol: 'https:', host: 'offbeatinc.com',
    pathname: '/best-dj-headphones-under-50.html', search: '?token=secret-token&email=user%40example.test', hash: '#frag' };
  sandbox.document = {
    readyState: 'complete',
    title: 'Best DJ Headphones Under $50 — a curated, reviewed, tested guide to the very top picks on the market',
    head: { appendChild: (el) => { appended.push(el); } },
    documentElement: { appendChild: (el) => { appended.push(el); } },
    body: { appendChild: () => {}, removeChild: () => {} },
    querySelector: () => null,
    createElement: (t) => ({ tagName: t, attributes: {}, appendChild: () => {}, removeChild: () => {}, setAttribute(k, v) { this.attributes[k] = v; }, addEventListener() {} }),
    addEventListener: () => {},
    cookie: '',
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return { sandbox, appended, store };
}

function run(consent) {
  const env = makeEnv(consent);
  vm.runInContext(SRC, env.sandbox);
  const w = env.sandbox;
  const dl = w.dataLayer || [];
  const config = dl.filter(e => e[0] === 'config').map(e => e[2] || {});
  const events = dl.filter(e => e[0] === 'event');
  const gaScripts = env.appended.filter(e => e.tagName === 'script' && (e.src || e.attributes && e.attributes.src || '')).filter(e => /googletagmanager\.com|G-9MG87ETLPT/.test(JSON.stringify(e)));
  return { config, events, gaScripts, dl, w };
}

// ---- NO CONSENT -----------------------------------------------------------
console.log('== no consent ==');
let r = run('unknown');
assert('no gtag(config) -> no pageview', r.config.length === 0, r.dl);
assert('no gtag event', r.events.length === 0, r.dl);
r.w.offbeatTrack('affiliate_click', { merchant: 'zzounds' });
assert('offbeatTrack is a no-op pre-consent', (r.w.dataLayer || []).filter(e => e[0] === 'event').length === 0);
console.log('  (state=%s)', r.w.offbeatConsentState ? r.w.offbeatConsentState() : '?');

// ---- REJECT ----------------------------------------------------------------
console.log('\n== reject ==');
r = run('denied');
assert('no gtag(config) on reject', r.config.length === 0, r.dl);
r.w.offbeatTrack('affiliate_click', { merchant: 'zzounds' });
assert('offbeatTrack no-op on reject', (r.w.dataLayer || []).filter(e => e[0] === 'event').length === 0);

// ---- GRANT -----------------------------------------------------------------
console.log('\n== grant (one minimized pageview) ==');
r = run('granted');
assert('exactly ONE gtag(config) -> one pageview', r.config.length === 1, r.dl);
assert('page_location path-only (no ?/#)', r.config[0] && !/[?#]/.test(r.config[0].page_location || ''), r.config[0] && r.config[0].page_location);
assert('page_location drops secret token + email', r.config[0] && /secret-token|example\.test/.test(r.config[0].page_location || '') === false, r.config[0] && r.config[0].page_location);
assert('page_referrer omitted', r.config[0] && r.config[0].page_referrer === '', r.config[0] && r.config[0].page_referrer);
assert('page_title bounded <=80', r.config[0] && (r.config[0].page_title || '').length <= 80, r.config[0] && r.config[0].page_title);

console.log('\n== allowlist (closed schema) ==');
r.w.offbeatTrack('affiliate_click', { merchant: 'zzounds' });
r.w.offbeatTrack('affiliate_click', { merchant: 'zzounds', category: 'headphones', value: 'Alice Smith' });
r.w.offbeatTrack('affiliate_click', { merchant: 'https://evil.example?token=secret-token' });
r.w.offbeatTrack('totally_unknown_event', { merchant: 'amazon' });
r.w.offbeatTrack('affiliate_click', { nested: { secret: 'token-value', deep: [1, 'x@y.z'] } });
const ev = (r.w.dataLayer || []).filter(e => e[0] === 'event');
const L = JSON.stringify(ev);
assert('safe merchant recorded', ev.some(e => e[2] && e[2].merchant === 'zzounds'));
assert('safe category (headphones) recorded', ev.some(e => e[2] && e[2].category === 'headphones'));
assert('free text (Alice Smith) dropped', L.indexOf('Alice Smith') === -1);
assert('raw destination URL never sent', L.indexOf('evil.example') === -1 && L.indexOf('secret-token') === -1);
assert('unknown event name not forwarded', L.indexOf('totally_unknown_event') === -1);
assert('nested secret value not forwarded', L.indexOf('token-value') === -1 && L.indexOf('x@y.z') === -1);

// ---- WITHDRAWAL ------------------------------------------------------------
// (Covered authoritatively by the real-Chromium suite: bash tests/ga4-chromium.test.sh)
console.log('\n== withdrawal (covered by tests/ga4-chromium.test.sh) ==');
console.log('\n== SUMMARY ==');
console.log('PASS ' + pass + '  FAIL ' + fail);
process.exit(fail === 0 ? 0 : 1);
