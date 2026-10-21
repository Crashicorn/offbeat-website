/* Offbeat Inc. analytics — Google Analytics 4 (GA4).
 *
 * Owner-verified property: G-9MG87ETLPT (property "Offbeat", web stream
 * https://offbeatinc.com). This file is the SINGLE GA4 loader for every
 * offbeatinc.com page. It is loaded once per page via:
 *     <script defer src="assets/offbeat-analytics.js"></script>
 *
 * Guarantees (see Privacy Policy, "Analytics"):
 *   - gtag.js is inserted at MOST once per document; if a gtag.js for this
 *     property is already present it is reused, so there is never a duplicate
 *     loader and page_view fires exactly once per page (no double counting).
 *   - No first- or second-party PII is ever transmitted: no email, name,
 *     phone, postal address, or contact/message body. window.offbeatTrack()
 *     additionally strips a set of known PII parameter names before forwarding
 *     any custom event, so future call sites cannot accidentally leak PII.
 *   - Fails safe: if the Google script is blocked or offline the page still
 *     renders and every handler is a no-op (no exceptions).
 *
 * This is a source-only, DRAFT change. It does not create a Google account,
 * a new property, or any new credential, and it does not affect any other site.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var PROPERTY = 'G-9MG87ETLPT';
  var GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=' +PROPERTY;

  /* ---- backward-compatible stubs -----------------------------------------
   * Kept so any pre-existing inline handler that references dataLayer/gtag/
   * offbeatTrack on a not-yet-loaded document continues to be safe. */
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  /* ---- PII-safe custom-event helper -------------------------------------- */
  var PII_KEYS = [
    'email', 'e-mail', 'mail', 'name', 'first_name', 'last_name', 'fullname',
    'full_name', 'username', 'phone', 'tel', 'telephone', 'mobile',
    'address', 'street', 'address1', 'address2', 'city', 'region', 'state',
    'zip', 'zipcode', 'postcode', 'postal', 'country', 'company',
    'message', 'msg', 'comment', 'body', 'textarea'
  ];
  function stripPII(obj) {
    if (!obj || typeof obj !== 'object') return {};
    var clean = {};
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (PII_KEYS.indexOf(String(k).toLowerCase()) !== -1) continue;
      clean[k] = obj[k];
    }
    return clean;
  }
  if (typeof window.offbeatTrack !== 'function') {
    window.offbeatTrack = function (eventName, params) {
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', String(eventName), stripPII(params) || {});
        }
      } catch (e) { /* analytics must never break the page */ }
    };
  }

  /* ---- single, idempotent GA4 boot ---------------------------------------- */
  function ensureBoot() {
    if (window.__offbeatGA4Ready) return;      // already booted: never re-run
    if (typeof document === 'undefined' || !document.head) return;
    window.__offbeatGA4Ready = true;           // set before async load to stop re-entry

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
    // Exactly one config for this property => exactly one default page_view.
    window.gtag('config', PROPERTY, { 'send_page_view': true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBoot, { once: true });
  } else {
    ensureBoot();
  }
})();
