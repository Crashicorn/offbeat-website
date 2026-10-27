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
function slotOf(payload, category) {
  return payload.i.find(function (item) { return item.category === category; });
}
const ALLOWANCE = catalog.items.find(function (item) { return item.id === "cable-aux-rca-allowance"; });
function allowanceTotal(html) {
  const match = html.match(/data-bl-total[^>]*>\$([\d,]+)</);
  return Number(match[1].replace(/,/g, ""));
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
  const flx2Cable = slotOf(payload, "cables");
  assert.ok(ALLOWANCE, "the catalog carries an explicit 3.5 mm cable allowance");
  assert.equal(ALLOWANCE.estimate_only, true, "the allowance is planning data, not a verified product");
  assert.equal(ALLOWANCE.no_retailer_link, true, "the allowance must never be routed to a retailer or affiliate link");
  assert.equal(flx2Cable.itemId, "cable-aux-rca-allowance",
    "the $15 FLX2 allowance travels as a real, priced line so Rig Studio cannot lose it");
  assert.equal(flx2Cable.itemId === "cable-rca-rca", false,
    "no verified dual-RCA SKU is claimed to fit the FLX2 3.5 mm output");

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
  assert.match(mount.innerHTML, /\$311/); // controller + cable; headphone and monitors are owned
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "cables"; }).itemId, "cable-rca-rca");
  assert.equal(payload.i.find(function (item) { return item.category === "cables"; }).owned, false,
    "changing decks requires the user to re-confirm cable compatibility");
  assert.ok(mount.innerHTML.includes("dual 1/4-inch outputs"));
  let controller = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === "controller"; });
  controller.checked = true;
  controller.fire("change");
  assert.match(mount.innerHTML, /\$12/); // cable still needs buying
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "controllers"; }).owned, true);

  fireById(mount, "[data-bl-profile]", "budget");
  assert.match(mount.innerHTML, /<h3>AlphaTheta \/ Pioneer DJ DDJ-FLX2<\/h3>/);
  assert.match(mount.innerHTML, /\$214/);
  payload = rigFrom(mount.innerHTML);
  assert.equal(payload.i.find(function (item) { return item.category === "controllers"; }).owned, false,
    "controller ownership resets when switching to another model");
  assert.equal(payload.i.find(function (item) { return item.category === "cables"; }).owned, false,
    "cable ownership resets when the output connectors change");
});

/* Rig Studio charges exactly the slots it receives: owned lines cost nothing,
   everything else costs catalogue price × quantity. Comparing that against the
   guide's own total is the money contract H1 broke. */
function rigCharge(payload) {
  return payload.i.reduce(function (sum, slot) {
    if (!slot.itemId || slot.owned) return sum;
    const item = catalog.items.find(function (entry) { return entry.id === slot.itemId; });
    assert.ok(item, "payload only references catalogue items: " + slot.itemId);
    return sum + item.price * (slot.qty || 1);
  }, 0);
}
function toggle(mount, key) {
  const control = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === key; });
  assert.ok(control, "ownership control for " + key);
  control.checked = true;
  control.fire("change");
}

test("the guide total always equals what Rig Studio will charge for the handed-off rig", async function () {
  const mount = await harness();
  [["balanced", "pioneer-ddj-flx4"], ["budget", "pioneer-ddj-flx2"], ["guided", "hercules-inpulse-500"]].forEach(function () {
    /* profile switch below drives the model; keep this list declarative */
  });

  /* FLX4 default: 329 + 49 + 149 + 12 */
  assert.equal(allowanceTotal(mount.innerHTML), 539);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 539);
  assert.equal(slotOf(rigFrom(mount.innerHTML), "cables").itemId, "cable-rca-rca");

  /* FLX2: 199 + 49 + 149 + 15 allowance — the number the browser review lost. */
  fireById(mount, "[data-bl-profile]", "budget");
  assert.equal(allowanceTotal(mount.innerHTML), 412);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 412, "Rig Studio would charge the same $412");

  /* Own the controller: 49 + 149 + 15 = 213 in both places. */
  toggle(mount, "controller");
  assert.equal(allowanceTotal(mount.innerHTML), 213);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 213);
  assert.equal(slotOf(rigFrom(mount.innerHTML), "controllers").owned, true);

  /* Own the cable too: the allowance leaves the bill, not the rig. */
  toggle(mount, "cable");
  assert.equal(allowanceTotal(mount.innerHTML), 198);
  const ownedCablePayload = rigFrom(mount.innerHTML);
  assert.equal(rigCharge(ownedCablePayload), 198);
  assert.equal(slotOf(ownedCablePayload, "cables").owned, true,
    "the owned allowance stays in the payload so Rig Studio can see what was skipped");

  /* Owning monitors as well: only headphones remain. */
  toggle(mount, "speakers");
  assert.equal(allowanceTotal(mount.innerHTML), 49);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 49);

  /* Back to the FLX4: a dual-RCA cable is required again and the allowance leaves. */
  /* Monitors stay owned; the FLX4 controller and its RCA cable must be bought:
     329 + 49 + 12 = 390, with no $15 allowance left behind. */
  fireById(mount, "[data-bl-choose]", "pioneer-ddj-flx4");
  assert.equal(allowanceTotal(mount.innerHTML), 390);
  const flx4Payload = rigFrom(mount.innerHTML);
  assert.equal(rigCharge(flx4Payload), 390);
  assert.equal(slotOf(flx4Payload, "speakers").owned, true, "unrelated ownership survives a controller change");
  assert.equal(slotOf(flx4Payload, "cables").itemId, "cable-rca-rca");
  assert.equal(slotOf(flx4Payload, "cables").owned, false, "a cable that fitted the old output is not assumed to fit");
  assert.equal(slotOf(flx4Payload, "controllers").owned, false, "controller ownership resets with the model");

  /* The hand-off is labelled as a guide import, so Rig Studio can greet it correctly. */
  assert.equal(flx4Payload.g, "guide");
});
