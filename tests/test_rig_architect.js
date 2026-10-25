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
  await page.click('.booth-card--main [data-action="toggle-owned"]');
  await new Promise(r => setTimeout(r, 200));
  const postToggleSpend = await page.$eval(".metric-val--spend", el => el.textContent.trim());
  console.log("Spend before owned toggle:", preToggleSpend, "-> after owned toggle:", postToggleSpend);

  // Test 4: Compatibility Check
  const compatStatus = await page.$eval(".compat-status-tag", el => el.textContent.trim());
  console.log("Compatibility status tag:", compatStatus);

  console.log("JS Console Errors:", errors);
  if (errors.length > 0) throw new Error("Found JS errors: " + JSON.stringify(errors));

  await browser.close();
  console.log("ALL RIG BUILDER TESTS PASSED WITH 0 ERRORS!");
})();
