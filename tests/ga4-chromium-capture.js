/* Assertion runner for GA4 consent/minimization capture.
 * Reads per-scenario JSON results (produced by tests/ga4-chromium.test.sh ->
 * tests/ga4-server.js + real headless Chromium) and checks the privacy contract.
 *
 *   node tests/ga4-chromium-capture.js <resultsDir>
 *   Exit 0 on all-pass, 1 on any failure.
 */
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2] || '.';
let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra != null ? '  -- got: ' + JSON.stringify(extra) : '')); }
}
function load(name) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8')); }
  catch (e) { return null; }
}
function hasGaCookie(c) { return /(^|; )(_ga|_ga_9MG87ETLPT)=/.test(c || ''); }
function configs(o) { return (o && o.gtagLog ? o.gtagLog : []).filter(e => e[0] === 'config').map(e => e[2] || {}); }
function evLog(o) { return JSON.stringify((o && o.gtagLog) || []); }
function events(o) { return ((o && o.gtagLog) || []).filter(e => e[0] === 'event'); }
// Consent Mode v2: explicit default (all four denied) -> explicit update
// (analytics granted, ad types denied) -> exactly this order, before config.
function seqAsserts(label, o) {
  const log = (o && o.gtagLog) || [];
  const iDefault = log.findIndex(e => e[0] === 'consent' && e[1] === 'default');
  const iUpdate = log.findIndex(e => e[0] === 'consent' && e[1] === 'update' && e[2] && e[2].analytics_storage === 'granted');
  const iCfg = log.findIndex(e => e[0] === 'config');
  const d = iDefault >= 0 ? log[iDefault][2] : null;
  const u = iUpdate >= 0 ? log[iUpdate][2] : null;
  assert(label + ': consent default declared with all four types denied', iDefault !== -1 && d && d.ad_storage === 'denied' && d.ad_user_data === 'denied' && d.ad_personalization === 'denied' && d.analytics_storage === 'denied', d);
  assert(label + ': explicit update grants analytics_storage, keeps ad types denied', iUpdate !== -1 && u && u.analytics_storage === 'granted' && u.ad_storage === 'denied' && u.ad_user_data === 'denied' && u.ad_personalization === 'denied', u);
  assert(label + ': command order default -> update -> config', iDefault !== -1 && iUpdate !== -1 && iCfg !== -1 && iDefault < iUpdate && iUpdate < iCfg, { iDefault, iUpdate, iCfg });
}

console.log('--- fresh (no consent) ---');
let o = load('fresh');
if (!o) { console.log('  MISSING fresh.json'); process.exit(1); }
assert('choice UI present', o.ui.present && o.ui.buttons.includes('Allow analytics'), o.ui);
assert('"Do not allow" equal prominence (no dark pattern)', o.ui.buttons.includes('Do not allow'), o.ui);
assert('consent state unknown', o.consentState === 'unknown', o.consentState);
assert('ZERO Google resource requests', (o.googleResources || []).length === 0, o.googleResources);
assert('ZERO GA cookie', !hasGaCookie(o.cookies), o.cookies);

console.log('\n--- reject-click ---');
o = load('reject-click');
assert('consent denied', o && o.consentState === 'denied', o && o.consentState);
assert('still ZERO Google resource requests', o && (o.googleResources || []).length === 0, o && o.googleResources);
assert('still ZERO GA cookie', o && !hasGaCookie(o.cookies), o && o.cookies);
assert('can revisit (Turn on) shown', o && o.ui.buttons.includes('Turn on analytics'), o && o.ui);

console.log('\n--- accept-click (consented) ---');
o = load('accept-click');
const cA = configs(o);
assert('consent granted', o && o.consentState === 'granted', o && o.consentState);
assert('exactly ONE gtag config => one pageview', cA.length === 1, o && o.gtagLog);
assert('exactly ONE gtag(js) init', o && (o.gtagLog || []).filter(e => e[0] === 'js').length === 1);
assert('page_location has NO query token/email', cA[0] && /secret-token|email=|example\.test/i.test(cA[0].page_location || '') === false, cA[0] && cA[0].page_location);
assert('page_location is path-only (no ? or #)', cA[0] && !/[?#]/.test(cA[0].page_location || ''), cA[0] && cA[0].page_location);
assert('page_referrer omitted (empty)', cA[0] && cA[0].page_referrer === '', cA[0] && cA[0].page_referrer);
assert('page_title bounded <=80', cA[0] && (cA[0].page_title || '').length <= 80, cA[0] && cA[0].page_title);
seqAsserts('accept', o);
assert('GA cookie set ONLY after consent', o && hasGaCookie(o.cookies), o && o.cookies);
assert('no real Google fetch (stubbed locally)', o && (o.googleResources || []).length === 0, o && o.googleResources);

console.log('\n--- preset-granted (persistence) ---');
o = load('preset-granted');
const cP = configs(o);
assert('prior consent honored on reload', o && o.consentState === 'granted', o && o.consentState);
assert('exactly ONE config on reload', cP.length === 1, o && o.gtagLog);
assert('minimized pageview on reload (path-only)', cP[0] && !/[?#]/.test(cP[0].page_location || ''), cP[0] && cP[0].page_location);
seqAsserts('preset-granted', o);
assert('GA cookie present (from prior consent)', o && hasGaCookie(o.cookies), o && o.cookies);

console.log('\n--- preset-denied (reload after prior deny / after withdrawal) ---');
o = load('preset-denied');
assert('persisted denial honored on fresh load', o && o.consentState === 'denied', o && o.consentState);
assert('ZERO Google resource requests (no tag loaded)', o && (o.googleResources || []).length === 0, o && o.googleResources);
assert('ZERO GA cookie', o && !hasGaCookie(o.cookies), o && o.cookies);
assert('no gtag config issued (no pageview)', o && (o.gtagLog || []).filter(e => e[0] === 'config').length === 0, o && o.gtagLog);
assert('can still turn on (revisit) shown', o && o.ui.buttons.includes('Turn on analytics'), o && o.ui);

console.log('\n--- withdraw ---');
o = load('withdraw');
assert('consent denied after withdraw', o && o.consentState === 'denied', o && o.consentState);
const ups = (o && o.gtagLog ? o.gtagLog : []).filter(e => e[0] === 'consent' && e[1] === 'update');
assert('final consent UPDATE is a full denial (analytics + ad types)', ups.length >= 1 && ups[ups.length - 1][2] && ups[ups.length - 1][2].analytics_storage === 'denied' && ups[ups.length - 1][2].ad_storage === 'denied' && ups[ups.length - 1][2].ad_user_data === 'denied' && ups[ups.length - 1][2].ad_personalization === 'denied', o && o.gtagLog);
assert('first-party _ga cookie cleared on withdraw', o && !hasGaCookie(o.cookies), o && o.cookies);

console.log('\n--- secret-query (?q=...&email=...) ---');
o = load('secret-query');
const cS = configs(o);
assert('secret token NOT in page_location', cS[0] && (cS[0].page_location || '').indexOf('secret-token') === -1, cS[0] && cS[0].page_location);
assert('email NOT in page_location', cS[0] && /example\.test/.test(cS[0].page_location || '') === false, cS[0] && cS[0].page_location);
assert('affiliate_click dropped destination URL/token', o && evLog(o).indexOf('secret-token') === -1 && evLog(o).indexOf('destination') === -1, o && o.gtagLog);
assert('safe merchant still recorded', o && events(o).some(e => e[1] === 'affiliate_click' && e[2] && e[2].merchant === 'zzounds'), o && o.gtagLog);

console.log('\n--- arbitrary-event (closed allowlist) ---');
o = load('arbitrary-event');
const L = evLog(o), E = events(o);
assert('safe merchant allowed', E.some(e => e[2] && e[2].merchant === 'zzounds' && !e[2].category), o && o.gtagLog);
assert('safe category kept, free text (Alice Smith) dropped', E.some(e => e[2] && e[2].merchant === 'zzounds' && e[2].category === 'headphones') && L.indexOf('Alice Smith') === -1, o && o.gtagLog);
assert('URL merchant value / raw destination never sent', L.indexOf('evil.example') === -1 && L.indexOf('secret-token') === -1);
assert('unknown event name NOT forwarded', L.indexOf('totally_unknown_event') === -1);
assert('nested secret value NOT forwarded', L.indexOf('token-value') === -1 && L.indexOf('x@y.z') === -1);

console.log('\n--- history (pushState) ---');
o = load('history');
const cH = configs(o);
assert('still exactly ONE config (no double pageview)', cH.length === 1, o && o.gtagLog);
assert('no secret token anywhere', o && evLog(o).indexOf('secret-token') === -1);

console.log('\n--- accessibility: desktop + mobile ---');
const mob = load('fresh-mobile');
assert('mobile: choice UI present', mob && mob.ui.present, mob && mob.ui);
assert('mobile: Allow + Do-not-allow both present', mob && mob.ui.buttons.includes('Allow analytics') && mob.ui.buttons.includes('Do not allow'), mob && mob.ui);
const des = load('fresh');
assert('desktop: choice UI present', des && des.ui.present, des && des.ui);

console.log('\n== SUMMARY ==');
console.log('PASS ' + pass + '  FAIL ' + fail);
process.exit(fail === 0 ? 0 : 1);
