#!/usr/bin/env python3
"""Portable sitewide overflow/spacing audit — CI gate for the offbeat-website repo.

Usage:
  python overflow_audit_portable.py --base https://crashicorn.github.io/offbeat-website/ \
      [--sitemap BASE/sitemap.xml | --pages pages.txt] [--out ./overflow-audit-out] \
      [--widths 1280x800,390x844] [--strict] [--max-pages N]

Exit code 0 = clean; 1 = violations found (use as a CI gate).
Pages list file: one URL path per line (e.g. `index.html`, `guides/foo.html`).
Same measurement semantics as the 2026-10-31 coordination audit (README in
evidence/coordination/): page-level horizontal overflow, elements beyond the
viewport, container-level spill (scrollWidth > clientWidth with
overflow-x: visible), clipped containers, broken images, external image hosts.
"""
import argparse
import json
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

MEASURE = r"""
() => {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const out = {
    title: document.title,
    pageOverflowX: doc.scrollWidth - vw,
    beyondViewport: 0, beyondTop: [],
    spillVisible: 0, clipHidden: 0, spillTop: [],
    imgCount: document.images.length, imgBroken: 0, imgSrcs: []
  };
  const scrollableAncestor = (el) => {
    let p = el.parentElement, n = 0;
    while (p && p !== document.body && n < 10) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true;
      p = p.parentElement; n++;
    }
    return false;
  };
  const label = (el) => {
    let c = '';
    try { c = typeof el.className === 'string' ? el.className : ''; } catch (e) {}
    c = c.trim().split(/\s+/).slice(0, 3).join('.');
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) continue;
    if (r.right > vw + 1 && r.left >= -1 && r.left < vw && !scrollableAncestor(el)) {
      out.beyondViewport++;
      if (out.beyondTop.length < 10) {
        out.beyondTop.push({ el: label(el), overBy: Math.round(r.right - vw),
                             txt: (el.textContent || '').trim().slice(0, 30) });
      }
    }
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
      if (cs.overflowX === 'visible') {
        out.spillVisible++;
        if (out.spillTop.length < 10) {
          out.spillTop.push({ el: label(el), by: el.scrollWidth - el.clientWidth,
                              txt: (el.textContent || '').trim().slice(0, 30) });
        }
      } else if (cs.overflowX === 'hidden') {
        out.clipHidden++;
      }
    }
  }
  for (const img of document.images) {
    out.imgSrcs.push(img.currentSrc || img.src);
    if (img.complete && img.naturalWidth === 0) out.imgBroken++;
  }
  return out;
}
"""


def load_pages(a):
    if a.pages:
        return [l.strip() for l in Path(a.pages).read_text().splitlines() if l.strip()]
    url = a.sitemap
    xml = urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "replace")
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    base = a.base.rstrip("/") + "/"
    pages = []
    for loc in locs:
        loc = loc.strip()
        if loc.startswith(base):
            loc = loc[len(base):]
        elif loc.startswith(a.base.rstrip("/")):
            loc = loc[len(a.base.rstrip("/")):].lstrip("/")
        pages.append(loc or "index.html")
    return pages


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="site base URL, e.g. https://host/path/")
    ap.add_argument("--sitemap", default=None, help="sitemap URL (default: <base>sitemap.xml)")
    ap.add_argument("--pages", default=None, help="file with one page path per line")
    ap.add_argument("--out", default="./overflow-audit-out")
    ap.add_argument("--widths", default="1280x800,390x844")
    ap.add_argument("--browser-executable", default=None,
                    help="preinstalled Chrome/Chromium executable for CI runners")
    ap.add_argument("--strict", action="store_true",
                    help="also fail on elements beyond viewport (production itself has 1 such page)")
    ap.add_argument("--max-pages", type=int, default=0)
    a = ap.parse_args()
    if a.sitemap is None and a.pages is None:
        a.sitemap = a.base.rstrip("/") + "/sitemap.xml"

    pages = load_pages(a)
    if a.max_pages:
        pages = pages[: a.max_pages]
    widths = []
    for w in a.widths.split(","):
        w_, h_ = w.lower().split("x")
        widths.append((int(w_), int(h_)))
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    results = {}
    fails = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=a.browser_executable) if a.browser_executable else pw.chromium.launch()
        for w, h in widths:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            for p in pages:
                key = f"{p}::{w}x{h}"
                url = a.base.rstrip("/") + "/" + p
                try:
                    resp = page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    status = resp.status if resp else 0
                except Exception as e:
                    results[key] = {"error": str(e)[:120]}
                    fails.append((key, "LOAD ERROR"))
                    continue
                if status >= 400:
                    results[key] = {"http": status}
                    fails.append((key, f"HTTP {status}"))
                    continue
                try:
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(150)
                    page.evaluate("window.scrollTo(0, 0)")
                    page.wait_for_timeout(200)
                except Exception:
                    pass
                r = page.evaluate(MEASURE)
                r["http"] = status
                results[key] = r
                why = []
                if (r.get("pageOverflowX") or 0) > 1:
                    why.append(f"pageOverflowX={r['pageOverflowX']}px")
                if (r.get("spillVisible") or 0) > 0:
                    why.append(f"spillVisible={r['spillVisible']} "
                               + "; ".join(f"{t['el']} +{t['by']}px" for t in r["spillTop"][:3]))
                if (r.get("imgBroken") or 0) > 0:
                    why.append(f"imgBroken={r['imgBroken']}")
                if a.strict and (r.get("beyondViewport") or 0) > 0:
                    why.append(f"beyondViewport={r['beyondViewport']}")
                if why:
                    fails.append((key, " | ".join(why)))
            ctx.close()
        browser.close()

    (out_dir / "audit.json").write_text(json.dumps(results, indent=1))

    ext = Counter()
    for r in results.values():
        if isinstance(r, dict):
            for s in set(r.get("imgSrcs", [])):
                host = urlparse(s).netloc
                if host and urlparse(a.base).netloc not in host:
                    ext[host] += 1

    print(f"Audited {len(pages)} pages x {len(widths)} viewports against {a.base}")
    if fails:
        print(f"\nFAIL — {len(fails)} page/viewport violations:")
        for key, why in fails:
            print(f"  {key}: {why}")
    else:
        print("\nPASS — no page-level overflow, no container spill, no broken images.")
    if ext:
        print(f"\nWARNING — external image hosts present: {dict(ext)}")
    else:
        print("Image hosts: all local.")
    print(f"Raw data: {out_dir / 'audit.json'}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
