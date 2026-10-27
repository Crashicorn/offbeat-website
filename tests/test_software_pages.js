/* Regression guard for the five software pages whose licence facts were
 * corrected in October 2026. These pages are read by buyers who are about to
 * pay, so the test asserts on the text a visitor actually sees (rendered in
 * jsdom), not on source strings, and it re-checks links and images while it is
 * there.
 *
 * Run: JSDOM_PATH=/tmp/browser/node_modules/jsdom node tests/test_software_pages.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer, openPage } = require("./dom_harness");

const ROOT = path.resolve(__dirname, "..");

/* Claims that were on these pages and are not true in October 2026. Each one is
   paired with the reason it was removed, so a future edit cannot quietly
   reinstate it. */
const RETRACTED = [
  [/\bTraktor Pro 3\b/i, "Traktor Pro 4 is the current edition"],
  [/\bPerformance plan\b/i, "rekordbox has no plan called Performance"],
  [/\$9\.99\s*(?:\/|per\s*)?(?:mo|month)/i, "no rekordbox plan costs $9.99"],
  [/VirtualDJ[^.]{0,80}\bfree\s+(?:with|for)\b(?![^.]{0,40}\bwithout\b)/i,
    "VirtualDJ is not free with a controller, and is not free for home use once hardware is attached"],
  [/free for home, non-commercial use\./i, "the old VirtualDJ wording implied controller use was free"],
  [/\bdoes not support FLAC\b/i, "rekordbox supports FLAC"],
  [/rekordbox[^.]{0,60}\bfree\b((?:(?!\bnot\b)[^.]){0,40})\b(?:with|includes?|covers?)\b((?:(?!\bnot\b)[^.]){0,20})\b(stems|DVS|video)\b/i,
    "rekordbox Hardware Unlock never covers stems, DVS or video"],
  [/(?:hardware )?unlock[s]?\s+(?:includes?|covers?|gives?)\b((?:(?!\bnot\b)[^.]){0,20})\b(stems|DVS|video)/i,
    "on the listed FLX controllers the unlock covers Performance mode, recording and mix sharing — but not stems, DVS or video"]
];

const PAGES = [
  {
    file: "virtual-dj-vs-serato.html",
    must: [
      /Home \$?4\/mo/i,
      /Pro \$?19\/mo/i,
      /\$199\/yr/,
      /DJ Suite/i,
      /\$499/,
      /non-transferable|not transferable/i
    ]
  },
  {
    file: "serato-dj-lite-vs-pro.html",
    must: [/\$11\.99/, /\$299/, /\$499/, /Stems/i, /Practice Mode/i]
  },
  {
    file: "rekordbox-vs-serato.html",
    must: [/\$12\/mo or \$120\/yr/, /\$36\/mo or \$360\/yr/, /Hardware Unlock/i, /no perpetual/i, /recording and mix sharing/i]
  },
  {
    file: "serato-vs-rekordbox-vs-traktor.html",
    must: [/\$149/, /\$49/, /\$299/, /\$120\/yr/, /No free tier/i]
  },
  {
    file: "dj-software-apple-music.html",
    must: [/VirtualDJ/i, /Traktor Pro 4/i, /cannot be recorded|restrict recording/i]
  }
];

function links(page) {
  return page.queryAll("a[href]")
    .map((a) => a.getAttribute("href"))
    .filter((href) => href && !/^(https?:|mailto:|tel:|#)/i.test(href));
}

(async () => {
  const server = await startServer();
  try {
    for (const spec of PAGES) {
      const page = await openPage(server.base + "/" + spec.file, { expectRig: false });
      const text = page.text("main") || page.text("body");

      RETRACTED.forEach(([pattern, why]) => {
        assert.ok(!pattern.test(text), `${spec.file}: a retracted claim is back (${why}): ${pattern}`);
      });
      spec.must.forEach((pattern) => {
        assert.ok(pattern.test(text), `${spec.file}: missing the current fact ${pattern}`);
      });

      /* No internal link may point at a page that does not exist. */
      const broken = links(page).filter((href) => {
        const clean = href.split("#")[0].split("?")[0];
        return clean && !fs.existsSync(path.join(ROOT, clean));
      });
      assert.deepStrictEqual(broken, [], `${spec.file}: broken internal links: ${broken.join(", ")}`);

      /* Every local image must exist on disk, so no card renders empty. */
      const images = page.queryAll("img[src]")
        .map((img) => img.getAttribute("src"))
        .filter((src) => src && !/^(https?:|data:)/i.test(src));
      const missing = images.filter((src) => !fs.existsSync(path.join(ROOT, src.split("?")[0])));
      assert.deepStrictEqual(missing, [], `${spec.file}: missing images: ${missing.join(", ")}`);

      assert.deepStrictEqual(page.consoleErrors || [], [], `${spec.file}: console errors`);
      page.close();
      console.log(`ok  ${spec.file}  (${images.length} images, internal links resolve)`);
    }
    console.log("Software pages: licence facts, links, images and console — all verified");
  } finally {
    await server.close();
  }
})().catch((error) => {
  console.error("Software page test failed:", error.message);
  process.exitCode = 1;
});
