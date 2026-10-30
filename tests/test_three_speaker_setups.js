const puppeteer = require(process.env.PUPPETEER_CORE || "/tmp/browser/node_modules/puppeteer-core");
const assert = require("assert");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8080";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/local/bin/chromium";

(async () => {
  console.log("================================================================");
  console.log("STARTING THREE SPEAKER SETUPS BROWSER VALIDATION");
  console.log("================================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // ---------------------------------------------------------
    // SETUP 1: 1 PA Cabinet (JBL EON715)
    // ---------------------------------------------------------
    console.log("\n--- Testing Setup 1: 1 PA Cabinet (JBL EON715) ---");
    // Start with mobile-pro preset which uses JBL EON715
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });

    const setup1Details = await page.evaluate(() => {
      const spkSlot = window.__rigStudio.state().items.find(s => s.category === "speakers");
      const spkItem = window.__rigStudio.item(spkSlot.itemId);
      const spkLine = [...document.querySelectorAll(".rs-shop-line")].find(l => /EON715/i.test(l.textContent));
      const packaging = spkLine?.querySelector(".rs-shop-line-packaging")?.textContent.trim();
      const qty = spkSlot.qty || 1;
      const cables = [...document.querySelectorAll(".rs-shop-line")].filter(l => /cable/i.test(l.textContent)).map(l => l.querySelector(".rs-shop-line-name strong")?.textContent.trim());
      return {
        id: spkItem.id,
        name: spkItem.name,
        qty,
        speakerUnits: spkItem.speaker_units,
        boxLabel: spkItem.box_label,
        packagingText: packaging,
        cables
      };
    });

    console.log("Setup 1 Details:", setup1Details);
    assert.strictEqual(setup1Details.id, "jbl-eon-715", "JBL EON715 speaker selected");
    assert.strictEqual(setup1Details.qty, 1, "Default quantity is 1 for single PA cabinet");
    assert.strictEqual(setup1Details.speakerUnits, 1, "Speaker units is 1");
    assert.strictEqual(setup1Details.boxLabel, "single cabinet", "Box label is single cabinet");
    assert.ok(/Sold as single powered PA cabinet/i.test(setup1Details.packagingText), "Packaging clearly notes single PA cabinet");
    console.log("✓ Setup 1 (1 PA cabinet) verified in browser.");

    // ---------------------------------------------------------
    // SETUP 2: 1 Monitor Pair (Pioneer DJ DM-40D)
    // ---------------------------------------------------------
    console.log("\n--- Testing Setup 2: 1 Monitor Pair (Pioneer DJ DM-40D) ---");
    // Start with bedroom-starter preset which uses Pioneer DM-40D
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter`, { waitUntil: "networkidle0" });

    const setup2Details = await page.evaluate(() => {
      const spkSlot = window.__rigStudio.state().items.find(s => s.category === "speakers");
      const spkItem = window.__rigStudio.item(spkSlot.itemId);
      const spkLine = [...document.querySelectorAll(".rs-shop-line")].find(l => /DM-40D/i.test(l.textContent));
      const packaging = spkLine?.querySelector(".rs-shop-line-packaging")?.textContent.trim();
      const qty = spkSlot.qty || 1;
      const cables = [...document.querySelectorAll(".rs-shop-line")].filter(l => /cable/i.test(l.textContent)).map(l => l.querySelector(".rs-shop-line-name strong")?.textContent.trim());
      return {
        id: spkItem.id,
        name: spkItem.name,
        qty,
        speakerUnits: spkItem.speaker_units,
        boxLabel: spkItem.box_label,
        packagingText: packaging,
        cables
      };
    });

    console.log("Setup 2 Details:", setup2Details);
    assert.strictEqual(setup2Details.id, "pioneer-dm40d", "Pioneer DM-40D selected");
    assert.strictEqual(setup2Details.qty, 1, "Quantity is 1 pair");
    assert.strictEqual(setup2Details.speakerUnits, 2, "Speaker units is 2 in pair");
    assert.ok(/pair/i.test(setup2Details.boxLabel), "Box label is pair");
    assert.ok(/Sold as complete pair in one retail box/i.test(setup2Details.packagingText), "Packaging notes complete pair in one box");
    assert.ok(/Includes speaker audio cable/i.test(setup2Details.packagingText), "Packaging notes includes interconnection cable");
    console.log("✓ Setup 2 (1 monitor pair) verified in browser.");

    // ---------------------------------------------------------
    // SETUP 3: 2 Independent Studio Monitors (Yamaha HS5 / KRK Classic 5)
    // ---------------------------------------------------------
    console.log("\n--- Testing Setup 3: 2 Independent Studio Monitors (Yamaha HS5) ---");
    // Club ready preset uses Yamaha HS5
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });

    const setup3Details = await page.evaluate(() => {
      const spkSlot = window.__rigStudio.state().items.find(s => s.category === "speakers");
      const spkItem = window.__rigStudio.item(spkSlot.itemId);
      const spkLine = [...document.querySelectorAll(".rs-shop-line")].find(l => /HS5/i.test(l.textContent));
      const packaging = spkLine?.querySelector(".rs-shop-line-packaging")?.textContent.trim();
      const qty = spkSlot.qty || 1;
      const linePrice = spkLine?.querySelector(".rs-shop-line-price")?.textContent.trim();
      const cables = [...document.querySelectorAll(".rs-shop-line")].filter(l => /cable/i.test(l.textContent)).map(l => l.querySelector(".rs-shop-line-name strong")?.textContent.trim());
      return {
        id: spkItem.id,
        name: spkItem.name,
        qty,
        speakerUnits: spkItem.speaker_units,
        boxLabel: spkItem.box_label,
        packagingText: packaging,
        linePrice,
        cables
      };
    });

    console.log("Setup 3 Details (Yamaha HS5):", setup3Details);
    assert.strictEqual(setup3Details.id, "yamaha-hs5", "Yamaha HS5 selected");
    assert.strictEqual(setup3Details.qty, 1, "Default quantity is 1 pair pack in preset");
    assert.strictEqual(setup3Details.speakerUnits, 2, "Speaker units in pair is 2");
    assert.ok(/pair/i.test(setup3Details.boxLabel), "Box label is pair");
    assert.ok(/Sold individually · Need 2 units for stereo pair/i.test(setup3Details.packagingText), "Packaging notes sold individually, need 2 units");
    assert.strictEqual(setup3Details.linePrice, "$398", "Billed at $398 for the pair ($199 each)");
    console.log("✓ Setup 3a (Yamaha HS5 pair pack) verified in browser.");

    // Now test swapping to a single-unit monitor (KRK ROKIT 5 G4)
    console.log("\n--- Testing Setup 3b: Single Studio Monitor (KRK ROKIT 5 G4) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?add=krk-rokit-5-g4`, { waitUntil: "networkidle0" });

    const setup3bDetails = await page.evaluate(() => {
      const spkLine = [...document.querySelectorAll(".rs-shop-line")].find(l => /ROKIT/i.test(l.textContent));
      const packaging = spkLine?.querySelector(".rs-shop-line-packaging")?.textContent.trim();
      const spkItem = window.__rigStudio.item("krk-rokit-5-g4");
      const spkSlot = window.__rigStudio.state().items.find(s => s.category === "speakers");
      return {
        id: spkItem.id,
        name: spkItem.name,
        qty: spkSlot.qty || 1,
        speakerUnits: spkItem.speaker_units,
        boxLabel: spkItem.box_label,
        packagingText: packaging
      };
    });

    console.log("Setup 3b Details (KRK ROKIT 5 G4 single):", setup3bDetails);
    assert.strictEqual(setup3bDetails.speakerUnits, 1, "Single studio monitor has 1 unit per box");
    assert.ok(/Sold individually/i.test(setup3bDetails.packagingText), "Packaging notes sold individually");
    console.log("✓ Setup 3b (Single independent studio monitor) verified in browser.");

    assert.strictEqual(errors.length, 0, `No console errors: ${errors.join("; ")}`);
    console.log("\n================================================================");
    console.log("ALL THREE SPEAKER SETUPS BROWSER VALIDATION PASSED (100%)!");
    console.log("================================================================");

  } finally {
    await browser.close();
  }
})();
