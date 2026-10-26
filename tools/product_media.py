#!/usr/bin/env python3
"""Wire the shared product-media renderer into equipment pages.

Mechanisms (all rendered by assets/product-illustrations.js):
  script   - load product-illustrations.js on a page that lacks it
  heading  - add data-product="<id>" (+ optional float mode) to an h2/h3
  slot     - insert an .ofb-product-media slot at the top of an .ofb-product card
  duo      - insert a two-up .product-duo block after a heading (vs pages)

Figures prefer a verified catalog photo, else the labelled technical
drawing. Media-library ids live in assets/dj-gear-catalog.json (Rig Studio
catalog) and in the media-only list inside product-illustrations.js.

Idempotent; safe to re-run.  Usage: python3 tools/product_media.py [--dry-run]
"""
import re
import sys

SCRIPT_TAG = '<script defer src="assets/product-illustrations.js"></script>'

# Pages that should load the renderer (pick-title auto-match and/or hooks below)
SCRIPT_PAGES = [
    "best-dj-mixers-2026.html",
    "best-dj-mixers-beginners.html",
    "best-dj-turntables-2026.html",
    "best-budget-dj-equipment.html",
    "best-dj-controllers-under-500-2026.html",
    "best-studio-monitors.html",
    "pioneer-ddj-400-vs-flx4.html",
    "pioneer-ddj-flx4-vs-flx6.html",
    "xdj-az-vs-denon-prime-4-plus.html",
    "numark-mixtrack-pro-fx-vs-ddj-200.html",
    "midi-controllers-for-music-production.html",
    "best-standalone-dj-systems.html",
    "best-motorized-dj-controllers.html",
    "best-dj-controllers-for-beginners.html",
    "best-dj-controllers-for-rekordbox.html",
    "best-dj-controllers-for-serato.html",
    "best-dj-controllers-under-1000.html",
]

# (page, heading-text fragment, product id, mode)  mode: card | float
HEADING_TAGS = [
    ("best-budget-dj-equipment.html", "Top Pick: Pioneer DJ DDJ-FLX4", "pioneer-ddj-flx4", "card"),
    ("best-budget-dj-equipment.html", "The Tactile Choice: Hercules DJControl Inpulse 500", "hercules-inpulse-500", "card"),
    ("best-dj-controllers-under-500-2026.html", "Pioneer DDJ-FLX6-GT: The Versatile All-Rounder", "pioneer-ddj-flx6", "banner"),
    ("best-dj-controllers-under-500-2026.html", "Rane One: The Scratching Specialist", "rane-one", "banner"),
    ("best-dj-controllers-under-500-2026.html", "Hercules DJControl Inpulse 500: The Best for Beginners", "hercules-inpulse-500", "banner"),
    ("best-studio-monitors.html", "The Entry-Level King: PreSonus Eris Series", "presonus-eris", "card"),
    ("best-studio-monitors.html", "The Low-End Powerhouse: KRK Rokit 5", "krk-rokit-5-g4", "card"),
    ("best-studio-monitors.html", "The Accuracy Standard: Yamaha HS5", "yamaha-hs5", "card"),
    ("pioneer-ddj-400-vs-flx4.html", "Pioneer DDJ-400", "pioneer-ddj-400", "banner"),
    ("pioneer-ddj-400-vs-flx4.html", "Pioneer DDJ-FLX4", "pioneer-ddj-flx4", "banner"),
    ("midi-controllers-for-music-production.html", "The Ecosystem Kings: Ableton Push 3 and Akai MPC", "ableton-push-3", "banner"),
    ("midi-controllers-for-music-production.html", "Budget-Friendly Essentials: Akai MPK Mini and Arturia MiniLab", "akai-mpk-mini-mk3", "banner"),
]

# (page, exact h3 text inside .ofb-product, product id)
SLOTS = [
    ("best-standalone-dj-systems.html", "AlphaTheta XDJ-AZ", "alphatheta-xdj-az"),
    ("best-standalone-dj-systems.html", "Denon DJ Prime 4+", "denon-prime-4-plus"),
    ("best-motorized-dj-controllers.html", "RANE ONE", "rane-one"),
    ("best-motorized-dj-controllers.html", "RANE Performer", "rane-performer"),
    ("best-dj-controllers-for-beginners.html", "AlphaTheta / Pioneer DJ DDJ-FLX4", "pioneer-ddj-flx4"),
    ("best-dj-controllers-for-beginners.html", "AlphaTheta DDJ-FLX2", "pioneer-ddj-flx2"),
    ("best-dj-controllers-for-beginners.html", "Hercules DJControl Inpulse 500", "hercules-inpulse-500"),
    ("best-dj-controllers-for-rekordbox.html", "DDJ-FLX4", "pioneer-ddj-flx4"),
    ("best-dj-controllers-for-rekordbox.html", "DDJ-FLX2", "pioneer-ddj-flx2"),
    ("best-dj-controllers-for-rekordbox.html", "DDJ-GRV6", "alphatheta-ddj-grv6"),
    ("best-dj-controllers-for-rekordbox.html", "XDJ-AZ", "alphatheta-xdj-az"),
    ("best-dj-controllers-under-1000.html", "DDJ-FLX4", "pioneer-ddj-flx4"),
    ("best-dj-controllers-under-1000.html", "RANE ONE / premium Serato deals", "rane-one"),
    ("best-dj-controllers-for-serato.html", "DDJ-GRV6", "alphatheta-ddj-grv6"),
]

# (page, exact h3 text inside .ofb-product, [product ids]) - two-up inside the card
SLOT_DUOS = [
    ("best-dj-controllers-for-serato.html", "RANE ONE / RANE Performer path", ["rane-one", "rane-performer"]),
    ("best-dj-controllers-for-serato.html", "DDJ-FLX4 or DDJ-FLX2", ["pioneer-ddj-flx4", "pioneer-ddj-flx2"]),
]

# (page, heading-text fragment to insert after, [product ids])
DUOS = [
    ("pioneer-ddj-flx4-vs-flx6.html", "The short answer", ["pioneer-ddj-flx4:drawing", "pioneer-ddj-flx6"]),
    ("xdj-az-vs-denon-prime-4-plus.html", "Verdict: XDJ-AZ for club continuity, Prime 4+ for feature density", ["alphatheta-xdj-az", "denon-prime-4-plus"]),
    ("numark-mixtrack-pro-fx-vs-ddj-200.html", "Feature Comparison", ["numark-mixtrack-pro-fx", "pioneer-ddj-200"]),
]

HEADING_RE = re.compile(r"<(h[23])\b([^>]*)>(.*?)</\1>", re.S)
TAG_RE = re.compile(r"<[^>]+>")


def heading_text(inner):
    return " ".join(TAG_RE.sub(" ", inner).split())


def add_script(html, log):
    if "product-illustrations.js" in html:
        log.append("script already present")
        return html
    if "</body>" not in html:
        log.append("WARN no </body>")
        return html
    log.append("script added")
    return html.replace("</body>", SCRIPT_TAG + "\n</body>", 1)


def tag_heading(html, fragment, pid, mode, log):
    for m in HEADING_RE.finditer(html):
        tag, attrs, inner = m.group(1), m.group(2), m.group(3)
        if fragment not in heading_text(inner):
            continue
        if 'data-product' in attrs:
            # converge an existing tag to the desired mode
            want = f'data-product-mode="{mode}"' if mode != "card" else None
            new_attrs = re.sub(r'\s*data-product-mode="[^"]*"', "", attrs)
            if want:
                new_attrs = f" {want}" + new_attrs
            if new_attrs == attrs:
                log.append(f"heading already tagged: {fragment[:40]}")
                return html
            log.append(f"heading retagged [{mode}] {pid}: {fragment[:46]}")
            return html[: m.start()] + f"<{tag}{new_attrs}>" + inner + f"</{tag}>" + html[m.end():]
        if "pick-title" in attrs:
            log.append(f"WARN fragment is a pick-title (auto-matched), skipped: {fragment[:40]}")
            return html
        mode_attr = f' data-product-mode="{mode}"' if mode != "card" else ""
        new_open = f'<{tag} data-product="{pid}"{mode_attr}{attrs}>'
        log.append(f"heading tagged [{mode}] {pid}: {fragment[:46]}")
        return html[: m.start()] + new_open + inner + f"</{tag}>" + html[m.end():]
    log.append(f"WARN heading not found: {fragment[:50]}")
    return html


def add_slot_duo(html, h3_text, ids, log):
    marker = f'data-product="{ids[0]}"'
    if marker in html and f'data-product="{ids[1]}"' in html:
        log.append(f"slot duo already present: {h3_text[:30]}")
        return html
    slots = "".join(f'<div class="product-duo-slot" data-product="{pid}"></div>' for pid in ids)
    block = f'<div class="ofb-product-media"><div class="product-duo" role="group" aria-label="The two options in this pick">{slots}</div></div>'
    for m in re.finditer(r'<div class="ofb-product">', html):
        window = html[m.end(): m.end() + 2200]
        hm = re.search(r"<h3[^>]*>(.*?)</h3>", window, re.S)
        if hm and heading_text(hm.group(1)) == h3_text:
            if "ofb-product-media" in window[: hm.start()]:
                log.append(f"slot exists in card: {h3_text[:30]}")
                return html
            log.append(f"slot duo added: {h3_text[:40]}")
            return html[: m.end()] + block + html[m.end():]
    log.append(f"WARN .ofb-product card not found for h3: {h3_text[:40]}")
    return html


def add_slot(html, h3_text, pid, log):
    slot = f'<div class="ofb-product-media" data-product="{pid}"></div>'
    if slot in html:
        log.append(f"slot already present: {pid}")
        return html
    # find the .ofb-product card whose h3 matches
    for m in re.finditer(r'<div class="ofb-product">', html):
        window = html[m.end(): m.end() + 2200]
        hm = re.search(r"<h3[^>]*>(.*?)</h3>", window, re.S)
        if not hm:
            continue
        if heading_text(hm.group(1)) == h3_text:
            if "ofb-product-media" in window[: hm.start()]:
                log.append(f"slot exists in card: {h3_text[:30]}")
                return html
            log.append(f"slot added {pid}: {h3_text[:40]}")
            return html[: m.end()] + slot + html[m.end():]
    log.append(f"WARN .ofb-product card not found for h3: {h3_text[:40]}")
    return html


def add_duo(html, fragment, ids, log):
    if "product-duo" in html:
        log.append("duo already present")
        return html
    for m in HEADING_RE.finditer(html):
        if fragment in heading_text(m.group(3)):
            def slot_for(spec):
                pid, _, media = spec.partition(":")
                m_attr = f' data-media="{media}"' if media else ""
                return f'<div class="product-duo-slot" data-product="{pid}"{m_attr}></div>'
            slots = "".join(slot_for(spec) for spec in ids)
            block = f'<div class="product-duo" role="group" aria-label="The products compared on this page">{slots}</div>'
            log.append(f"duo added after: {fragment[:46]}")
            return html[: m.end()] + block + html[m.end():]
    log.append(f"WARN duo anchor heading not found: {fragment[:50]}")
    return html


def main():
    dry = "--dry-run" in sys.argv
    pages = set(SCRIPT_PAGES)
    for entry in HEADING_TAGS + SLOTS + SLOT_DUOS + DUOS:
        pages.add(entry[0])
    changed = 0
    for page in sorted(pages):
        with open(page, encoding="utf-8") as fh:
            html = fh.read()
        log = []
        orig = html
        html = add_script(html, log)
        for pg, frag, pid, mode in HEADING_TAGS:
            if pg == page:
                html = tag_heading(html, frag, pid, mode, log)
        for pg, h3, pid in SLOTS:
            if pg == page:
                html = add_slot(html, h3, pid, log)
        for pg, h3, ids in SLOT_DUOS:
            if pg == page:
                html = add_slot_duo(html, h3, ids, log)
        for pg, frag, ids in DUOS:
            if pg == page:
                html = add_duo(html, frag, ids, log)
        status = "CHANGED" if html != orig else "same   "
        if html != orig:
            changed += 1
            if not dry:
                with open(page, "w", encoding="utf-8") as fh:
                    fh.write(html)
        print(f"{status} {page}")
        for line in log:
            print(f"    {line}")
    print(f"\n{'(dry run) ' if dry else ''}{changed} pages would change" if dry else f"\n{changed} pages changed")


if __name__ == "__main__":
    main()
