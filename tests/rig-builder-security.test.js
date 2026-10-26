// Run: node --test tests/rig-builder-security.test.js
// No browser, network, or third-party dependencies required.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/rig-builder.js"), "utf8");
const hook = "  /* ---------------------------------------------------------------- Start */";
assert.equal(source.split(hook).length, 2, "test hook must match one startup point");

function harness(storageDisabled) {
  const memory = Object.create(null);
  const localStorage = {
    getItem(key) {
      if (storageDisabled) throw new Error("Storage disabled");
      return memory[key] ?? null;
    },
    setItem(key, value) {
      if (storageDisabled) throw new Error("Storage disabled");
      memory[key] = value;
    }
  };
  let lastUrl = null;
  const window = {
    localStorage,
    location: { pathname: "/build-your-dj-setup.html", search: "" },
    history: { replaceState(_state, _title, url) { lastUrl = url; } }
  };
  const document = {
    getElementById() { return {}; },
    readyState: "loading",
    addEventListener() {}
  };
  const injected = source.replace(hook, `  window.__testRig = {
    setCatalog: function (x) { CATALOG = x; },
    sanitizeRigState: sanitizeRigState,
    normalizeRigState: normalizeRigState,
    parseUrlOrLocalState: parseUrlOrLocalState,
    saveActiveState: saveActiveState,
    getRig: function () { return currentRig; },
    getSavedRigs: getSavedRigs,
    renderSavedRigsList: renderSavedRigsList
  };
` + hook);
  vm.runInNewContext(injected, { window, document, URLSearchParams, console, atob, btoa });
  window.__testRig.setCatalog({
    items: [
      { id: "pioneer-ddj-flx4", category: "controllers", price: 299 },
      { id: "sennheiser-hd25", category: "headphones", price: 149 }
    ],
    categories: [],
    presets: []
  });
  return { api: window.__testRig, memory, window, lastUrl: () => lastUrl };
}

function slot(id = "core-ctrl") {
  return { slotId: id, category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false };
}

test("hostile shared identifiers cannot become HTML attributes", () => {
  const { api } = harness(false);
  const rig = api.sanitizeRigState({
    name: "<img src=x onerror=alert(1)>",
    items: [{ ...slot('x" onmouseover="alert(1)'), qty: 999999, owned: "true" }]
  });
  assert.equal(rig.items[0].slotId, "imported-0");
  assert.equal(rig.items[0].qty, 1);
  assert.equal(rig.items[0].owned, false);
  assert.equal(rig.name, "<img src=x onerror=alert(1)>");
});

test("unknown catalog items, category mismatches and oversized payloads fail closed", () => {
  const { api } = harness(false);
  assert.equal(api.sanitizeRigState({ items: [{ ...slot(), itemId: "not-in-catalog" }] }), null);
  assert.equal(api.sanitizeRigState({ items: [{ ...slot(), category: "headphones" }] }), null);
  assert.equal(api.sanitizeRigState({ items: Array.from({ length: 25 }, () => slot()) }), null);
  assert.equal(api.sanitizeRigState({ items: [] }), null);
});

test("duplicate IDs are unique and legacy preset links still work", () => {
  const { api } = harness(false);
  const rig = api.sanitizeRigState({ items: [
    slot("a"), slot("a"), slot("imported-2-1"), slot("imported-2-1")
  ] });
  assert.equal(new Set(rig.items.map(x => x.slotId)).size, 4);
  const legacy = api.sanitizeRigState({ slots: { controllers: "pioneer-ddj-flx4" } });
  assert.equal(legacy.items[0].itemId, "pioneer-ddj-flx4");
});

test("malicious URL is sanitized before entering the active rig", () => {
  const { api, window } = harness(false);
  const payload = { name: "Shared", items: [slot('x" onfocus="alert(1)')] };
  window.location.search = "?rig=" + encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(payload))));
  api.parseUrlOrLocalState();
  assert.equal(api.getRig().items[0].slotId, "imported-0");
});

test("saved rigs ignore forged totals, exclude owned gear and escape hostile dates", () => {
  const { api, memory } = harness(false);
  memory["offbeat.rigs.saved"] = JSON.stringify([{
    name: "Saved", items: [{ ...slot(), qty: 2 }, { slotId: "owned-hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: true }],
    totalCost: '<img src=x onerror=alert(1)>',
    date: '<img src=x onerror=alert(1)>'
  }]);
  assert.equal(api.getSavedRigs()[0].totalCost, 598);
  const markup = api.renderSavedRigsList();
  assert.match(markup, /&lt;img/);
  assert.match(markup, /\$598/);
  assert.doesNotMatch(markup, /\(<img/);
});

test("blocked browser storage does not prevent in-memory editing or share URL", () => {
  const { api, lastUrl } = harness(true);
  assert.doesNotThrow(() => api.saveActiveState());
  assert.match(lastUrl(), /\?rig=/);
  assert.deepEqual(Array.from(api.getSavedRigs()), []);
});

test("share links encode base64 plus and restore correctly without local storage", () => {
  const { api, memory, window, lastUrl } = harness(false);
  const name = "m~?wKQPW[GTy"; // Produces a '+' in base64(JSON-as-URI-component).
  assert.equal(api.normalizeRigState({ name, items: [slot()] }), true);
  api.saveActiveState();
  const url = lastUrl();
  assert.match(url, /%2B/, "literal plus must be percent-encoded in query strings");
  memory["offbeat.rig.active"] = ""; // Prove the shared URL works on a new device.
  window.location.search = new URL(url, "https://offbeatinc.com").search;
  assert.equal(api.normalizeRigState({ name: "Other", items: [slot()] }), true);
  api.parseUrlOrLocalState();
  assert.equal(api.getRig().name, name);
});
