/* Functional + privacy proof for assets/offbeat-analytics.js (Node vm sandbox).
 *
 *   Run (no npm install needed):  node tests/ga4-loader.test.js
 *   Exits 0 on all-pass, 1 on any fail. Node >= 16.
 *
 * This goes beyond "script count / page_view count": it inspects the ACTUAL
 * arguments pushed onto window.dataLayer (the GA4 command queue) and asserts the
 * data-minimization contract:
 *
 *   A. Exactly one gtag.js, one gtag(js), one gtag(config) => one page_view;
 *      re-running the file is a no-op (idempotent). Works in 'complete' and
 *      'loading' (DOMContentLoaded) modes.
 *   B. page_location = origin+path ONLY (query string `?email=…&token=…` and
 *      `#fragment` are NOT forwarded).
 *   C. page_referrer trimmed to origin+path (sensitive query/fragment dropped).
 *   D. page_title bounded (<=200 chars).
 *   E. offbeatTrack(): top-level PII keys dropped; NESTED PII keys dropped;
 *      email / phone / long-blob / token VALUES dropped even under an innocuous
 *      key; safe params kept; PII event names dropped. Fail-closed (dropped
 *      values not leaked, safe siblings preserved).
 *   F. Consent Mode defaults: ad-tech denied, analytics granted.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../assets/offbeat-analytics.js'), 'utf8');

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// Build a fresh sandbox with a configurable URL / referrer / title.
function makeEnv(loc, readyState) {
  const appended = [];
  const sandbox = {
    console, Date, String, Object, Array,
    encodeURIComponent, Math, RegExp,
    location: loc || { origin: 'https://offbeatinc.com', protocol: 'https:', host: 'offbeatinc.com', pathname: '/best-ddj-flx3.html', search: '', hash: '' },
    __title: 'Best DJ Headphones',
    _listenerStore: {},
  };
  sandbox.document = {
    readyState: readyState || 'complete',
    title: sandbox.__title,
    referrer: (loc && loc.referrer) || '',
    head: { appendChild: (el) => { appended.push(el); } },
    documentElement: { appendChild: (el) => { appended.push(el); } },
    querySelector: () => null,                       // no pre-existing gtag.js
    createElement: (tag) => ({ tagName: tag, attributes: {}, setAttribute(k, v) { this.attributes[k] = v; } }),
    addEventListener: (ev, fn) => { (sandbox.document._listeners = sandbox.document._listeners || {})[ev] = (sandbox.document._listeners[ev] || []).concat(fn); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return { sandbox, appended };
}

function boot(env) {
  vm.runInContext(src, env.sandbox);
  const w = env.sandbox;
  if (w.document.readyState === 'loading' && w.document._listeners && w.document._listeners['DOMContentLoaded']) {
    w.document._listeners['DOMContentLoaded'].forEach((fn) => fn());
  }
  return w;
}

const dataLayer = (w) => w.dataLayer || [];
const configs = (w, p) => dataLayer(w).filter((e) => e[0] === 'config' && e[1] === p);
const events = (w, name) => dataLayer(w).filter((e) => e[0] === 'event' && e[1] === name);
const consents = (w) => dataLayer(w).filter((e) => e[0] === 'consent')[0];

const PROP = 'G-9MG87ETLPT';

/* ================= Test A: single page_view + idempotency + URL minimization
================================================ ================= */
console.log('== Test A: single page_view, idempotent, URL minimized (sensitive query/referrer) ==');
const dirtyQuery = {
  origin: 'https://offbeatinc.com', protocol: 'https:', host: 'offbeatinc.com',
  pathname: '/best-dj-headphones-under-50.html',
  search: '?email=user@example.test&token=secret&ref=partner',
  hash: '#secret-anchor',
  referrer: 'https://tracker.example-evil.com/log?email=admin@corp.com&session=abc123',
};
{
  const A = makeEnv(dirtyQuery, 'complete');
  A.sandbox.__title = 'Best DJ Headphones Under $50 — huge title that would normally be forwarded verbatim';
  const w = boot(A);
  // Re-run the exact same file in the SAME context (simulates double-injection guard).
  vm.runInContext(src, w);

  const gaJs = A.appended.filter((e) => (e.src || '').includes('googletagmanager.com/gtag/js')).length;
  assert('exactly one gtag.js inserted', gaJs === 1);
  assert('exactly one gtag(js) init', dataLayer(w).filter((e) => e[0] === 'js').length === 1);
  const cfg = configs(w, PROP);
  assert('exactly one gtag(config) => one page_view', cfg.length === 1);
  const params = cfg[0] ? cfg[0][2] : {};

  assert('config carries page_location', params.page_location === 'https://offbeatinc.com/best-dj-headphones-under-50.html');
  assert('page_location drops the QUERY STRING (?email…&token…ref…)',
    !/email=|token=|ref=|secret/i.test(params.page_location || ''));
  assert('page_location drops the FRAGMENT (#secret-anchor)',
    !params.page_location || !params.page_location.includes('#'));
  assert('page_referrer is origin+path only (no ?…&session=…)',
    params.page_referrer === 'https://tracker.example-evil.com/log');
  assert('page_referrer drops the sensitive query',
    !/email=|session=|admin@corp/i.test(params.page_referrer || ''));
  assert('page_title bounded to <=200 chars', (params.page_title || '').length <= 200);
  assert('page_title not empty for a normal page', (params.page_title || '').length > 0);

  const c = consents(w);
  assert('consent default present', !!c);
  assert('ad_storage denied', c && c[2] && c[2].ad_storage === 'denied');
  assert('ad_user_data denied', c && c[2] && c[2].ad_user_data === 'denied');
  assert('ad_personalization denied', c && c[2] && c[2].ad_personalization === 'denied');
  assert('analytics_storage granted (pages stay operational)', c && c[2] && c[2].analytics_storage === 'granted');
}

/* ================= Test B: DOMContentLoaded mode =================
================================================ ================= */
console.log('\n== Test B: document still loading (DOMContentLoaded) — still one page_view ==');
{
  const B = makeEnv(dirtyQuery, 'loading');
  const w = boot(B);
  assert('one gtag(js) after DOMContentLoaded', dataLayer(w).filter((e) => e[0] === 'js').length === 1);
  const cfg = configs(w, PROP);
  assert('one config => one page_view', cfg.length === 1);
  assert('page_location still drops query/fragment',
    !!cfg[0] && !!cfg[0][2] &&
    cfg[0][2].page_location === 'https://offbeatinc.com/best-dj-headphones-under-50.html' &&
    !/[?#]/.test(cfg[0][2].page_location));
}

/* ================= Test C: offbeatTrack PII / fail-closed ============
================================================ ================= */
console.log('\n== Test C: offbeatTrack recursive PII stripping + fail-closed (inspect queued args) ==');
{
  const C = makeEnv(dirtyQuery, 'complete');
  const w = boot(C);

  // 1) Top-level PII keys + one safe sibling.
  w.offbeatTrack('affiliate_click', {
    email: 'x@y.z', name: 'Bob', phone: '+1 (555) 0142', address: '1 Main St',
    merchant: 'zzounds', item_id: 42
  });
  let p = (events(w, 'affiliate_click')[0] || [])[2] || {};
  assert('event recorded (affiliate_click)', p !== null && typeof p === 'object');
  const leak = JSON.stringify(p);
  assert('email value gone', !/x@y\.z/i.test(leak));
  assert('name/key gone', !('name' in p) && !/\"Bob\"/.test(leak));
  assert('phone value gone', !/555-?0142|\(555\)/.test(leak));
  assert('address/key gone', !('address' in p) && !/1 Main St/.test(leak));
  assert('safe merchant kept', p.merchant === 'zzounds');
  assert('safe numeric item_id kept', p.item_id === 42);

  // 2) NESTED PII under innocuous keys must be dropped too.
  w.offbeatTrack('checkout_view', {
    plan: 'pro',
    user: { first_name: 'Alice', last_name: 'Wong', contact: { email: 'a@b.io' } },
    safe_flag: true
  });
  p = (events(w, 'checkout_view')[0] || [])[2] || {};
  const leak2 = JSON.stringify(p);
  assert('nested name (user.first_name) gone', !/Alice/.test(leak2) && !/Wong/.test(leak2));
  assert('nested email (user.contact.email) gone', !/a@b\.io/.test(leak2));
  assert('safe top-level plan kept', p.plan === 'pro');
  assert('safe boolean flag kept', p.safe_flag === true);

  // 3) Email / token VALUE under an INNOCUOUS key (deep value filter, fail closed).
  w.offbeatTrack('form_submit', {
    field: 'newsletter',
    value: 'please-subscribe@user.example',          // innocuous key "value"
    api_key: 'sk-live-1234567890abcdef'              // PII key + token value
  });
  p = (events(w, 'form_submit')[0] || [])[2] || {};
  const leaky3 = JSON.stringify(p);
  assert('email under innocuous "value" key dropped', !/please-subscribe@/.test(leaky3));
  assert('api_key dropped (key list)', !('api_key' in p) && !/sk-live-/.test(leaky3));

  // 4) Long blob (pasted body/secret) dropped even with a safe key.
  const blob = 'A'.repeat(200);
  w.offbeatTrack('note_view', { label: 'ok', comment_body: blob });
  p = (events(w, 'note_view')[0] || [])[2] || {};
  assert('long blob value dropped', JSON.stringify(p).indexOf(blob) === -1);
  assert('safe label kept alongside dropped blob', p.label === 'ok');

  // 5) PII EVENT NAME dropped (not forwarded at all).
  w.offbeatTrack('user_jane@doe.example', { ok: 1 });
  assert('PII event name is NOT forwarded', events(w, 'user_jane@doe.example').length === 0);

  // 6) offbeatTrack must never throw.
  let threw = false;
  try { w.offbeatTrack('robust', { fn: function () {}, o: { a: 1 }, arr: [1, 'x@y.z', 2] }); } catch (e) { threw = true; }
  assert('offbeatTrack never throws (incl. functions + arrays)', threw === false);
  p = (events(w, 'robust')[0] || [])[2] || {};
  assert('array item email filtered, scalar kept', JSON.stringify(p).indexOf('x@y.z') === -1 && p.o && p.o.a === 1);
}

/* ================= Test D: 5 previously-tracking pages still work ====
================================================ ================= */
console.log('\n== Test D: all pages boot the same single loader (no page per page) ==');
{
  const D = makeEnv({ origin: 'https://offbeatinc.com', protocol: 'https:', host: 'offbeatinc.com', pathname: '/about.html', search: '', hash: '' }, 'complete');
  const w = boot(D);
  const cfg = configs(w, PROP);
  assert('about.html: exactly one config/page_view', cfg.length === 1);
  assert('about.html: page_location = origin+path', cfg[0] && cfg[0][2] && cfg[0][2].page_location === 'https://offbeatinc.com/about.html');
}

/* ================= Test E: fail-safe (no Google script) is still safe ==
================================================ ================= */
console.log('\n== Test E: PII/URL logic independent from Google script availability ==');
{
  // Even if gtag is a no-op (blocked), offbeatTrack sanitizes before calling it,
  // so the "payload" we WOULD send carries no PII. We capture what is pushed.
  const E = makeEnv(dirtyQuery, 'complete');
  const w = boot(E);
  w.offbeatTrack('capture', { note: 'hi', email: 'leak@x.com', user: { token: 'tok-abc-123' } });
  const p = (events(w, 'capture')[0] || [])[2] || {};
  const s = JSON.stringify(p);
  assert('would-be payload has safe note', p.note === 'hi');
  assert('would-be payload has NO email', !/leak@x\.com/.test(s));
  assert('would-be payload has NO nested token', !/tok-abc-123/.test(s) && !('token' in (p.user || {})));
}

/* ================= SUMMARY ================
================================================ ================= */
console.log('\n== SUMMARY ==');
console.log('PASS ' + pass + '  FAIL ' + fail);
process.exit(fail === 0 ? 0 : 1);
