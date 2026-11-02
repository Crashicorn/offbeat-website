#!/usr/bin/env python3
"""Normalise the primary navigation across every published page.

Three nav variants existed: 112 pages pointed "Tools" at
`all-dj-guides.html#tools`, an anchor that does not exist anywhere (so the
header link did nothing), one page used a different six-item nav, and five
pages carried a nine-item nav with "Rig planner / Trainer / Glossary".

The canonical nav is written once here and applied idempotently. "Tools" now
points at the tools hub page, which is a real destination.

Run:  python3 tools/unify_nav.py [--check]
"""
import glob
import re
import sys

NAV_LINKS = [
    ("beginner-dj-hub.html", "Start"),
    ("dj-controllers-hub.html", "Controllers"),
    ("dj-gear-hub.html", "Gear"),
    ("dj-software-hub.html", "Software"),
    ("dj-skills-performance-hub.html", "Skills"),
    ("dj-tools.html", "Tools"),
    ("all-dj-guides.html", "Explore"),
]

SEARCH_BUTTON = (
    '<button class="nav-search" type="button" data-search-open aria-label="Search guides">'
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">'
    '<circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.6"></circle>'
    '<path d="M10.6 10.6 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>'
    "</svg>Search<kbd>/</kbd></button>"
)

# Which nav item is the current page, when it is one of the seven.
CURRENT = {
    "beginner-dj-hub.html": "beginner-dj-hub.html",
    "dj-controllers-hub.html": "dj-controllers-hub.html",
    "dj-gear-hub.html": "dj-gear-hub.html",
    "dj-software-hub.html": "dj-software-hub.html",
    "dj-skills-performance-hub.html": "dj-skills-performance-hub.html",
    "dj-tools.html": "dj-tools.html",
    "all-dj-guides.html": "all-dj-guides.html",
}


def build_nav(page):
    current = CURRENT.get(page)
    links = []
    for href, label in NAV_LINKS:
        attr = ' aria-current="page"' if href == current else ""
        links.append('<a href="%s"%s>%s</a>' % (href, attr, label))
    return (
        '<nav aria-label="Primary navigation"><div class="nav-inner">\n'
        '<a class="nav-brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span>'
        '<span class="brand-word">Offbeat<em>.</em></span></a>\n'
        '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">'
        '<span class="nav-toggle-icon" aria-hidden="true"></span>Menu</button>\n'
        '<div class="nav-links" id="primary-nav">\n'
        + "\n".join(links)
        + "\n"
        + SEARCH_BUTTON
        + "\n</div>\n</div></nav>"
    )


def main():
    check_only = "--check" in sys.argv
    changed = []
    for path in sorted(glob.glob("*.html")):
        src = open(path, encoding="utf-8").read()
        new_nav = build_nav(path)
        pattern = re.compile(r'<nav aria-label="Primary navigation">.*?</nav>', re.S)
        match = pattern.search(src)
        if not match:
            print("NO NAV:", path)
            continue
        if match.group(0) == new_nav:
            continue
        changed.append(path)
        if not check_only:
            open(path, "w", encoding="utf-8").write(src[: match.start()] + new_nav + src[match.end():])
    print(("would update " if check_only else "updated ") + str(len(changed)) + " pages")
    for path in changed[:10]:
        print("  ", path)
    if check_only and changed:
        sys.exit(1)


if __name__ == "__main__":
    main()
