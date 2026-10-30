/* Evidence capture for the 2026-10-30 sitewide release pass.
 * Captures before (BASE_A, the checkpoint commit) and after (BASE_B, this branch).
 * Run: node tests/capture_release_evidence.js
 */
const puppeteer = require("/home/user/.tooling/node_modules/puppeteer-core");
const fs = require("fs");

const A = process.env.BASE_A || "http://127.0.0.1:8098/";
const B = process.env.BASE_B || "http://127.0.0.1:8099/";
const OUT = "evidence/sitewide-release-2026-10-30";
const pairs = [
  ["01-home-hero", "index.html", 1440, 900, "viewport", 0],
  ["02-home-paths", "index.html", 1440, 900, "viewport", 620],
  ["03-library-tools", "all-dj-guides.html", 1440, 1000, "viewport", 470],
  ["04-budget-guide", "best-budget-dj-equipment.html", 1440, 1100, "viewport", 780],
  ["05-headphone-fit", "best-dj-headphones-2026.html", 1440, 900, "viewport", null, "headphone-fit"],
  ["06-mobile-home", "index.html", 390, 844, "viewport", 0],
  ["07-search-rank", "index.html", 1440, 900, null, 0, null, "flx4 review"],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "/home/user/.tooling/chrome/chromium",
    headless: "shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
    env: { ...process.env, LD_LIBRARY_PATH: "/home/user/.tooling/al2023/lib" },
  });
  const page = await browser.newPage();

  for (const [name, file, w, h, mode, scroll, anchor, query] of pairs) {
    for (const [tag, base] of [["before", A], ["after", B]]) {
      await page.setViewport({ width: w, height: h });
      await page.goto(base + file, { waitUntil: "networkidle2", timeout: 45000 });
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /necessary only/i.test(x.textContent));
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 500));
      if (query) {
        await page.keyboard.press("/");
        await new Promise((r) => setTimeout(r, 350));
        await page.keyboard.type(query, { delay: 30 });
        await new Promise((r) => setTimeout(r, 900));
      }
      if (anchor) {
        const found = await page.evaluate((a) => {
          const el = document.getElementById(a);
          if (!el) return false;
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70);
          return true;
        }, anchor);
        if (!found) {
          // The section does not exist on the checkpoint commit: capture the
          // area where it belongs (just above the buying section) instead.
          await page.evaluate(() => {
            const el = [...document.querySelectorAll("h2")].find((x) => /actually buy today/i.test(x.textContent));
            if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 380);
          });
        }
      } else if (scroll) {
        await page.evaluate((y) => window.scrollTo(0, y), scroll);
      }
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: `${OUT}/${name}-${tag}.jpg`, type: "jpeg", quality: 82 });
    }
  }

  // The tools hub only exists on this branch.
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(B + "dj-tools.html", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `${OUT}/08-tools-hub-after.jpg`, type: "jpeg", quality: 82 });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/09-tools-hub-rows-after.jpg`, type: "jpeg", quality: 82 });

  // Mobile drawer (after only).
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(B + "index.html", { waitUntil: "networkidle2" });
  await page.click(".nav-toggle");
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}/10-mobile-nav-after.jpg`, type: "jpeg", quality: 82 });

  await browser.close();
  console.log("evidence written to", OUT);
})();
