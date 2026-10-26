// Focused acceptance test for the interactive beginner-controller buying journey.
// Run with: node --test tests/beginner-controller-guide.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../assets/beginner-controller-guide.js"), "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/dj-gear-catalog.json"), "utf8"));

function attr(tag, name) {
  const match = tag.match(new RegExp(name + '="([^"]*)"'));
  return match ? match[1] : null;
}
function rigFrom(html) {
  const href = attr(html.match(/<a[^>]*data-bl-build[^>]*>/)[0], "href");
  const token = new URL("https://example.test/" + href).searchParams.get("rig");
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}
function assertCatalogValid(payload) {
  assert.ok(payload.i.length <= 24);
  payload.i.forEach(function (slot) {
    assert.match(slot.slotId, /^[A-Za-z0-9_-]{1,64}$/);
    if (slot.itemId) {
      const item = catalog.items.find(function (entry) { return entry.id === slot.itemId; });
      assert.ok(item, "shared configuration item exists in Rig Studio catalog: " + slot.itemId);
      assert.equal(item.category, slot.category);
    }
  });
}
function makeElement(tag) {
  const events = Object.create(null);
  return {
    tag: tag,
    checked: /\schecked(?:\s|>)/.test(tag),
    getAttribute: function (name) { return attr(tag, name); },
    addEventListener: function (name, fn) { events[name] = fn; },
    focus: function () {},
    fire: function (name) { if (events[name]) events[name]({ target: this }); },
  };
}
function harness() {
  const mount = {
    html: "",
    lastControls: Object.create(null),
    set innerHTML(value) { this.html = value; this.lastControls = Object.create(null); },
    get innerHTML() { return this.html; },
    querySelectorAll: function (selector) {
      const attribute = selector.match(/\[([^=\]]+)/)[1];
      const re = new RegExp("<(button|input)\\b[^>]*" + attribute + '="[^"]*"[^>]*>', "g");
      const controls = Array.from(this.html.matchAll(re), function (match) { return makeElement(match[0]); });
      this.lastControls[selector] = controls;
      return controls;
    },
    querySelector: function (selector) {
      const attribute = selector.match(/\[([^=\]]+)/)[1];
      const re = new RegExp("<(button|input)\\b[^>]*" + attribute + '="[^"]*"[^>]*>');
      const match = this.html.match(re);
      return match ? makeElement(match[0]) : null;
    },
  };
  const context = vm.createContext({
    document: { getElementById: function (id) { return id === "beginner-controller-decision" ? mount : null; } },
    fetch: function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve(catalog); } }); },
    btoa: function (value) { return Buffer.from(value, "binary").toString("base64"); },
    unescape: unescape, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    String: String, Number: Number, JSON: JSON, Array: Array, Math: Math,
  });
  vm.runInContext(source, context);
  return new Promise(function (resolve) { setImmediate(function () { resolve(mount); }); });
}
function fireById(mount, selector, id, event) {
  const el = (mount.lastControls[selector] || []).find(function (node) { return node.getAttribute(selector.match(/\[([^=\]]+)/)[1]) === id; });
  assert.ok(el, "expected a rendered control for " + id);
  el.fire(event || "click");
}

test("first-controller chooser computes complete desk cost and hands owned gear into Rig Studio", async function () {
  const mount = await harness();
  assert.match(mount.innerHTML, /Pioneer DJ DDJ-FLX4/);
  assert.match(mount.innerHTML, /\$539/); // $329 deck + $49 cans + $149 monitor pair + $12 RCA cable
  let payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "controllers"; }).itemId, "pioneer-ddj-flx4");
  assert.match(payload.n, /DDJ-FLX4/);
  assert.equal(payload.i.find(function (item) { return item.category === "cables"; }).itemId, "cable-rca-rca");

  fireById(mount, "[data-bl-profile]", "budget");
  assert.match(mount.innerHTML, /<h3>AlphaTheta \/ Pioneer DJ DDJ-FLX2<\/h3>/);
  assert.match(mount.innerHTML, /data-bl-profile="budget" aria-pressed="true"/);
  assert.match(mount.innerHTML, /\$412/); // $199 + $49 + $149 + $15 compatible-cable allowance
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  const flx2Cable = payload.i.find(function (item) { return item.category === "cables"; });
  assert.equal(flx2Cable.itemId, null, "do not invent a specific catalog cable for the FLX2 3.5 mm output");

  const hp = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === "headphones"; });
  hp.checked = true;
  hp.fire("change");
  assert.match(mount.innerHTML, /\$363/);
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "headphones"; }).owned, true);

  ["speakers", "cable"].forEach(function (category) {
    const control = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === category; });
    control.checked = true;
    control.fire("change");
  });
  assert.match(mount.innerHTML, /\$199/);
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "speakers"; }).owned, true);
  assert.equal(payload.i.find(function (item) { return item.category === "cables"; }).owned, true);

  fireById(mount, "[data-bl-choose]", "hercules-inpulse-500");
  assert.match(mount.innerHTML, /<h3>Hercules DJControl Inpulse 500<\/h3>/);
  assert.match(mount.innerHTML, /\$299/); // controller only: the other three parts are marked owned
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "cables"; }).itemId, "cable-rca-rca");
  assert.ok(mount.innerHTML.includes("dual 1/4-inch outputs"));
  const controller = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === "controller"; });
  controller.checked = true;
  controller.fire("change");
  assert.match(mount.innerHTML, /\$0/);
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "controllers"; }).owned, true);
});
