#!/usr/bin/env python3
"""Editorial hero-photo assignments.

The site's 16 editorial photographs were distributed very unevenly across
article heroes (two desk shots carried 20 pages each; mobile-dj-hero.jpg
was never used). This tool enforces the curated per-page assignments
below, swapping the hero `<img>` src and its photo-specific alt text
together so alt text always describes the pictured scene.

Idempotent — pages already at their target photo are untouched.
Run: python3 tools/hero_assignments.py [--dry-run]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
E = "assets/img/editorial/"

# Canonical alt text per photograph (must describe the pictured scene).
ALT = {
    "hero-breakdown.jpg": "A laptop showing an arrangement timeline beside a MIDI keyboard on a lamp-lit desk",
    "software-desk.jpg": "A laptop showing a DJ software waveform on a wooden desk in low light",
    "production-hero.jpg": "A production studio desk with a modular synth, keyboard and studio monitors",
    "booth-wide.jpg": "A DJ booth with a mixer and decks silhouetted against a crowd under blue stage light",
    "skills-hero.jpg": "A DJ's hands on a mixer in front of a crowd in a dark club",
    "controller-macro.jpg": "Close-up of a controller jog wheel, pads and knobs in warm light",
    "gear-flatlay.jpg": "Headphones, a USB drive, cables and a hard case arranged on a dark surface",
    "headphones-hero.jpg": "Closed-back DJ headphones hanging against a dark wall",
    "mixer-hero.jpg": "Close-up of a mixer's channel faders lit by warm light",
    "mobile-dj-hero.jpg": "A mobile DJ setup with a flight-cased mixer, coiled cables and PA speakers in an event hall",
    "pexels-dj-console-portrait-20116408.jpg": "A DJ working a console at a live club set, with the crowd beyond the booth",
    "pexels-mixer-knobs-744318.jpg": "Close-up photograph of an audio mixer’s channel knobs, faders and indicator lights",
    "hero-gig-small.jpg": "A DJ mixing on a controller in a small bar while a crowd dances under string lights",
    "hero-wedding.jpg": "Wedding reception speakers on stands with a mixer on a table and guests dancing under festoon lights",
    "vinyl-hero.jpg": "A tonearm and stylus tracking a record on a turntable",
    "wikimedia-stylus-cartridge-detail.jpg": "A focus-stacked photograph showing a turntable cartridge and stylus at two points along a record groove",
    "pexels-dj-laptop-mixing-17858169.jpg": "Close-up photograph of hands mixing on a DJ controller connected to a performance laptop on a desk",
    "pexels-dj-nightclub-booth-4062561.jpg": "A DJ performing in a vibrant nightclub booth with a multi-deck controller and a laptop displaying live DJ performance software",
    "pexels-music-production-workstation-27495246.jpg": "A music production workstation with a laptop running digital audio workstation software beside a tactile MIDI pad controller and mixer",
}

# Only pages that need to move away from an over-used hero. Pages absent
# from this map keep their current hero.
ASSIGN = {
    # production studio desk takes half of the production family
    "amuse-vs-distrokid.html": "production-hero.jpg",
    "best-dj-sample-packs-2026.html": "production-hero.jpg",
    "best-music-production-plugins.html": "production-hero.jpg",
    "best-music-production-software-2026.html": "production-hero.jpg",
    "fl-studio-vs-logic-pro.html": "production-hero.jpg",
    "midi-controllers-for-music-production.html": "production-hero.jpg",
    "music-production-software-free.html": "production-hero.jpg",
    "native-instruments-komplete-review.html": "production-hero.jpg",
    "splice-vs-loopmasters.html": "production-hero.jpg",
    "landr-vs-splice.html": "production-hero.jpg",
    "how-to-create-dj-mixes-for-youtube.html": "production-hero.jpg",
    # DAW-laptop desk for software reviews (off the waveform desk)
    "best-dj-software-beginners-2026.html": "hero-breakdown.jpg",
    "best-free-dj-software-2026.html": "hero-breakdown.jpg",
    "rekordbox-pro-review.html": "hero-breakdown.jpg",
    "serato-dj-pro-review.html": "hero-breakdown.jpg",
    # booth atmosphere for play-out software picks
    "djay-pro-review.html": "booth-wide.jpg",
    "best-dj-apps-ipad.html": "booth-wide.jpg",
    "dj-software-selection.html": "booth-wide.jpg",
    "best-dj-controllers-for-serato.html": "booth-wide.jpg",
    # semantic fits
    "can-you-dj-without-a-controller.html": "software-desk.jpg",
    "best-dj-usb-drives.html": "gear-flatlay.jpg",
    "controller-software-compatibility-matrix.html": "controller-macro.jpg",
    "best-motorized-dj-controllers.html": "skills-hero.jpg",
    "how-to-record-dj-mix.html": "mixer-hero.jpg",
    "best-online-dj-courses.html": "mixer-hero.jpg",
    "dj-equipment-checklist.html": "mobile-dj-hero.jpg",
    "how-to-become-a-dj.html": "pexels-dj-console-portrait-20116408.jpg",
    "dj-laptop-setup-guide.html": "pexels-dj-laptop-mixing-17858169.jpg",
    "dj-software-hub.html": "pexels-dj-nightclub-booth-4062561.jpg",
    "midi-controllers-for-music-production.html": "pexels-music-production-workstation-27495246.jpg",
}

# Intrinsic pixel dimensions per photograph (kept honest so the browser
# reserves the right aspect box before load).
DIMS = {
    "booth-wide.jpg": (1584, 672),
    "controller-macro.jpg": (1408, 768),
    "gear-flatlay.jpg": (1408, 768),
    "headphones-hero.jpg": (1408, 768),
    "hero-breakdown.jpg": (1408, 768),
    "hero-gig-small.jpg": (1408, 768),
    "hero-wedding.jpg": (1408, 768),
    "mixer-hero.jpg": (1408, 768),
    "mobile-dj-hero.jpg": (1376, 768),
    "pexels-dj-console-portrait-20116408.jpg": (1400, 2100),
    "pexels-mixer-knobs-744318.jpg": (1400, 930),
    "production-hero.jpg": (1408, 768),
    "skills-hero.jpg": (1408, 768),
    "software-desk.jpg": (1408, 768),
    "vinyl-hero.jpg": (1408, 768),
    "wikimedia-stylus-cartridge-detail.jpg": (1600, 640),
    "pexels-dj-laptop-mixing-17858169.jpg": (1200, 750),
    "pexels-dj-nightclub-booth-4062561.jpg": (1200, 750),
    "pexels-music-production-workstation-27495246.jpg": (1200, 750),
}

# Pages whose figcaption must change with the photo (photographer
# attribution travels with the credited photograph).
CAPTIONS = {
    "dj-equipment-checklist.html": (
        '<figcaption class="img-attribution">Photograph by <a href="https://www.pexels.com/@foerder-zone-441814813/" target="_blank" rel="noopener">FOERDER ZONE</a> on Pexels. The setup is illustrative, not a specific recommended rig.</figcaption>',
        "<figcaption>Illustrative Offbeat visual of a mobile DJ setup; not a specific recommended rig.</figcaption>",
    ),
    "how-to-become-a-dj.html": (
        "<figcaption>Illustrative Offbeat visual; the scene is representative, not a specific DJ, venue or booking.</figcaption>",
        '<figcaption class="img-attribution">Photograph by <a href="https://www.pexels.com/@foerder-zone-441814813/" target="_blank" rel="noopener">FOERDER ZONE</a> on Pexels. The DJ pictured is illustrative, not a specific person, venue or booking.</figcaption>',
    ),
    "dj-laptop-setup-guide.html": (
        "<figcaption>Offbeat editorial photography. Illustrative image, not a photo of the specific product.</figcaption>",
        '<figcaption class="img-attribution">Photograph by <a href="https://www.pexels.com/photo/dj-using-sound-mixer-and-laptop-17858169/" target="_blank" rel="noopener">Oliver Morgan Media</a> on Pexels. Illustrative laptop DJ setup; not an endorsement of a specific laptop brand.</figcaption>',
    ),
    "dj-software-hub.html": (
        "<figcaption>Offbeat editorial photography. Illustrative image, not a photo of a specific product.</figcaption>",
        '<figcaption class="img-attribution">Photograph by <a href="https://www.pexels.com/photo/dj-with-mixer-controller-in-night-club-4062561/" target="_blank" rel="noopener">Erik Mclean</a> on Pexels. Illustrative live performance booth; not an endorsement of a single software platform.</figcaption>',
    ),
    "midi-controllers-for-music-production.html": (
        "<figcaption>Offbeat editorial photography. Illustrative image, not a photo of the specific product.</figcaption>",
        '<figcaption class="img-attribution">Photograph by <a href="https://www.pexels.com/photo/a-laptop-and-a-mixer-on-a-table-27495246/" target="_blank" rel="noopener">Giuseppe Di Maria</a> on Pexels. Illustrative home studio setup; not a specific recommended hardware bundle.</figcaption>',
    ),
}

IMG_RE = re.compile(r'<figure class="hero-figure"><img[^>]*>')


def set_attr(tag, name, value):
    if re.search(rf'\b{name}="[^"]*"', tag):
        return re.sub(rf'\b{name}="[^"]*"', f'{name}="{value}"', tag, count=1)
    return tag.replace("<img", f'<img {name}="{value}"', 1)


def main():
    dry = "--dry-run" in sys.argv
    changed = []
    for page, photo in sorted(ASSIGN.items()):
        path = ROOT / page
        html = path.read_text(encoding="utf-8")
        before = html
        m = IMG_RE.search(html)
        if not m:
            print(f"!! {page}: no hero-figure img found")
            continue
        tag = m.group(0)
        w, h = DIMS[photo]
        new_tag = set_attr(tag, "src", E + photo)
        new_tag = set_attr(new_tag, "alt", ALT[photo])
        new_tag = set_attr(new_tag, "width", str(w))
        new_tag = set_attr(new_tag, "height", str(h))
        html = html.replace(tag, new_tag, 1)
        if page in CAPTIONS:
            old_cap, new_cap = CAPTIONS[page]
            if old_cap in html:
                html = html.replace(old_cap, new_cap, 1)
            elif new_cap not in html:
                print(f"!! {page}: expected figcaption not found")
        if html != before:
            changed.append(page)
            if not dry:
                path.write_text(html, encoding="utf-8")

    # Second pass: canonical alt + dimensions on every editorial hero,
    # whatever photo it uses (alt drift accumulated over page edits).
    normalized = []
    for path in sorted(ROOT.glob("*.html")):
        html = path.read_text(encoding="utf-8")
        before = html
        m = IMG_RE.search(html)
        if not m:
            continue
        tag = m.group(0)
        src_m = re.search(r'src="([^"]+)"', tag)
        if not src_m:
            continue
        photo = src_m.group(1).split("/")[-1]
        if photo not in ALT:
            continue  # product photo / schematic / external image
        w, h = DIMS[photo]
        new_tag = set_attr(tag, "alt", ALT[photo])
        new_tag = set_attr(new_tag, "width", str(w))
        new_tag = set_attr(new_tag, "height", str(h))
        html = html.replace(tag, new_tag, 1)
        if html != before:
            normalized.append(path.name)
            if not dry:
                path.write_text(html, encoding="utf-8")

    for page in changed:
        print("reassigned:", page)
    for page in normalized:
        print("alt/dims normalized:", page)
    print(f"{len(changed)} reassigned, {len(normalized)} normalized"
          f" {'(dry run)' if dry else ''}")


if __name__ == "__main__":
    main()
