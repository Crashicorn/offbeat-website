/* Browser coverage for supported mobile and already-owned computer host paths.
 * Run: PORT=4173 node tests/test_rig_mobile_host.js
 */
const assert = require("assert");

function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_CORE,
    "/tmp/browser/node_modules/puppeteer-core",
    "/tmp/node_modules/puppeteer-core",
    "puppeteer-core"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { /* try the next path */ }
  }
  throw new Error("puppeteer-core not found; set PUPPETEER_CORE to its install path");
}

const puppeteer = loadPuppeteer();
const PORT = process.env.PORT || 8099;
const BASE = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/tmp/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
    localStorage.setItem("offbeat.ga-consent.v1", JSON.stringify({ analytics: "denied", v: 1, at: new Date().toISOString() }));
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(`${BASE}/build-your-dj-setup.html`, { waitUntil: "load" });
  await page.waitForSelector('[data-rs="start-scratch"]', { timeout: 8000 });
  await page.click('[data-rs="start-scratch"]');

  /* Build a clean FLX4 rig using the actual catalog drawer. */
  await page.waitForSelector('[data-rs="add-slot"][data-cat="controllers"]');
  await page.click('[data-rs="add-slot"][data-cat="controllers"]');
  await page.waitForSelector('[data-drawer-use="pioneer-ddj-flx4"]', { timeout: 5000 });
  await page.$eval('[data-drawer-use="pioneer-ddj-flx4"]', (button) => button.click());
  await page.waitForFunction(() =>
    window.__rigStudio.state().items.some((item) => item.itemId === "pioneer-ddj-flx4")
  );

  /* The host drawer labels the phone/tablet as already owned, not as free gear. */
  await page.waitForSelector('[data-rs="add-slot"][data-cat="laptops"]');
  await page.click('[data-rs="add-slot"][data-cat="laptops"]');
  await page.waitForSelector('[data-drawer-use="existing-mobile-app-device"]', { timeout: 5000 });
  const mobileCard = await page.$eval('[data-drawer-use="existing-mobile-app-device"]', (button) =>
    button.closest(".rs-option").textContent
  );
  assert.match(mobileCard, /Already owned/i, "mobile host must be presented as an existing device");
  assert.match(mobileCard, /new device, app, adapter and power costs are not included/i,
    "the phone/tablet option must not imply device or app costs are included");
  assert.match(mobileCard, /Selected rekordbox modes/i, "the FLX4's limited mobile support should be named");
  await page.$eval('[data-drawer-use="existing-mobile-app-device"]', (button) => button.click());

  const mobilePath = await page.evaluate(() => ({
    hosts: window.__rigStudio.state().items.filter((item) => item.category === "laptops"),
    hostCheck: window.__rigStudio.readiness().find((check) => check.key === "host"),
    shopping: window.__rigStudio.shoppingList()
  }));
  assert.strictEqual(mobilePath.hosts.length, 1, "one selected host should occupy one host slot");
  assert.strictEqual(mobilePath.hosts[0].itemId, "existing-mobile-app-device");
  assert.strictEqual(mobilePath.hosts[0].owned, true, "selecting this option confirms an already-owned device");
  assert.deepStrictEqual(mobilePath.hostCheck, { key: "host", level: "ok" },
    "the FLX4's documented mobile path should satisfy the host check");
  assert.ok(!mobilePath.shopping.some((line) => line.itemId === "existing-mobile-app-device"),
    "an already-owned device must not become a $0 shopping-list purchase");

  await wait(250);
  const hostNode = await page.$eval('[data-pos="host"]', (node) => ({
    label: node.getAttribute("aria-label"),
    price: node.querySelector(".rs-node-price").textContent,
    iconCount: node.querySelectorAll(".rs-node-role svg").length
  }));
  assert.match(hostNode.label, /Mobile app host/);
  assert.match(hostNode.price, /already owned/i);
  assert.strictEqual(hostNode.iconCount, 1, "the host node should render its mobile-device icon");
  const mobileWire = await page.$$eval(".rs-wire-label", (nodes) => nodes.map((node) => node.textContent).join(" | "));
  assert.match(mobileWire, /supported mobile app/i, "the signal map should show a mobile-app path, not a laptop cable");

  /* Auto-fix must preserve that supported mobile host instead of adding a PC. */
  await page.$eval('[data-rs="autofix"]', (button) => button.click());
  await wait(300);
  const afterAutoFix = await page.evaluate(() => ({
    items: window.__rigStudio.state().items,
    hostCheck: window.__rigStudio.readiness().find((check) => check.key === "host")
  }));
  assert.ok(afterAutoFix.items.some((item) => item.itemId === "existing-mobile-app-device"),
    "auto-fix should keep the chosen mobile host");
  assert.ok(!afterAutoFix.items.some((item) => item.itemId === "windows-dj-laptop" || item.itemId === "existing-computer-host"),
    "auto-fix must not silently add a computer to a valid mobile rig");
  assert.deepStrictEqual(afterAutoFix.hostCheck, { key: "host", level: "ok" });

  /* An unsupported controller makes the mobile path a blocker, then the action
     swaps the same host slot to an existing computer without inventing a free PC. */
  await page.$eval('.rs-node[data-rs="pick"][data-cat="controllers"]', (node) => node.click());
  await page.waitForSelector('[data-drawer-use="pioneer-ddj-flx10"]', { timeout: 5000 });
  await page.$eval('[data-drawer-use="pioneer-ddj-flx10"]', (button) => button.click());
  await wait(250);
  const unsupported = await page.evaluate(() => ({
    items: window.__rigStudio.state().items,
    hostCheck: window.__rigStudio.readiness().find((check) => check.key === "host"),
    action: Array.from(document.querySelectorAll(".rs-check-action"))
      .find((button) => button.textContent.includes("Choose a compatible host"))
      ?.getAttribute("data-slot")
  }));
  assert.deepStrictEqual(unsupported.hostCheck, { key: "host", level: "bad" },
    "an undocumented mobile pairing must not be called ready");
  assert.ok(unsupported.items.some((item) => item.itemId === "existing-mobile-app-device"));
  assert.ok(unsupported.action, "the warning action should target the existing host slot");

  await page.evaluate(() => {
    Array.from(document.querySelectorAll(".rs-check-action"))
      .find((button) => button.textContent.includes("Choose a compatible host")).click();
  });
  await page.waitForSelector('[data-drawer-use="existing-computer-host"]', { timeout: 5000 });
  await page.$eval('[data-drawer-use="existing-computer-host"]', (button) => button.click());
  await wait(250);
  const computerPath = await page.evaluate(() => ({
    hosts: window.__rigStudio.state().items.filter((item) => item.category === "laptops"),
    hostCheck: window.__rigStudio.readiness().find((check) => check.key === "host"),
    shopping: window.__rigStudio.shoppingList()
  }));
  assert.strictEqual(computerPath.hosts.length, 1, "the warning action should reuse the current host slot");
  assert.strictEqual(computerPath.hosts[0].itemId, "existing-computer-host");
  assert.strictEqual(computerPath.hosts[0].owned, true);
  assert.deepStrictEqual(computerPath.hostCheck, { key: "host", level: "ok" });
  assert.ok(!computerPath.shopping.some((line) => line.itemId === "existing-computer-host"),
    "the generic computer option represents an existing device, not a free new one");

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await wait(250);
  const mobileWidths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.strictEqual(mobileWidths[0], mobileWidths[1], `no horizontal overflow at 390px, got ${mobileWidths}`);
  assert.deepStrictEqual(errors, [], `console errors: ${errors.join(" | ")}`);

  await browser.close();
  console.log("Rig Studio host paths: passed mobile/computer compatibility, costs, auto-fix, replacement and 390px layout; 0 console errors");
})().catch((error) => {
  console.error("Rig Studio mobile-host test failed:", error.stack || error.message);
  process.exit(1);
});
