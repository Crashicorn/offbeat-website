/* Browser test for the Offbeat Mix Lab (beatmatch-trainer.html).
 *
 * It drives the same public hooks the page exposes for testing
 * (`window.__mixlab`) so the assertions are about real audio-clock state,
 * not about text on the page being copied into the test.
 *
 * Run:  node tests/test_mixlab.js          (expects a static server on :8099)
 *       PORT=8080 node tests/test_mixlab.js
 */
const assert = require("assert");

/* The sandbox checkout keeps its browser libraries outside the repo, and the
 * path differs between environments, so resolve the first one that exists. */
function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_CORE,
    "/tmp/browser/node_modules/puppeteer-core",
    "/tmp/node_modules/puppeteer-core",
    "puppeteer-core"
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch (e) {
      /* try the next path */
    }
  }
  throw new Error("puppeteer-core not found; set PUPPETEER_CORE to its install path");
}
const puppeteer = loadPuppeteer();

const PORT = process.env.PORT || 8099;
const BASE = `http://127.0.0.1:${PORT}`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/tmp/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required"
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/beatmatch-trainer.html`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__mixlab, { timeout: 8000 });

  /* 1 — four lessons and a free-practice session are offered */
  const lessonIds = await page.$$eval("[data-ml-lesson]", (els) =>
    els.map((e) => e.getAttribute("data-ml-lesson"))
  );
  assert.deepStrictEqual(lessonIds, ["1", "2", "3", "4"], "four lessons expected");
  assert.ok(
    await page.$('select[data-ml-level] option[value="free"]'),
    "free practice should be selectable in the session menu"
  );

  /* 2 — the lab starts silent and only runs after play */
  assert.strictEqual(await page.evaluate(() => window.__mixlab.metrics().running), false);
  await page.click("[data-ml-play]");
  await new Promise((r) => setTimeout(r, 600));
  const started = await page.evaluate(() => window.__mixlab.metrics());
  assert.ok(started.running, "decks should be running after play");
  assert.ok(started.tempoDiff !== 0, "lesson 1 should start out of tempo");

  /* 3 — the pitch readout follows the fader and stays inside ±6% */
  const fader = await page.$eval("[data-ml-pitch-value]", (el) => el.textContent.trim());
  assert.ok(/^[+−]?\d\.\d{2}%$/.test(fader), `pitch readout looks wrong: ${fader}`);
  await page.evaluate(() => window.__mixlab.setPitch(40));
  assert.strictEqual(await page.evaluate(() => window.__mixlab.metrics().pitch), 6, "pitch clamps at +6%");
  await page.evaluate(() => window.__mixlab.setPitch(0));

  /* 4 — lesson 1 is solvable with the pitch fader alone */
  const solved = await page.evaluate(async () => {
    const read = () => window.__mixlab.metrics();
    for (let i = 0; i < 260; i++) {
      const m = read();
      if (m.lessonDone) return { done: true, ms: m };
      const need = -(m.tempoDiff / m.bpmA) * 100;
      window.__mixlab.setPitch(m.pitch + Math.max(-0.04, Math.min(0.04, need)));
      await new Promise((r) => setTimeout(r, 55));
    }
    return { done: false, ms: read() };
  });
  assert.ok(solved.done, "lesson 1 should complete once the tempo is matched");

  const resultVisible = await page.$eval("[data-ml-result]", (el) => !el.hidden);
  assert.ok(resultVisible, "a result card should appear when a lesson is completed");
  const nextLabel = await page.$eval("[data-ml-result-next]", (el) => el.textContent);
  assert.ok(/Next: /.test(nextLabel), `next-step button should point at lesson 2, got: ${nextLabel}`);
  await page.click("[data-ml-result-next]");
  const afterNext = await page.evaluate(() => window.__mixlab.metrics());
  assert.strictEqual(afterNext.lesson, 2, "the next button should load lesson 2");

  /* 5 — lesson 2 is a phase problem: the nudge fixes it, the pitch does not */
  await page.click("[data-ml-play]");
  await new Promise((r) => setTimeout(r, 400));
  const phaseFixed = await page.evaluate(async () => {
    const read = () => window.__mixlab.metrics();
    for (let i = 0; i < 160; i++) {
      const m = read();
      if (m.lessonDone) return { done: true, ms: m };
      window.__mixlab.nudge(m.offsetMs * 1.05);
      await new Promise((r) => setTimeout(r, 80));
    }
    return { done: false, ms: read() };
  });
  assert.ok(phaseFixed.done, "lesson 2 should complete once the kicks are aligned");

  /* 6 — the ear-check demos play and hand control back to the lesson */
  await page.click('[data-ml-demo="dragging"]');
  await new Promise((r) => setTimeout(r, 300));
  const demo = await page.evaluate(() => window.__mixlab.metrics());
  assert.strictEqual(demo.mode, "demo", "the demo should take over the decks");
  assert.ok(Math.abs(demo.offsetMs) > 40, "the dragging demo should sit audibly off the beat");
  await new Promise((r) => setTimeout(r, 4000));
  const afterDemo = await page.evaluate(() => window.__mixlab.metrics());
  assert.notStrictEqual(afterDemo.mode, "demo", "the demo should stop by itself");
  assert.strictEqual(afterDemo.running, false, "the demo should not leave a deck playing");

  /* 7 — lesson 4 is the blind hold: readouts off while you play, back after */
  await page.select("[data-ml-level]", "lesson4");
  await new Promise((r) => setTimeout(r, 250));
  const blindUi = await page.evaluate(() => ({
    blind: document.querySelector("[data-mixlab]").classList.contains("is-blind"),
    meters: getComputedStyle(document.querySelector(".ml-meters")).display,
    note: !document.querySelector("[data-ml-blind-note]").hidden
  }));
  assert.ok(blindUi.blind, "lesson 4 should switch the lab into blind mode");
  assert.strictEqual(blindUi.meters, "none", "meters should be hidden in blind mode");
  assert.ok(blindUi.note, "blind mode should explain itself before you start");

  await page.click("[data-ml-play]");
  const blind = await page.evaluate(async () => {
    const read = () => window.__mixlab.metrics();
    for (let i = 0; i < 700; i++) {
      const m = read();
      if (m.lessonDone) return { done: true, ms: m };
      if (Math.abs(m.tempoDiff) > 0.025) {
        const need = -(m.tempoDiff / m.bpmA) * 100;
        window.__mixlab.setPitch(m.pitch + Math.max(-0.02, Math.min(0.02, need)));
      } else if (Math.abs(m.offsetMs) > 5) {
        window.__mixlab.nudge(m.offsetMs);
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    return { done: false, ms: read() };
  });
  assert.ok(blind.done, "the blind hold should complete after twelve locked seconds");
  const revealed = await page.evaluate(() => ({
    blind: document.querySelector("[data-mixlab]").classList.contains("is-blind"),
    meters: getComputedStyle(document.querySelector(".ml-meters")).display
  }));
  assert.strictEqual(revealed.blind, false, "the readouts should return when the blind hold is done");
  assert.notStrictEqual(revealed.meters, "none", "meters should be visible again");

  /* 8 — keyboard: space pauses only once the lab has focus / is running */
  await page.click("[data-ml-reset]");          /* the blind hold is still rolling at this point */
  await new Promise((r) => setTimeout(r, 150));
  await page.click("[data-ml-play]");
  await new Promise((r) => setTimeout(r, 300));
  assert.ok((await page.evaluate(() => window.__mixlab.metrics().running)) === true);
  await page.keyboard.press("Space");
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(await page.evaluate(() => window.__mixlab.metrics().running), false, "space should pause");

  /* 9 — no console noise anywhere */
  assert.deepStrictEqual(errors, [], `console errors: ${errors.join(" | ")}`);

  await browser.close();
  console.log("Mix Lab: all checks passed, 0 console errors");
})().catch((err) => {
  console.error("Mix Lab test failed:", err.message);
  process.exit(1);
});
