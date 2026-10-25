const puppeteer = require("/tmp/browser/node_modules/puppeteer-core");

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    executablePath: "/tmp/chromium",
    headless: "shell"
  });

  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:8099/build-your-dj-setup.html", { waitUntil: "load" });

  // Wait for catalog load and app render
  await page.waitForSelector(".rig-dashboard-shell", { timeout: 5000 });
  console.log("✓ Dashboard mounted successfully");

  // Check initial calculations
  const initialSpend = await page.$eval(".metric-val--spend", el => el.textContent.trim());
  console.log("Initial Needed Spend:", initialSpend);

  // Test 1: Load Preset "The Club-Ready Rig"
  await page.click('[data-preset-id="club-ready"]');
  await new Promise(r => setTimeout(r, 200));
  const clubModel = await page.$eval(".booth-card--main .booth-model", el => el.textContent.trim());
  console.log("Preset loaded controller:", clubModel);
  if (clubModel !== "DDJ-FLX10") throw new Error("Expected DDJ-FLX10 for club preset, got " + clubModel);

  // Test 2: Modal Component Swapper
  await page.click('.booth-card--main [data-action="pick"]');
  await page.waitForSelector(".picker-backdrop", { timeout: 3000 });
  console.log("✓ Component selector modal opened");

  // Search in modal
  await page.type("[data-modal-search]", "Denon Prime 4");
  await new Promise(r => setTimeout(r, 200));
  const filteredCount = await page.$$eval(".picker-card", cards => cards.length);
  console.log("Modal filtered items count for Denon Prime 4:", filteredCount);
  if (filteredCount !== 1) throw new Error("Expected 1 result for Denon Prime 4 search");

  // Select Denon Prime 4+
  await page.evaluate(() => {
    const btn = document.querySelector("#modal-items-grid .btn-select-item");
    if (btn) btn.click();
    else console.error("Could not find button inside #modal-items-grid");
  });
  await new Promise(r => setTimeout(r, 300));

  const newModel = await page.$eval(".booth-card--main .booth-model", el => el.textContent.trim());
  console.log("Updated controller in rig:", newModel);
  if (newModel !== "Prime 4+") throw new Error("Expected Prime 4+ selected");

  // Test 3: Toggle "Already Own"
  const preToggleSpend = await page.$eval(".metric-val--spend", el => el.textContent.trim());
  await page.click('.booth-card--main [data-action="toggle-slot-owned"]');
  await new Promise(r => setTimeout(r, 200));
  const postToggleSpend = await page.$eval(".metric-val--spend", el => el.textContent.trim());
  console.log("Spend before owned toggle:", preToggleSpend, "-> after owned toggle:", postToggleSpend);

  // Test 4: Quantity adjustment
  const preQtySpend = await page.$eval(".spend-total-num", el => el.textContent.trim());
  await page.select(".qty-select", "2");
  await new Promise(r => setTimeout(r, 200));
  console.log("Adjusted quantity to 2");

  // Test 5: Open Compare Builds Modal
  await page.click('[data-action="open-compare"]');
  await page.waitForSelector("#compare-modal-title", { timeout: 3000 });
  console.log("✓ Compare setups modal opened");
  await page.click('.picker-close');
  await new Promise(r => setTimeout(r, 200));

  // Test 6: Deep link test (?add=pioneer-ddj-flx10)
  await page.goto("http://127.0.0.1:8099/build-your-dj-setup.html?add=pioneer-ddj-flx10", { waitUntil: "load" });
  await page.waitForSelector(".booth-card--main", { timeout: 5000 });
  const deepLinkedModel = await page.$eval(".booth-card--main .booth-model", el => el.textContent.trim());
  console.log("Deep-linked controller:", deepLinkedModel);
  if (deepLinkedModel !== "DDJ-FLX10") throw new Error("Expected deep-linked DDJ-FLX10");

  // Test 7: Hardware Spec Inspector Modal
  await page.click('.booth-card--main .booth-spec-btn');
  await page.waitForSelector('.picker-dialog--inspector', { visible: true });
  const inspectorTitle = await page.$eval('#inspector-title', el => el.textContent.trim());
  console.log('✓ Inspector modal opened for:', inspectorTitle);
  if (inspectorTitle !== "DDJ-FLX10") throw new Error("Expected inspector for DDJ-FLX10, got: " + inspectorTitle);
  await page.click('.picker-close');
  await new Promise(r => setTimeout(r, 200));

  // Test 8: Upgrade Path Advisory & Compatibility Badges
  const upgradeText = await page.$eval('.upgrade-body strong', el => el.textContent.trim());
  console.log('✓ Upgrade advisory active:', upgradeText);
  if (!upgradeText) throw new Error("Expected upgrade advisory text");

  const compatBadges = await page.$$('.compat-level-badge');
  console.log('✓ Compatibility level badges rendered:', compatBadges.length);
  if (compatBadges.length === 0) throw new Error("Expected compatibility level badges");

  console.log("JS Console Errors:", errors);
  if (errors.length > 0) throw new Error("Found JS errors: " + JSON.stringify(errors));

  await browser.close();
  console.log("ALL RIG BUILDER TESTS (INCLUDING SPEC INSPECTOR & UPGRADE ADVISOR) PASSED WITH 0 ERRORS!");
})();
