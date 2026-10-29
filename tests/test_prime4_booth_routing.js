/**
 * Regression test suite for Denon PRIME 4+ hardware output routing,
 * multi-line allocation engine, and booth/zone connector verification.
 */
const assert = require("assert");
const path = require("path");
const fs = require("fs");

let puppeteer = null;
try {
  puppeteer = require("puppeteer-core");
} catch (e) {
  puppeteer = null;
}
const { startServer, openPage } = require("./dom_harness");

const catalog = require(path.join(__dirname, "..", "assets", "dj-gear-catalog.json"));
const { OffbeatGear } = require(path.join(__dirname, "..", "assets", "gear-connections.js"));

const PORT = process.env.PORT || 8080;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTests() {
  console.log("=== Testing Denon PRIME 4+ Catalog & Connector Specifications ===");
  const prime4 = catalog.items.find(i => i.id === "denon-prime-4-plus");
  assert.ok(prime4, "denon-prime-4-plus must exist in catalog");

  // Verify Prime 4+ outputs
  const prime4Booth = prime4.outputs.find(o => o.role === "booth");
  assert.ok(prime4Booth, "Prime 4+ must have a booth output");
  assert.strictEqual(prime4Booth.connector, "xlr", "Prime 4+ booth connector must be xlr (balanced)");
  assert.strictEqual(prime4Booth.balanced, true, "Prime 4+ booth output must be balanced");
  assert.ok(prime4Booth.label.toLowerCase().includes("xlr"), "Prime 4+ booth label must mention XLR");

  const prime4Zone = prime4.outputs.find(o => o.role === "zone");
  assert.ok(prime4Zone, "Prime 4+ must have a zone output");
  assert.strictEqual(prime4Zone.connector, "xlr", "Prime 4+ zone connector must be xlr (balanced)");
  assert.strictEqual(prime4Zone.balanced, true, "Prime 4+ zone output must be balanced");

  const prime4TRSBooth = prime4.outputs.find(o => o.connector === "trs" && o.role === "booth");
  assert.strictEqual(prime4TRSBooth, undefined, "Prime 4+ must NOT have a TRS booth output");

  console.log("✓ Prime 4+ catalog outputs verified: Master XLR + RCA, Booth XLR, Zone XLR.");

  console.log("=== Testing XDJ-AZ Editorial & DDJ-FLX10/Prime Go/RANE FOUR TRS Booth Output Preservation ===");
  // Verify editorial text in xdj-az-vs-denon-prime-4-plus.html
  const xdjAzHtml = fs.readFileSync(path.join(__dirname, "..", "xdj-az-vs-denon-prime-4-plus.html"), "utf8");
  assert.ok(xdjAzHtml.includes("XDJ-AZ has TRS booth outputs; PRIME 4+ has XLR booth outputs."),
    "xdj-az-vs-denon-prime-4-plus.html must state XDJ-AZ has TRS booth and PRIME 4+ has XLR booth");

  // Verify catalog devices that preserve TRS booth
  const flx10 = catalog.items.find(i => i.id === "pioneer-ddj-flx10");
  assert.ok(flx10, "pioneer-ddj-flx10 must exist in catalog");
  const flx10Booth = flx10.outputs.find(o => o.role === "booth");
  assert.ok(flx10Booth, "DDJ-FLX10 must have a booth output");
  assert.strictEqual(flx10Booth.connector, "trs", "DDJ-FLX10 booth connector must be trs (1/4-inch balanced)");

  const primeGo = catalog.items.find(i => i.id === "denon-prime-go");
  assert.ok(primeGo, "denon-prime-go must exist in catalog");
  const primeGoBooth = primeGo.outputs.find(o => o.role === "booth");
  assert.strictEqual(primeGoBooth.connector, "trs", "denon-prime-go booth connector must be trs");

  const raneFour = catalog.items.find(i => i.id === "rane-four");
  assert.ok(raneFour, "rane-four must exist in catalog");
  const raneFourBooth = raneFour.outputs.find(o => o.role === "booth");
  assert.strictEqual(raneFourBooth.connector, "trs", "rane-four booth connector must be trs");
  console.log("✓ Editorial XDJ-AZ spec and catalog DDJ-FLX10, Prime Go, and RANE FOUR 1/4\" TRS booth outputs confirmed intact.");

  console.log("=== Testing Connection Engine Multi-Line Allocation ===");
  const hs5 = catalog.items.find(i => i.id === "yamaha-hs5");
  const eon715 = catalog.items.find(i => i.id === "jbl-eon-715");
  assert.ok(hs5 && eon715, "Test speakers must exist");

  const used = {};
  // Line 1: Main studio monitors (HS5)
  const line1 = OffbeatGear.connectionPlan(catalog, prime4, hs5, 1, { usedOutputs: used });
  assert.strictEqual(line1.kind, "product");
  assert.strictEqual(line1.itemId, "cable-xlr-xlr");
  assert.strictEqual(line1.output.role, "master");
  assert.strictEqual(line1.output.connector, "xlr");
  used[line1.output.connector] = (used[line1.output.connector] || 0) + 1;
  used.claimed = [line1.output];

  // Line 2: Booth monitors (HS5)
  const line2 = OffbeatGear.connectionPlan(catalog, prime4, hs5, 1, { usedOutputs: used });
  assert.strictEqual(line2.kind, "product");
  assert.strictEqual(line2.itemId, "cable-xlr-xlr");
  assert.strictEqual(line2.output.role, "booth");
  assert.strictEqual(line2.output.connector, "xlr");
  used[line2.output.connector] = (used[line2.output.connector] || 0) + 1;
  used.claimed.push(line2.output);

  // Line 3: Zone PA (EON 715)
  const line3 = OffbeatGear.connectionPlan(catalog, prime4, eon715, 1, { usedOutputs: used });
  assert.strictEqual(line3.kind, "product");
  assert.strictEqual(line3.itemId, "cable-xlr-xlr");
  assert.strictEqual(line3.output.role, "zone");
  assert.strictEqual(line3.output.connector, "xlr");
  used[line3.output.connector] = (used[line3.output.connector] || 0) + 1;
  used.claimed.push(line3.output);

  // Line 4: Auxiliary monitors (HS5) -> RCA master
  const line4 = OffbeatGear.connectionPlan(catalog, prime4, hs5, 1, { usedOutputs: used });
  assert.strictEqual(line4.kind, "product");
  assert.strictEqual(line4.itemId, "cable-rca-trs");
  assert.strictEqual(line4.output.role, "master");
  assert.strictEqual(line4.output.connector, "rca");
  used[line4.output.connector] = (used[line4.output.connector] || 0) + 1;
  used.claimed.push(line4.output);

  // Line 5: Exceeds available physical outputs
  const line5 = OffbeatGear.connectionPlan(catalog, prime4, hs5, 1, { usedOutputs: used });
  assert.strictEqual(line5.kind, "unresolved");
  assert.strictEqual(line5.conflict, true);
  console.log("✓ Connection engine correctly routes Master -> Booth -> Zone -> RCA Master -> Unresolved.");

  console.log("=== Testing DDJ-FLX10 Multi-Line Fallback to Booth TRS ===");
  const flxUsed = {};
  const flxLine1 = OffbeatGear.connectionPlan(catalog, flx10, hs5, 1, { usedOutputs: flxUsed });
  assert.strictEqual(flxLine1.output.role, "master");
  assert.strictEqual(flxLine1.output.connector, "xlr");
  flxUsed[flxLine1.output.connector] = (flxUsed[flxLine1.output.connector] || 0) + 1;
  flxUsed.claimed = [flxLine1.output];

  const flxLine2 = OffbeatGear.connectionPlan(catalog, flx10, hs5, 1, { usedOutputs: flxUsed });
  assert.strictEqual(flxLine2.output.role, "master");
  assert.strictEqual(flxLine2.output.connector, "rca");
  flxUsed[flxLine2.output.connector] = (flxUsed[flxLine2.output.connector] || 0) + 1;
  flxUsed.claimed.push(flxLine2.output);

  const flxLine3 = OffbeatGear.connectionPlan(catalog, flx10, hs5, 1, { usedOutputs: flxUsed });
  assert.strictEqual(flxLine3.output.role, "booth");
  assert.strictEqual(flxLine3.output.connector, "trs");
  assert.strictEqual(flxLine3.kind, "allowance");
  console.log("✓ DDJ-FLX10 correctly falls back to Booth TRS allowance when Master XLR & RCA are full.");

  console.log("=== Testing Browser Rig Studio Integration ===");
  if (puppeteer) {
    try {
      const browser = await puppeteer.launch({
        executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/local/bin/chromium",
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(`${BASE_URL}/build-your-dj-setup.html?add=denon-prime-4-plus`, { waitUntil: "networkidle0" });

        // Add Line 1: Yamaha HS5
        await page.evaluate(() => document.querySelector(".rs-add-chip[data-cat=\"speakers\"]").click());
        await page.waitForSelector("button[data-drawer-use=\"yamaha-hs5\"]");
        await page.evaluate(() => document.querySelector("button[data-drawer-use=\"yamaha-hs5\"]").click());
        await new Promise(r => setTimeout(r, 200));

        // Add Line 2: Yamaha HS5 (Booth)
        await page.evaluate(() => document.querySelector(".rs-add-chip[data-cat=\"speakers\"]").click());
        await page.waitForSelector("button[data-drawer-use=\"yamaha-hs5\"]");
        await page.evaluate(() => document.querySelector("button[data-drawer-use=\"yamaha-hs5\"]").click());
        await new Promise(r => setTimeout(r, 200));

        // Add Line 3: JBL EON 715 (Zone)
        await page.evaluate(() => document.querySelector(".rs-add-chip[data-cat=\"speakers\"]").click());
        await page.waitForSelector("button[data-drawer-use=\"jbl-eon-715\"]");
        await page.evaluate(() => document.querySelector("button[data-drawer-use=\"jbl-eon-715\"]").click());
        await new Promise(r => setTimeout(r, 200));

        const conns = await page.evaluate(() => window.__rigStudio.connections());
        assert.strictEqual(conns.length, 3, "Must have 3 connections planned");

        assert.strictEqual(conns[0].outputRole, "master");
        assert.strictEqual(conns[0].output, "xlr");
        assert.strictEqual(conns[0].itemId, "cable-xlr-xlr");

        assert.strictEqual(conns[1].outputRole, "booth");
        assert.strictEqual(conns[1].output, "xlr");
        assert.strictEqual(conns[1].itemId, "cable-xlr-xlr");

        assert.strictEqual(conns[2].outputRole, "zone");
        assert.strictEqual(conns[2].output, "xlr");
        assert.strictEqual(conns[2].itemId, "cable-xlr-xlr");

        const shopping = await page.evaluate(() => window.__rigStudio.shoppingList());
        const xlrCables = shopping.filter(item => item.itemId === "cable-xlr-xlr");
        assert.strictEqual(xlrCables.length, 1, "Cables should be consolidated into one shopping line");
        assert.strictEqual(xlrCables[0].qty, 3, "Must require 3 pairs of cable-xlr-xlr");
        assert.strictEqual(xlrCables[0].lineTotal, 84, "3 pairs at $28 = $84");

        console.log("✓ Rig Studio browser verification passed: 3 XLR lines planned (Master, Booth, Zone) totaling $84.");
      } finally {
        await browser.close();
      }
    } catch (err) {
      console.log("Puppeteer launch failed, running in DOM harness:", err.message);
      await runDomHarnessTest();
    }
  } else {
    await runDomHarnessTest();
  }

  console.log("\nALL PRIME 4+ BOOTH ROUTING AND ALLOCATION REGRESSION TESTS PASSED!\n");
}

async function runDomHarnessTest() {
  const server = await startServer();
  let page = null;
  try {
    function encode(payload) {
      return Buffer.from(JSON.stringify(payload), "utf8").toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    const slot = (slotId, category, itemId, extra) => Object.assign({ slotId, category, itemId, qty: 1, owned: false }, extra || {});
    const url = `${server.base}/build-your-dj-setup.html?rig=${encode({
      n: "Prime 4+ Multi-Route",
      i: [
        slot("ctl", "controllers", "denon-prime-4-plus"),
        slot("spk1", "speakers", "yamaha-hs5"),
        slot("spk2", "speakers", "yamaha-hs5"),
        slot("spk3", "speakers", "jbl-eon-715")
      ]
    })}`;
    page = await openPage(url);
    const conns = await page.connections();
    assert.strictEqual(conns.length, 3, "Must have 3 connections planned");

    assert.strictEqual(conns[0].outputRole, "master");
    assert.strictEqual(conns[0].output, "xlr");
    assert.strictEqual(conns[0].itemId, "cable-xlr-xlr");

    assert.strictEqual(conns[1].outputRole, "booth");
    assert.strictEqual(conns[1].output, "xlr");
    assert.strictEqual(conns[1].itemId, "cable-xlr-xlr");

    assert.strictEqual(conns[2].outputRole, "zone");
    assert.strictEqual(conns[2].output, "xlr");
    assert.strictEqual(conns[2].itemId, "cable-xlr-xlr");

    const shopping = await page.shopping();
    const xlrCables = shopping.filter(item => item.itemId === "cable-xlr-xlr");
    assert.strictEqual(xlrCables.length, 1, "Cables should be consolidated into one shopping line");
    assert.strictEqual(xlrCables[0].qty, 3, "Must require 3 pairs of cable-xlr-xlr");
    assert.strictEqual(xlrCables[0].lineTotal, 84, "3 pairs at $28 = $84");

    console.log("✓ DOM harness Rig Studio verification passed: 3 XLR lines planned (Master, Booth, Zone) totaling $84.");
  } finally {
    if (page) page.close();
    await server.close();
  }
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
