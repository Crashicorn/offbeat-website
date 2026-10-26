/* Unit test for the page's user-entered turntable system subtotal. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function field(value = "") {
  const events = {};
  return { value, dataset: {}, addEventListener(name, fn) { events[name] = fn; }, events };
}
const total = { textContent: "", dataset: {} };
const count = { textContent: "" };
const unit = field("");
const quantity = field("2");
const prices = Array.from({ length: 6 }, () => field(""));
const formEvents = {};
const form = {
  querySelector(selector) {
    return ({ "[data-tt-total]": total, "[data-tt-count]": count,
      "[data-tt-unit]": unit, "[data-tt-quantity]": quantity })[selector] || null;
  },
  querySelectorAll() { return prices; },
  addEventListener(name, fn) { formEvents[name] = fn; }
};
const context = { document: { querySelectorAll() { return [form]; } }, Intl, Number, Array };
vm.runInNewContext(fs.readFileSync("assets/turntable-budget.js", "utf8"), context);
assert.equal(total.textContent, "$0");
assert.equal(count.textContent, "0 of 7 cost lines entered");
unit.value = "300";
prices[0].value = "250";
formEvents.input();
assert.equal(total.textContent, "$850", "two decks at $300 each plus a $250 mixer");
assert.equal(count.textContent, "2 of 7 cost lines entered");
assert.equal(total.dataset.partial, "true");
quantity.value = "1";
formEvents.change();
assert.equal(total.textContent, "$550", "changing to one deck must recalculate the entered subtotal");
prices[1].value = "invalid";
formEvents.input();
assert.equal(total.textContent, "$550", "invalid entries must not poison the subtotal");
console.log("Turntable system cost calculator: pair/one-deck subtotal, partial count, invalid-input handling");
