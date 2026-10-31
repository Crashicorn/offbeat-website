/* Rendered sweep across every published page at desktop and phone widths.
 * Reports: horizontal overflow, console/page errors, broken images, missing h1.
 * Run: node tests/sweep_all_pages.js
 */
const puppeteer = require("/home/user/.tooling/node_modules/puppeteer-core");
const fs = require("fs");

const BASE = process.env.BASE || "http://127.0.0.1:8099/";
const pages = fs.readdirSync(".").filter((f) => f.endsWith(".html")).sort();

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/home/user/.tooling/chrome/chromium",
    headless: "shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
    env: { ...process.env, LD_LIBRARY_PATH: "/home/user/.tooling/al2023/lib" },
  });
  const problems = [];
  const page = await browser.newPage();
  let errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 120)); });
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url().slice(-60)));

  for (const [w, h, label] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    await page.setViewport({ width: w, height: h });
    for (const file of pages) {
      errors = [];
      await page.goto(BASE + file, { waitUntil: "networkidle2", timeout: 45000 });
      await new Promise((r) => setTimeout(r, 250));
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll("h1").length,
        broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
        nav: !!document.querySelector('nav[aria-label="Primary navigation"] a[href="dj-tools.html"]'),
      }));
      const hard = errors.filter((e) => !/favicon/i.test(e));
      if (m.overflow > 0 || m.h1 !== 1 || m.broken.length || !m.nav || hard.length) {
        problems.push({ file, label, ...m, errors: hard });
      }
    }
  }
  await browser.close();
  if (!problems.length) {
    console.log(`SWEEP OK: ${pages.length} pages x 2 viewports — no overflow, one h1, no broken images, no console errors, unified nav.`);
  } else {
    for (const p of problems) console.log(JSON.stringify(p));
    console.log(`SWEEP: ${problems.length} problem page/viewports`);
    process.exit(1);
  }
})();
