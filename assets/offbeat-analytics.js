/* Offbeat Inc. analytics — Google Analytics 4 (GA4) — consent-gated, single loader.
 *
 * Owner-verified property: G-9MG87ETLPT (property "Offbeat", web stream
 * https://offbeatinc.com). This file is the SINGLE GA4 loader for the public site,
 * loaded once per page via:
 *     <script defer src="assets/offbeat-analytics.js"></script>
 *
 * DESIGN (privacy-bounded; see Privacy Policy §3 and the independent review of #967)
 * -------------------------------------------------------------------------------
 * The strongest, most testable way to stop analytics before consent — and thereby to
 * stop Google's automatic Enhanced Measurement (site-search, outbound clicks,
 * history) from running at all — is to NOT LOAD THE GOOGLE TAG until the visitor
 * affirmatively allows analytics. Basic-consent semantics are enforced by omission:
 *
 *   NO CONSENT / REJECT / WITHDRAW  ->  no gtag.js is injected, no request to
 *                                       Google, no _ga cookie is created. (Zero.)
 *   CONSENT                         ->  one minimized pageview (path-only URL,
 *                                       NO referrer, a short static title) plus an
 *                                       allowlisted "affiliate_click" event that
 *                                       records only merchant/category.
 *
 * What this file explicitly does AND does NOT do:
 *   - We minimize the one pageview we do send (page_location = origin+path only;
 *     page_referrer omitted; page_title bounded and sanitized).
 *   - We use a CLOSED allowlist for custom events (event names + field names +
 *     allowed enum values). URLs, query strings, free text and unknown values are
 *     dropped by construction — not a denylist of known-Pii names.
 *   - We remember the visitor's choice in first-party localStorage and honor it on
 *     every page/reload; withdrawal stops further sends and clears first-party GA
 *     cookies we may have set this session.
 *   - We do NOT set an unconditional `analytics_storage: granted` (see the "no
 *     unconditional grant" requirement). Consented means "we loaded the tag after
 *     the visitor opted in".
 *   - We do NOT and CANNOT disable Google Enhanced Measurement from source. That is
 *     a GA4 property/dashboard setting (Owner action: Admin -> Data collection and
 *     modification -> Data streams -> Offbeat web stream G-9MG87ETLPT -> Enhanced
 *     measurement: disable Site search, Outbound clicks, and history-based Page
 *     views for this static site). This file works with either setting; it never
 *     claims to change it.
 *   - We do NOT promise absolute absence of PII. Google collects some standard
 *     telemetry once a visitor has consented (that is why consent gates it).
 *
 * No new Google account, property or credential. No other site. DRAFT change.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var PROPERTY = 'G-9MG87ETLPT';
  var GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + PROPERTY;
  var STORE_KEY = 'offbeat.ga-consent.v1';
  var TITLE_MAX = 80;

  /* ---- first-party consent store (localStorage) --------------------------
   * Storing the visitor's OWN consent choice is a first-party, non-tracking
   * persistence mechanism; it is not an analytics cookie and it carries no data
   * about the visitor beyond "granted|denied". */
  var ls = {
    get: function (k) { try { return window.localStorage ? window.localStorage.getItem(k) : null; } catch (e) { return null; } },
    set: function (k, v) { try { if (window.localStorage) window.localStorage.setItem(k, v); } catch (e) { } },
    del: function (k) { try { if (window.localStorage) window.localStorage.removeItem(k); } catch (e) { } }
  };

  // 'unknown' => no choice recorded yet; 'denied'; 'granted'.
  function readConsent() {
    var raw = ls.get(STORE_KEY);
    if (!raw) return 'unknown';
    try { var o = JSON.parse(raw); return (o && o.analytics === 'granted') ? 'granted' : 'denied'; }
    catch (e) { return 'denied'; } // fail closed
  }
  function writeConsent(analysis) {
    ls.set(STORE_KEY, JSON.stringify({ analytics: analysis, v: 1, at: new Date().toISOString() }));
  }
  // Exposed (small, honest) so the UI and independent tests can read current state.
  window.offbeatConsentState = function () { return readConsent(); };

  /* ---- data minimization for the ONE pageview we send when consented ------ */
  var EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]+/i;
  function safePath() {
    try {
      var l = window.location;
      var origin = l.origin || (l.protocol ? l.protocol + '//' + l.host : '');
      if (!origin) return 'https://offbeatinc.com/';
      return origin + (l.pathname || '/'); // path only — no search, no hash
    } catch (e) { return 'https://offbeatinc.com/'; }
  }
  function safeTitle() {
    var s = String(document.title || '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
    if (!s) return '';
    if (EMAIL_RE.test(s)) return '';                        // no emails in title
    if (/(\+?1?[\s().-]?[0-9][0-9\s().-]{5,}[0-9])/.test(s)) return ''; // phone-like => drop
    if (/^(https?:)?\/\//.test(s) || /\?[a-z0-9_]+=/i.test(s)) return ''; // URL/query-like => drop
    return s;
  }

  /* ---- CLOSED allowlist for custom events (fail by construction) ---------
   * Only the exact event names below, with only the exact safe field names and
   * only the exact safe enum values, are ever forwarded. Anything else — a raw
   * destination URL, a search term, free text, a nested object, a number — is
   * dropped because it cannot match the closed schema. No arbitrary values. */
  var MERCHANT = { amazon: 1, zzounds: 1, sweetwater: 1, guitarcenter: 1, 'guitar-center': 1,
    pluginboutique: 1, loopmasters: 1, landr: 1, splice: 1, distrokid: 1, serato: 1, cdbaby: 1,
    other: 1 };
  var CATEGORY = { headphones: 1, 'headphone': 1, mixer: 1, controller: 1, monitor: 1, speaker: 1,
    interface: 1, software: 1, plugin: 1, 'sample-pack': 1, sample: 1, course: 1, stand: 1,
    turntable: 1, cartridge: 1, 'usb-drive': 1, cable: 1, accessory: 1, 'gig-bag': 1, other: 1 };
  var EVENTS = { 'affiliate_click': { merchant: MERCHANT, category: CATEGORY } };

  window.offbeatTrack = function (name, params) {
    try {
      if (readConsent() !== 'granted') return;                 // never transmit before consent
      var spec = EVENTS[String(name)];
      if (!spec) return;                                         // allowlist: unknown event dropped
      params = (params && typeof params === 'object') ? params : {};
      var payload = {};
      for (var k in spec) {
        if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
        var v = params[k];
        if (typeof v === 'string' && spec[k][v] === 1) payload[k] = v; // else dropped
      }
      if (typeof window.gtag === 'function') window.gtag('event', String(name), payload);
    } catch (e) { /* never break the page */ }
  };

  /* ---- consent UI (small, accessible, non-blocking, no dark patterns) -----
   * All buttons are real <button>s with clear, equal-prominence labels; the
   * site stays fully usable with analytics off. */
  var UI = null;
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) { for (var a in attrs) { if (a.charAt(0) === 'o' && a.charAt(1) === 'n' && typeof attrs[a] === 'function') { n[a] = attrs[a]; } else { n.setAttribute(a, attrs[a]); } } }
    if (text != null) n.textContent = text;
    return n;
  }
  function button(label, action) {
    var b = el('button', { type: 'button', 'class': 'ob-consent-btn' }, label);
    b.addEventListener('click', function () { handle(action); });
    return b;
  }
  function refresh(consent) {
    if (!document.body) return;
    if (UI && UI.parentNode) UI.parentNode.removeChild(UI); UI = null;
    UI = el('div', { 'class': 'ob-consent', role: 'region', 'aria-label': 'Analytics choice (Offbeat)', 'aria-live': 'polite' });
    var p = el('p', { 'class': 'ob-consent-text' });
    var row = el('div', { 'class': 'ob-consent-actions' });
    if (consent === 'unknown') {
      p.textContent = 'Allow Offbeat to collect anonymous usage analytics to help us improve the guides? We limit what is sent to minimal page-level information (which guide you viewed). You can change or withdraw this choice at any time.';
      row.appendChild(button('Allow analytics', 'grant'));
      row.appendChild(button('Do not allow', 'deny'));
    } else if (consent === 'denied') {
      p.textContent = 'Analytics is off for you.';
      row.appendChild(button('Turn on analytics', 'grant'));
    } else { // granted
      p.textContent = 'Analytics is on (minimal page-level data only).';
      row.appendChild(button('Change choice', 'reask'));
      row.appendChild(button('Withdraw consent', 'withdraw'));
    }
    UI.appendChild(p); UI.appendChild(row);
    document.body.appendChild(UI);
    if (consent === 'unknown') { UI.setAttribute('tabindex', '-1'); try { UI.focus({ preventScroll: true }); } catch (e) { } }
  }

  // Stop active sends if we had booted gtag this session, and clear 1st-party GA cookies.
  function revokeActive() {
    try { if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    } } catch (e) { }
    // GA sets first-party cookies named `_ga` plus `_ga_<id>` / `_ga4_<id>` where
    // <id> is the measurement id WITHOUT the `G-` prefix (confirmed by the
    // reviewer's real-Chromium capture: `_ga` and `_ga_9MG87ETLPT`). Expire all
    // plausible variants to avoid stale-consent / cookie leakage.
    var mid = String(PROPERTY).replace(/^G-/, '');
    ['_ga', '_ga_' + mid, '_ga4_' + mid, '_ga_' + PROPERTY, '_ga4_' + PROPERTY].forEach(function (c) {
      try { document.cookie = c + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; } catch (e) { }
    });
  }

  function handle(action) {
    if (action === 'grant') { writeConsent('granted'); applyConsent('granted'); }
    else if (action === 'deny') { writeConsent('denied'); applyConsent('denied'); }
    else if (action === 'withdraw') { writeConsent('denied'); revokeActive(); applyConsent('denied'); }
    else if (action === 'reask') { refresh('unknown'); } // let them pick again without changing the store yet
  }

  // Load + measure ONLY after affirmative consent. Idempotent (one tag, one config).
  function bootGtag() {
    if (window.__obGtagBooted) return;
    window.__obGtagBooted = true;
    // TEST SEAM ONLY (used by local Chromium capture tests in tests/). In production
    // this is undefined, so the real Google tag is injected below. Not a gate bypass.
    var hook = window.__OFFBEAT_ANALYTICS_TEST;
    if (hook && typeof hook.inject === 'function') { hook.inject(); }
    else if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      var s = el('script', null);
      s.async = true; s.src = GA_SRC; s.setAttribute('crossorigin', 'anonymous');
      s.onerror = function () { /* blocked: page still works */ };
      (document.head || document.documentElement).appendChild(s);
    }
    window.gtag('js', new Date());
    // One minimized pageview. No referrer. Bounded static title.
    window.gtag('config', PROPERTY, {
      send_page_view: true,
      page_location: safePath(),
      page_referrer: '',
      page_title: safeTitle()
    });
  }

  function applyConsent(consent) {
    if (consent === 'granted') bootGtag();
    refresh(consent);
  }

  function boot() {
    // Safe no-op gtag so any pre-existing reference is harmless.
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') { window.gtag = function () { window.dataLayer.push(arguments); }; }
    applyConsent(readConsent());   // consented -> boot+measure; else -> show choice UI, send nothing
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
