# Round 4 verification — interactive tools and comparison rewrites (October 2026)

Everything below was run against the local static build (`python3 -m http.server 8099`)
with headless Chromium 131 driven by `puppeteer-core`, at 1440 px desktop and 390 px
mobile unless noted. Screenshots in this folder are the output of those runs.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Page integrity (assets, links, metadata, JSON-LD) | `python3 tools/check_site.py` | 118 pages, no problems |
| Structural rules (nesting, heading order, ItemList) | `python3 tests/check_site_structure.py` | 118/118 pages passed |
| Analytics loader regression | `node tests/ga4-loader.test.js` | 17 passed, 0 failed |
| Search index freshness | `python3 tools/build_index.py` | 116 entries, trainer and glossary included |

## Beatmatching trainer (`beatmatch-trainer.html`)

* Audio: `AudioContext` reaches `running`; the scheduler queued 24 oscillator and 24
  noise events in the first 2.5 s, all with start times in the future (no
  `setValueAtTime` range errors — an earlier negative-time bug was fixed).
* Mechanics: playheads advance continuously (`posA 5.16`, `posB 4.95` beats after 2.5 s),
  so the phase read-out resolves to 1 ms instead of snapping to whole beats.
* Convergence: with the pitch fader matched, a simulated jog chase moved the offset
  `62 → 57 → 55 → 49 → … → 5 ms` and held there; status switched to
  "Kicks are landing together", the drift pip turned mint and the lock score climbed to 81%.
* Difficulty spread: `easy` starts at +58 ms and 122.90 BPM, `hard` at +203 ms and
  121.47 BPM against a fixed 124 BPM master.
* Inputs: keyboard pitch (four `ArrowUp` presses moved 0.00% → 0.20%), nudge keys, space
  to stop, and the hide-readouts toggle all respond; 0 page errors in every run.
* Layout: desktop 5,926 px tall / mobile 7,737 px; horizontal overflow 0; no broken images.

## Site-wide wiring

* Trainer appears in the primary nav on 116 pages, the Skills footer column on 118 pages,
  the sitemap, the search index and the homepage "What changed this month" strip.
* Nav width sweep at 901, 960, 1024, 1181, 1280 and 1440 px: no horizontal overflow after
  the 901–1180 px compact rule was added (1024 px previously overflowed to 1,055 px scroll width).
* Footer: six link groups now sit on one row at ≥1120 px instead of wrapping into a ragged
  second row; three-column layout between 720 and 1119 px.

## Glossary (`dj-glossary.html`)

73 terms across five categories, `#term-<slug>` anchors, letter chips and keyword filter.
Typing "latency" returns one term, the "X" letter chip returns one term, 0 JS errors.

## Rewritten comparisons

Word counts measured on the rendered `<main>` text; every page re-checked for overflow,
broken images, duplicated `<main>`, and JSON-LD/visible-heading agreement.

| Page | Before | After |
| --- | --- | --- |
| `controller-buying-journey.html` | 631 | ~2,000 |
| `distrokid-vs-tunecore.html` | 751 | ~1,970 |
| `soundcloud-vs-bandcamp.html` | 721 | ~1,770 |
| `landr-vs-splice.html` | 767 | ~1,620 |

Prices in the distribution and production comparisons were read from the vendors' own
pricing and help pages in October 2026 (DistroKid, TuneCore, SoundCloud, Bandcamp, Splice,
LANDR) rather than from other affiliate round-ups, and each page states the month checked
and links the source page.

## Not verified

* Audio **timbre and feel** — a headless browser proves the notes are scheduled and the
  clock is correct; it cannot judge whether the loop sounds good or whether the nudge feels
  like a jog wheel. That needs a human on real speakers and, ideally, an iOS Safari pass.
* Real touch input on a phone (pointer events were simulated, not finger-driven).
* Screen-reader output beyond structural checks (0 unlabelled controls, 0 missing `alt`,
  no heading-level jumps on sampled pages).
* Print output on paper; the checklist was validated as a single A4 page in Chromium's
  print emulation only.
* Price accuracy after October 2026. All vendor figures carry the month they were checked
  and a "confirm before you pay" note.
