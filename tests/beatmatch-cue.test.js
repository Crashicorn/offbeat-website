"use strict";

// Deterministic source-level acceptance of the trainer's CUE timing.
// No production test hooks, audio devices, browser storage or network needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function makeTrainer() {
  const source = fs.readFileSync(path.join(__dirname, "../assets/beatmatch-trainer.js"), "utf8");
  assert.match(source, /\}\)\(\);\s*$/, "Expected trainer IIFE");
  const instrumented = source.replace(/\}\)\(\);\s*$/, 
    "globalThis.__trainerProbe = { state: state, phaseMs: phaseMs };})();");
  const cueListeners = {};
  const documentListeners = {};
  const cue = {
    addEventListener(type, handler) { cueListeners[type] = handler; },
    click() { cueListeners.click(); }
  };
  const root = {
    querySelector(selector) { return selector === "[data-cue]" ? cue : null; },
    querySelectorAll() { return []; }
  };
  const document = {
    getElementById(id) { return id === "trainer" ? root : null; },
    querySelector() { return null; },
    addEventListener(type, handler) { documentListeners[type] = handler; }
  };
  const context = { document, window: {}, console, Math };
  vm.runInNewContext(instrumented, context, { filename: "beatmatch-trainer.js" });
  assert.equal(typeof cueListeners.click, "function", "CUE handler registered");
  return { ...context.__trainerProbe, cue, documentListeners };
}

function setRunningState(probe, elapsed) {
  Object.assign(probe.state, {
    running: true,
    ctx: { currentTime: elapsed },
    lastAudio: 0,
    bpmA: 120,
    bpmB: 120,
    posA: 8,
    posB: 7.2,
    beatB: 7,
    scheduledA: 8,
    scheduledB: 10
  });
}

test("mistimed CUE starts B from beat 1 without snapping to A", () => {
  const probe = makeTrainer();
  setRunningState(probe, 0.25); // Half a beat after A's downbeat at 120 BPM.
  probe.cue.click();
  assert.equal(probe.state.posA, 8.5, "A advances to the actual press time");
  assert.equal(probe.state.posB, 0, "B starts from its own beat 1");
  assert.equal(probe.state.beatB, 0);
  assert.equal(probe.state.scheduledB, -1, "stale B scheduler position invalidated");
  assert.ok(Math.abs(probe.phaseMs()) >= 240,
    "a half-beat-late press must remain visibly out of phase");
});

test("well-timed CUE can align the beats without changing either tempo", () => {
  const probe = makeTrainer();
  setRunningState(probe, 0.003);
  probe.cue.click();
  assert.ok(Math.abs(probe.phaseMs()) < 18, "near-downbeat press is aligned");
  assert.equal(probe.state.bpmA, 120);
  assert.equal(probe.state.bpmB, 120);
  assert.equal(probe.state.posB, 0);
});

test("keyboard C uses the same timed CUE behavior", () => {
  const probe = makeTrainer();
  setRunningState(probe, 0.25);
  let prevented = false;
  probe.documentListeners.keydown({
    code: "KeyC",
    target: { matches() { return false; } },
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(probe.state.posB, 0);
  assert.equal(probe.state.scheduledB, -1);
  assert.ok(Math.abs(probe.phaseMs()) >= 240);
});
