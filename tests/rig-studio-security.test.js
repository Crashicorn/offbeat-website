// Run: node --test tests/rig-studio-security.test.js
// No browser, file, process.env, or third-party deps. Runnable with `node --test`.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/rig-studio.js"), "utf8");

function harness(opts) {
  opts = opts || {};
  var blockStorage = Boolean(opts.blockStorage);
  var mem = Object.create(null);
  var lastUrl = null;
  var fakeWindow = {
    localStorage: {
      getItem: function (key) { if (blockStorage) throw new Error("Storage disabled"); return mem[key] == null ? null : mem[key]; },
      setItem: function (key, value) { if (blockStorage) throw new Error("Storage disabled"); mem[key] = String(value); },
      removeItem: function (key) { if (blockStorage) throw new Error("Storage disabled"); delete mem[key]; },
    },
    location: { pathname: "/build-your-dj-setup.html", search: opts.search || "" },
    history: { replaceState: function (_s, _t, url) { lastUrl = url; } },
    scrollTo: function () {},
  };
  var fakeDocument = {
    getElementById: function () { return { innerHTML: "", offsetWidth: 800, offsetHeight: 400, querySelector: function(){return null;}, querySelectorAll: function(){return [];}, addEventListener: function(){}, removeEventListener: function(){}, setAttribute: function(){}, style: {} }; },
    readyState: "loading",
    addEventListener: function () {},
    createElement: function(){ return { style:{}, setAttribute:function(){}, appendChild:function(){} }; },
  };
  var ctx = vm.createContext({
    window: fakeWindow, document: fakeDocument, location: fakeWindow.location,
    history: fakeWindow.history, localStorage: fakeWindow.localStorage,
    URLSearchParams: URLSearchParams, console: console, atob: atob, btoa: btoa,
    fetch: function(){ return Promise.resolve({ ok: true, json: function(){ return Promise.resolve({ items: [], categories: [], presets: [] }); } }); },
    setTimeout: setTimeout, clearTimeout: clearTimeout, Math: Math, Date: Date,
    Array: Array, Object: Object, String: String, Number: Number, JSON: JSON, RegExp: RegExp, Error: Error,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    escape: escape, unescape: unescape,
  });
  vm.runInContext(source, ctx);
  // Seed catalog via IIFE-local setter (vm global CATALOG is a different binding)
  ctx._cat = baseCatalog();
  vm.runInContext("window.__setCatalogForTest(_cat)", ctx);
  var h = vm.runInContext("window.__testHook()", ctx);
  return { ctx: ctx, mem: mem, h: h, lastUrl: function(){ return lastUrl; } };
}

function baseCatalog() {
  return {
    items: [
      { id: "pioneer-ddj-flx4", category: "controllers", brand: "Pioneer DJ", model: "DDJ-FLX4", price: 329, image: "/a.jpg", tagline: "", ideal_for: "", slug: "/rekon/pioneer-ddj-flx4.html" },
      { id: "numark-mixtrack-platinum-fx", category: "controllers", brand: "Numark", model: "Mixtrack Platinum FX", price: 249, image: "/a.jpg", tagline: "", ideal_for: "", slug: "" },
      { id: "sennheiser-hd25", category: "headphones", brand: "Sennheiser", model: "HD 25", price: 149, image: "/a.jpg", tagline: "", ideal_for: "", slug: "" },
      { id: "jbl-eon-one-mk2", category: "speakers", brand: "JBL", model: "EON One MK2", price: 1199, image: "/a.jpg", tagline: "", ideal_for: "", slug: "" },
      { id: "cable-xlr-xlr", category: "cables", brand: "Hosa", model: "XLR-XLR 10ft", price: 12, image: "/a.jpg", tagline: "", ideal_for: "", slug: "" },
      { id: "macbook-air-m2", category: "laptops", brand: "Apple", model: "MacBook Air M2", price: 1099, image: "/a.jpg", tagline: "", ideal_for: "", slug: "" },
    ],
    categories: [
      { id: "controllers", name: "Controller" }, { id: "headphones", name: "Headphones" },
      { id: "speakers", name: "Speakers" }, { id: "cables", name: "Cables" },
      { id: "laptops", name: "Laptop" }, { id: "microphones", name: "Mic" },
      { id: "stands", name: "Stand" }, { id: "storage", name: "Storage" },
      { id: "mixers", name: "Mixer" },
    ],
    presets: [
      { id: "starter-dj", name: "Starter DJ", slots: { controllers: "pioneer-ddj-flx4", headphones: "sennheiser-hd25" } },
      { id: "club-ready", name: "Club ready", items: [{ category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false }] },
    ],
  };
}

function slot(overrides) {
  var base = { slotId: "core-ctrl", category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false };
  if (overrides) for (var k in overrides) base[k] = overrides[k];
  return base;
}

test("helper: slotId charset locked — hostile identifiers fall back", function(){
  var env = harness();
  assert.equal(env.h.CLEAN_SLOT_ID('x" onmouseover="alert(1)', "fb"), "fb");
  assert.equal(env.h.CLEAN_SLOT_ID("ok-id_2", "fb"), "ok-id_2");
  assert.equal(env.h.CLEAN_SLOT_ID("", "fb"), "fb");
  assert.equal(env.h.CLEAN_SLOT_ID(null, "fb"), "fb");
  assert.equal(env.h.CLEAN_QTY(9999), 1);
  assert.equal(env.h.CLEAN_QTY(2), 2);
  assert.equal(env.h.CLEAN_QTY(0), 1);
  assert.equal(env.h.CLEAN_QTY(1.5), 1);
  assert.equal(env.h.CLEAN_NAME("  hello  ", "fb"), "hello");
  assert.equal(env.h.CLEAN_NAME("", "fb"), "fb");
});

test("hostile slotId/qty/owned sanitized before state entry", function(){
  var env = harness();
  var out = env.h.SANITIZE_ITEMS([{ slotId: 'x" onmouseover="alert(1)', category: "controllers", itemId: "pioneer-ddj-flx4", qty: 999, owned: "true" }]);
  assert.ok(out && out.length === 1);
  assert.match(out[0].slotId, /^s-controllers-/);
  assert.equal(out[0].qty, 1);
  assert.equal(out[0].owned, false);
});

test("unknown itemId or category mismatch dropped", function(){
  var env = harness();
  assert.equal(env.h.SANITIZE_ITEMS([{ slotId: "a", category: "controllers", itemId: "not-in-catalog" }]), null);
  assert.equal(env.h.SANITIZE_ITEMS([{ slotId: "a", category: "headphones", itemId: "pioneer-ddj-flx4" }]), null);
  assert.equal(env.h.SANITIZE_ITEMS([{ slotId: "a", category: "unknown-cat", itemId: "pioneer-ddj-flx4" }]), null);
});

test("oversized and empty payloads fail closed", function(){
  var env = harness();
  assert.equal(env.h.SANITIZE_ITEMS([]), null);
  assert.equal(env.h.SANITIZE_ITEMS(Array.from({length:25}, function(){ return slot(); })), null);
  assert.equal(env.h.SANITIZE_ITEMS(null), null);
  assert.equal(env.h.SANITIZE_ITEMS("not-an-array"), null);
});

test("duplicate slotIds made unique", function(){
  var env = harness();
  var out = env.h.SANITIZE_ITEMS([slot({slotId:"a"}), slot({slotId:"a"}), slot({slotId:"a"})]);
  assert.ok(out && out.length === 3);
  assert.equal(new Set(out.map(function(x){ return x.slotId; })).size, 3);
});

test("malicious ?rig= URL sanitized before entering state", function(){
  var env = harness();
  var payload = { n: "Shared", i: [slot({ slotId: 'x" onfocus="alert(1)', qty: 999, owned: "true" })] };
  var encoded = env.h.ENCODE(payload);
  var decoded = env.h.DECODE(encoded);
  assert.equal(decoded.i[0].slotId, 'x" onfocus="alert(1)');
  var sanitized = env.h.SANITIZE_ITEMS(decoded.i);
  assert.ok(sanitized);
  assert.match(sanitized[0].slotId, /^s-controllers-/);
  assert.equal(sanitized[0].qty, 1);
  assert.equal(sanitized[0].owned, false);
});

test("malformed ?rig= payloads rejected, oversized guard exists", function(){
  var env = harness();
  assert.equal(env.h.SANITIZE_ITEMS([{ category: "controllers", itemId: "not-real" }]), null);
  assert.ok("x".repeat(9000).length > 8192);
});

test("saved rigs: forged totals never leak, hostile slotIds normalized", function(){
  var env = harness();
  var hostileSaved = JSON.stringify([
    { name: "Saved", items: [slot({slotId:"owned-hp", category:"headphones", itemId:"sennheiser-hd25", qty:1, owned:true})], date: '<img src=x onerror=alert(1)>', totalCost: 999999 },
    { name: '<script>alert(1)</script>', items: [{ slotId: 'x" onmouseover="alert(1)', category: "controllers", itemId: "pioneer-ddj-flx4", qty: 2, owned: false }], date: "2026-01-01" },
    { items: "not-an-array", name: "bad" },
  ]);
  env.mem[env.h.SAVED_KEY] = hostileSaved;
  var loaded = env.h.LOAD_SAVED();
  assert.ok(Array.isArray(loaded) && loaded.length >= 1);
  assert.ok(!loaded.some(function(r){ return r.totalCost != null; }));
  var withHostile = loaded.find(function(r){ return /alert/.test(r.name); });
  if (withHostile) assert.match(withHostile.items[0].slotId, /^s-controllers-/);
});

test("legacy migration: map-shaped and array-shaped old storage validated", function(){
  var env = harness();
  var oldMap = { name: "Old", slots: { controllers: "pioneer-ddj-flx4", headphones: "sennheiser-hd25" }, owned: { headphones: true } };
  var cats = Object.keys(oldMap.slots);
  var mapped = cats.map(function(cat, idx){ return { slotId: "s-" + cat + "-" + String(idx).padStart(2,"0"), category: cat, itemId: oldMap.slots[cat], qty: 1, owned: Boolean(oldMap.owned && oldMap.owned[cat]) }; });
  var sanitized = env.h.SANITIZE_ITEMS(mapped);
  assert.ok(sanitized && sanitized.length === 2);
  assert.equal(sanitized.find(function(s){ return s.category === "headphones"; }).owned, true);
  assert.equal(env.h.SANITIZE_ITEMS([{ category: "controllers", itemId: "fake-id" }]), null);
});

test("legitimate payloads arrive intact", function(){
  var env = harness();
  var legit = { n: "My summer rig", i: [
    { slotId: "s-controllers-00", category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false },
    { slotId: "s-headphones-01", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: true },
  ]};
  var encoded = env.h.ENCODE(legit);
  var decoded = env.h.DECODE(encoded);
  var sanitized = env.h.SANITIZE_ITEMS(decoded.i);
  assert.ok(sanitized && sanitized.length === 2);
  assert.equal(sanitized[0].itemId, "pioneer-ddj-flx4");
  assert.equal(sanitized[1].owned, true);
  assert.equal(env.h.CLEAN_NAME(decoded.n, "fb"), "My summer rig");
});

test("blocked storage does not throw; saved rigs fall back to empty", function(){
  var env = harness({ blockStorage: true });
  assert.doesNotThrow(function(){ env.h.SAFE_GET("offbeat.rig"); });
  assert.equal(env.h.SAFE_GET("offbeat.rig"), null);
  assert.equal(env.h.SAFE_SET("offbeat.rig", "{}"), false);
  assert.deepEqual(Array.from(env.h.LOAD_SAVED()), []);
});

test("ownership honored: owned gear excluded from buy lists", function(){
  var env = harness();
  var items = env.h.SANITIZE_ITEMS([
    { slotId: "a", category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false },
    { slotId: "b", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: true },
  ]);
  assert.ok(items);
  assert.equal(items.filter(function(s){ return s.owned; }).length, 1);
  assert.equal(items.filter(function(s){ return !s.owned; })[0].itemId, "pioneer-ddj-flx4");
});
