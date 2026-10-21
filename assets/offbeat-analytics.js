/* Offbeat Inc. analytics — Google Analytics 4 (GA4).
 *
 * Owner-verified property: G-9MG87ETLPT (property "Offbeat", web stream
 * https://offbeatinc.com). This file is the SINGLE GA4 loader for every
 * offbeatinc.com page. It is loaded once per page via:
 *     <script defer src="assets/offbeat-analytics.js"></script>
 *
 * DATA-MINIMIZATION CONTRACT (see Privacy Policy, "Information We Collect"):
 *   We do NOT promise that no personal data can ever reach Google — GA4 still
 *   sends the standard telemetry it always sends (approximate location,
 *   browser / device / OS, interaction events) and sets a first-party `_ga`
 *   cookie. What we *do* do, deliberately and testably, is shrink the surface
 *   of what we put in front of GA4:
 *
 *     1. One boot, one measurement: gtag.js is inserted at MOST once and
 *        `gtag('config', G-9MG87ETLPT)` fires EXACTLY once, so the default
 *        `page_view` fires exactly once per page (no double counting).
 *        Re-running this file is a no-op.
 *
 *     2. URL minimization. GA4's default `page_location` is the full URL
 *        including the query string and fragment. We override it to only
 *        `origin + pathname` (e.g. `https://offbeatinc.com/best-ddj-flx3.html`)
 *        so a `?email=…`, `?token=…` or `#…` in the address bar is not sent.
 *        `page_referrer` is likewise trimmed to `origin + path`, and
 *        `page_title` is bounded (trimmed, 200 chars) instead of the raw DOM
 *        title.
 *
 *     3. Custom-event sanitization (fail closed, not shallow key-list).
 *        `offbeatTrack(name, params)` recursively walks the params object:
 *          - drops any PARAM KEY (at any nesting depth) that looks like PII;
 *          - drops any VALUE that looks like PII (email, phone, long blob,
 *            token/secret);
 *          - drops event names that are PII.
 *        We send only what is left. If you hand it a value we cannot prove
 *        safe, that value is dropped. This is a best-effort data-minimization
 *        filter, not a guarantee that arbitrary unknown future keys can never
 *        be PII.
 *
 *     4. Advertising tech is denied by default. We set Google Consent Mode v2
 *        defaults: `ad_storage` / `ad_user_data` / `ad_personalization`
 *        denied, `analytics_storage` granted. No ad cookies, no ad
 *        personalization on offbeatinc.com.
 *
 *   We still failsafe: if the Google script is blocked or offline the page
 *   still renders and every handler is a no-op (no exceptions).
 *
 * This is a source-only, DRAFT change. It creates no Google account, no new
 * property, and no credential, and it does not affect any other site.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var PROPERTY = 'G-9MG87ETLPT';
  var GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + PROPERTY;

  /* ---- backward-compatible stubs -----------------------------------------
   * Kept so any pre-existing inline handler that references dataLayer/gtag/
   * offbeatTrack on a not-yet-loaded document continues to be safe. */
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  /* ---- PII handling (data minimization, fail closed) --------------------- */
  // Keys whose presence means "do not forward this value" (checked at EVERY
  // nesting depth, case-insensitive).
  var PII_KEYS = [
    'email', 'e-mail', 'mail', 'email_address', 'user_email',
    'name', 'first_name', 'last_name', 'fullname', 'full_name', 'username',
    'phone', 'tel', 'telephone', 'mobile', 'phone_number',
    'address', 'street', 'address1', 'address2', 'address_line', 'city',
    'region', 'state', 'zip', 'zipcode', 'postcode', 'postal', 'company',
    'message', 'msg', 'comment', 'body', 'textarea', 'bio',
    'password', 'passwd', 'secret', 'token', 'api_key', 'apikey',
    'access_token', 'refresh_token', 'auth', 'session', 'session_id',
    'card', 'card_number', 'ssn', 'social', 'bank', 'iban', 'cvv', 'dob',
    'birthdate', 'birth_date', 'birthday'
  ];

  // Value-level signatures (defense in depth: a value that looks like PII is
  // dropped even if its key does not match the list above).
  var EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]+/i;
  var TOKEN_RE = /(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer|authorization|jwt)[=:]/i;
  var MAX_SAFE_VALUE_LEN = 120;              // longer strings -> blob/message -> drop

  function isPIIKey(k) {
    return PII_KEYS.indexOf(String(k).toLowerCase()) !== -1;
  }

  function isPIIValue(v) {
    if (typeof v !== 'string') return false; // numeric/boolean ids kept (avoid false positives)
    if (v.length > MAX_SAFE_VALUE_LEN) return true;          // long blob / pasted body / token
    if (EMAIL_RE.test(v)) return true;
    if (TOKEN_RE.test(v)) return true;
    // Human phone: separator present, 7-15 digits. Pure integer ids are NOT flagged.
    var digits = v.replace(/\D/g, '');
    if (/[\s\-().+]/.test(v) && digits.length >= 7 && digits.length <= 15) return true;
    return false;
  }

  // Recursively sanitize. Returns the cleaned object, or `undefined` for a
  // dropped leaf. Depth-bounded so pathological structures fail closed.
  function sanitizeParams(value, depth) {
    if (value === null || value === undefined) return value;
    depth = depth || 0;
    if (depth > 6) return undefined;                       // too deep -> drop (fail closed on structure)
    var t = typeof value;
    if (t === 'string') return isPIIValue(value) ? undefined : value;
    if (t === 'number' || t === 'boolean') return value;
    if (Object.prototype.toString.call(value) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        var ci = sanitizeParams(value[i], depth + 1);
        if (ci !== undefined) arr.push(ci);
      }
      return arr;
    }
    if (t === 'object') {
      var out = {};
      for (var k in value) {
        if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
        if (isPIIKey(k)) continue;                          // drop PII key at any depth
        var cv = sanitizeParams(value[k], depth + 1);
        if (cv !== undefined) out[k] = cv;
      }
      return out;
    }
    return undefined;                                       // functions / other -> drop
  }

  window.offbeatTrack = function (eventName, params) {
    try {
      var name = String(eventName == null ? '' : eventName).slice(0, 128);
      if (!name) return;
      if (isPIIKey(name) || isPIIValue(name)) return;       // drop PII event names
      var clean = sanitizeParams(params, 0);
      var payload = (clean && typeof clean === 'object') ? clean : {};
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, payload);
      }
    } catch (e) { /* analytics must never break the page */ }
  };

  /* ---- URL / referrer / title minimization ------------------------------ */
  function safePath() {
    try {
      var l = window.location;
      var origin = l.origin || (l.protocol ? l.protocol + '//' + l.host : '');
      if (!origin) return 'https://offbeatinc.com/';
      var path = l.pathname || '/';
      return origin + path;                                  // no search, no hash
    } catch (e) { return 'https://offbeatinc.com/'; }
  }
  function safeReferrer() {
    try {
      var r = String(document.referrer || '');
      if (!r) return '';
      var m = r.match(/^(https?:\/\/[^\/]+)(\/[^#?]*)?/i);    // origin + path only
      if (!m) return '';
      return m[1] + (m[2] || '/');
    } catch (e) { return ''; }
  }
  function safeTitle() {
    try {
      var t = String(document.title || '').replace(/\s+/g, ' ').trim();
      return t.slice(0, 200);
    } catch (e) { return ''; }
  }

  /* ---- single, idempotent GA4 boot --------------------------------------- */
  function ensureBoot() {
    if (window.__offbeatGA4Ready) return;              // already booted: never re-run
    if (typeof document === 'undefined' || !document.head) return;
    window.__offbeatGA4Ready = true;                    // set before async load to stop re-entry

    // Reuse an already-present gtag.js (idempotent); otherwise inject one.
    var already = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (!already) {
      var s = document.createElement('script');
      s.async = true;
      s.src = GA_SRC;
      s.setAttribute('crossorigin', 'anonymous');
      s.onerror = function () { /* blocked/offline: page still works */ };
      (document.head || document.documentElement).appendChild(s);
    }
    window.gtag('js', new Date());
    // Consent Mode v2 conservative defaults: no ad-tech; analytics allowed.
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    // Exactly one config for this property => exactly one default page_view.
    // URL/referrer/title are minimized so query strings, fragments and a
    // sensitive external referrer are not forwarded.
    window.gtag('config', PROPERTY, {
      send_page_view: true,
      page_location: safePath(),
      page_referrer: safeReferrer(),
      page_title: safeTitle()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBoot, { once: true });
  } else {
    ensureBoot();
  }
})();
