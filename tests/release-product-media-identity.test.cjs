"use strict";

// Release-quality guard: a named physical product must not depict a different
// product merely because its own image is missing. This test intentionally
// fails on the known catalog aliases at the 2026-10-30 review baseline.
// Scope: independent review branch; no production or agent-owned files changed.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const catalog = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "assets/dj-gear-catalog.json"), "utf8")
);
const physicalCategories = new Set([
  "controllers", "speakers", "headphones", "microphones", "stands"
]);

test("all catalog image references resolve to repository-owned product assets", () => {
  const bad = catalog.items.flatMap((item) => {
    if (!item.image || !/^assets\/img\/products\/[\w./-]+\.(svg|png|jpe?g|webp)$/i.test(item.image)) {
      return [item.id + ": missing or nonlocal product image path"];
    }
    const resolved = path.resolve(repoRoot, item.image);
    if (!resolved.startsWith(path.join(repoRoot, "assets", "img", "products") + path.sep)) {
      return [item.id + ": image points outside products directory"];
    }
    if (!fs.existsSync(resolved)) return [item.id + ": asset not found: " + item.image];
    return [];
  });
  assert.deepEqual(bad, [], "Broken product media paths must be repaired");
});

test("distinct physical equipment entries never reuse another item's depiction", () => {
  const byImage = new Map();
  for (const item of catalog.items) {
    if (!physicalCategories.has(item.category) || !item.image) continue;
    const grouped = byImage.get(item.image) || [];
    grouped.push(item.id);
    byImage.set(item.image, grouped);
  }

  const collisions = [...byImage.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([asset, ids]) => asset + " -> " + ids.join(", "))
    .sort();

  assert.deepEqual(
    collisions,
    [],
    "Use an exact-model illustration/photo or an honestly generic category icon; " +
      "do not reuse a branded JBL, Pyle or Shure product rendering as different gear"
  );
});
