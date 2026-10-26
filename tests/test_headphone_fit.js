/* Lightweight DOM-level interaction test for the fit-first headphone selector. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const labels = ["club", "home", "premium"].map(() => ({ classList: { selected: false, toggle(_name, on) { this.selected = on; } } }));
const choices = ["club", "home", "premium"].map((value, index) => ({
  value, checked: index === 0,
  closest() { return labels[index]; },
  matches(selector) { return selector === 'input[name="headphone-use"]'; }
}));
const results = ["club", "home", "premium"].map((value, index) => ({ dataset: { headphoneFitResult: value }, hidden: index !== 0 }));
let onChange;
const panel = {
  querySelectorAll(selector) {
    if (selector === 'input[name="headphone-use"]') return choices;
    if (selector === "[data-headphone-fit-result]") return results;
    return [];
  },
  addEventListener(name, fn) { if (name === "change") onChange = fn; }
};
vm.runInNewContext(fs.readFileSync("assets/headphone-fit.js", "utf8"), {
  document: { querySelectorAll(selector) { return selector === ".headphone-fit-panel" ? [panel] : []; } },
  Array
});
assert.deepEqual(results.map((result) => result.hidden), [false, true, true]);
choices.forEach((choice) => { choice.checked = choice.value === "home"; });
onChange({ target: choices[1] });
assert.deepEqual(results.map((result) => result.hidden), [true, false, true]);
assert.deepEqual(labels.map((label) => label.classList.selected), [false, true, false]);
choices.forEach((choice) => { choice.checked = choice.value === "premium"; });
onChange({ target: choices[2] });
assert.deepEqual(results.map((result) => result.hidden), [true, true, false]);
console.log("Headphone selector: booth, home/studio and premium results switch with matching selected state");
