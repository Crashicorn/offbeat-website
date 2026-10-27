// Focused acceptance test for the interactive beginner-controller buying journey.
// Run with: node --test tests/beginner-controller-guide.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../assets/beginner-controller-guide.js"), "utf8");
/* The guide no longer hard-codes its cable rule: it asks the shared model in
   assets/gear-connections.js, exactly like the published page does. The vm
   harness has to load that file first, or it is testing a page with a missing
   dependency and every assertion below fails as "catalog could not load". */
const engineSource = fs.readFileSync(path.join(__dirname, "../assets/gear-connections.js"), "utf8");
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
  vm.runInContext("var window = this;", context);
  vm.runInContext(engineSource, context);
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
  /* $329 deck + $49 cans + $149 monitor pair, and no cable: the DM-40D box lead
     is a passive converter that feeds the FLX4's RCA master in reverse. */
  assert.match(mount.innerHTML, /\$527/);
  assert.match(mount.innerHTML, /in the box · used the other way round/);
  assert.match(mount.innerHTML, /the lead is passive, so it works either way round/);
  let payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "controllers"; }).itemId, "pioneer-ddj-flx4");
  assert.match(payload.n, /DDJ-FLX4/);
  assert.equal(slotOf(payload, "cables"), undefined,
    "the hand-off carries no cable purchase the box already satisfies");

  fireById(mount, "[data-bl-profile]", "budget");
  assert.match(mount.innerHTML, /<h3>AlphaTheta \/ Pioneer DJ DDJ-FLX2<\/h3>/);
  assert.match(mount.innerHTML, /data-bl-profile="budget" aria-pressed="true"/);
  /* N2/N3: the FLX2 has a 3.5 mm master and the DM-40D pair ships with a
     3.5 mm to dual RCA lead, so this route buys no cable at all:
     $199 + $49 + $149 = $397. There is no $15 allowance to keep and no
     simultaneous "missing cable" claim. */
  assert.match(mount.innerHTML, /\$397/);
  assert.match(mount.innerHTML, /included with the pair/);
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(slotOf(payload, "cables"), undefined,
    "an in-box lead must not travel as a cable purchase the buyer does not need");
  const pricedAllowances = catalog.items.filter(function (item) { return item.estimate_only; });
  assert.ok(pricedAllowances.length, "the catalog still carries priced allowances for socket pairs with no verified lead");
  pricedAllowances.forEach(function (item) {
    assert.equal(item.category, "cables");
    assert.equal(item.no_retailer_link, true, "an allowance must never be routed to a retailer or affiliate link");
  });

  const hp = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === "headphones"; });
  hp.checked = true;
  hp.fire("change");
  assert.match(mount.innerHTML, /\$348/);
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "headphones"; }).owned, true);

  /* With the lead in the box there is no cable to own, so the page must not
     invent a checkbox for one. */
  assert.equal(mount.lastControls["[data-bl-owned]"].some(function (node) {
    return node.getAttribute("data-bl-owned") === "cable";
  }), false, "no cable ownership control is offered when no cable is bought");

  const speakersControl = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === "speakers"; });
  speakersControl.checked = true;
  speakersControl.fire("change");
  assert.match(mount.innerHTML, /\$199/);
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "speakers"; }).owned, true);
  assert.equal(slotOf(payload, "cables"), undefined);

  /* The Inpulse 500 also has RCA master outputs, and the DM-40D box lead
     reaches its RCA sockets too, so a deck swap still buys no cable here:
     $299 with headphones and monitors owned. What must change is the deck
     itself - and every other line is re-checked rather than inherited. */
  fireById(mount, "[data-bl-choose]", "hercules-inpulse-500");
  assert.match(mount.innerHTML, /<h3>Hercules DJControl Inpulse 500<\/h3>/);
  assert.match(mount.innerHTML, /\$299/);
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(slotOf(payload, "cables"), undefined,
    "the box lead still covers an RCA-output deck, so no cable is charged");
  assert.ok(mount.innerHTML.includes("dual 1/4-inch outputs"));
  let controller = mount.lastControls["[data-bl-owned]"].find(function (node) { return node.getAttribute("data-bl-owned") === "controller"; });
  controller.checked = true;
  controller.fire("change");
  payload = rigFrom(mount.innerHTML);
  assertCatalogValid(payload);
  assert.equal(payload.i.find(function (item) { return item.category === "controllers"; }).owned, true);
  assert.equal(allowanceTotal(mount.innerHTML), 0,
    "with the deck, headphones and monitors owned there is nothing left to buy");

  fireById(mount, "[data-bl-profile]", "budget");
  assert.match(mount.innerHTML, /<h3>AlphaTheta \/ Pioneer DJ DDJ-FLX2<\/h3>/);
  assert.match(mount.innerHTML, /\$199/);
  payload = rigFrom(mount.innerHTML);
  assert.equal(payload.i.find(function (item) { return item.category === "controllers"; }).owned, false,
    "controller ownership resets when switching to another model");
  assert.equal(slotOf(payload, "cables"), undefined,
    "the RCA lead bought for the previous deck does not follow the FLX2 home");
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

  /* FLX4 default: 329 + 49 + 149 = 527 and no cable. The DM-40D box contains a
     passive 3.5 mm-to-dual-RCA converter, and the FLX4's RCA master can use it
     the other way round, so charging $12 here was a double-charge. */
  assert.equal(allowanceTotal(mount.innerHTML), 527);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 527);
  assert.equal(slotOf(rigFrom(mount.innerHTML), "cables"), undefined,
    "the FLX4 route needs no cable purchase either: the box lead is reversible");

  /* FLX2: 199 + 49 + 149 = 397 with no cable line at all — the DM-40D box
     lead covers this output. The old $412 charged a $15 allowance the
     corrected configuration cannot use (N3). */
  fireById(mount, "[data-bl-profile]", "budget");
  assert.equal(allowanceTotal(mount.innerHTML), 397);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 397, "Rig Studio would charge the same $397");
  assert.equal(slotOf(rigFrom(mount.innerHTML), "cables"), undefined,
    "nothing is charged for a lead that ships in the monitor box");

  /* Own the controller: 49 + 149 = 198 in both places. */
  toggle(mount, "controller");
  assert.equal(allowanceTotal(mount.innerHTML), 198);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 198);
  assert.equal(slotOf(rigFrom(mount.innerHTML), "controllers").owned, true);

  /* No cable to own: the guide offers no cable checkbox, so there is no
     allowance line to mark as owned either. */
  assert.equal(mount.lastControls["[data-bl-owned]"].some(function (node) {
    return node.getAttribute("data-bl-owned") === "cable";
  }), false, "no cable ownership control exists while the lead ships in the box");

  /* Owning monitors as well: only headphones remain. */
  toggle(mount, "speakers");
  assert.equal(allowanceTotal(mount.innerHTML), 49);
  assert.equal(rigCharge(rigFrom(mount.innerHTML)), 49);

  /* Back to the FLX4 with monitors owned: only the controller and headphones
     are bought, 329 + 49 = 378, and still no cable - the box lead covers the
     RCA master as well as the 3.5 mm one. */
  fireById(mount, "[data-bl-choose]", "pioneer-ddj-flx4");
  assert.equal(allowanceTotal(mount.innerHTML), 378);
  const flx4Payload = rigFrom(mount.innerHTML);
  assert.equal(rigCharge(flx4Payload), 378);
  assert.equal(slotOf(flx4Payload, "speakers").owned, true, "unrelated ownership survives a controller change");
  assert.equal(slotOf(flx4Payload, "cables"), undefined,
    "no cable line appears for a dealer that ships inside the monitor box");
  assert.equal(slotOf(flx4Payload, "controllers").owned, false, "controller ownership resets with the model");

  /* The hand-off is labelled as a guide import, so Rig Studio can greet it correctly. */
  assert.equal(flx4Payload.g, "guide");
});
