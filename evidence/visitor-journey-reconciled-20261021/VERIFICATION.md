# Verification — reconciled visitor-journey packet (20261021, overnight run 1)

Isolated draft work of an unattended cross-project overnight round (stock OpenCode/Qwen).
Base: protected `main` @ `50b35fa6e43e12a619b1e2f513915bf6026b8f5f` (fetched 2026-10-20, post-#936/#937).
**NOT merged, NOT deployed.**

## Scope — what this packet is

This is the reconciliation of DRAFT PR #920's still-valid components onto the current protected
main, with every already-shipped component removed:

| Component | Origin value | Status on main@50b35fa before this PR | This PR |
|---|---|---|---|
| Page-specific share images (101 pages) | #890 (component of #920) | `og:image`/`twitter:image` = generic `assets/og-default.jpg` on all 101 pages | **Applied** — each page → its own existing `assets/img/page-visuals/<page>.png` (all 101 binaries already on main) |
| Orphaned buyer-hub navigation cards (2 hubs) | #883 / #901 (components of #920) | `dj-skills-performance-hub.html` had **0** refs to `best-online-dj-courses.html`; `music-production.html` had **0** refs to `music-production-tools.html` (both buyer pages otherwise only index-reachable, re-proven on this base 20261021) | **Applied** — one house-pattern `ofb-card` per hub, exact card copy of #883 |
| Hero caption accuracy (7 pages) | #888 (component of #920) | all 7 page heroes render the **local** `assets/img/page-visuals/<page>.png` but credit a named external photographer whose URL is inert `data-original-src` | **Applied** — 7 hero figcaptions → truthful `Illustration by Offbeat Inc.` (house pattern of #783/#887) |
| Guide-directory descriptions (19 labels) | #902 (component of #920) | **Already shipped**: merged #922 (2026-10-19) carried identical/reader-facing descriptions on all 19 cards (18 byte-identical to #902's text, 1 alternative wording) | **Excluded** — superseded |
| Dead-hero image fixes (4+2 pages) | #775/#783 (components of #920) | **Already shipped**: #937 (2026-10-20) + #936 imagery adoption | **Excluded** — superseded, #775/#783 CLOSED |

## Change inventory

- 101 HTML files changed, **175 insertions / 175 deletions**, nothing else:
  - 101 × (`og:image` meta value) + 101 × (`twitter:image` meta value) → per-page `page-visuals/<page>.png`
  - 2 × navigation card insertions (`dj-skills-performance-hub.html`, `music-production.html`)
  - 7 × hero figcaption text corrections (the 7 pages above)
- Zero new binaries, zero new third-party assets, zero wording/content changes outside the 7 captions,
  zero CSS/JS/workflow changes, `sitemap.xml` untouched, no affiliate-link changes.
- No affiliate tracking/fabrication: no new `tag=` params, no new merchant URLs, no GA changes.

## Verification (this branch, local HTTP server + Playwright Chromium, 20261021)

1. **Static (per-file, assertion-guarded applier):** all 101 `og:image`+`twitter:image` pairs point at
   `page-visuals/<basename>.png`; all 101 referenced PNGs exist in-tree; 7/7 hero figcaptions now
   `Illustration by Offbeat Inc.` with hero `src` verified local per page; 2/2 hub cards present exactly once
   with no pre-existing reference to either target. `git diff --check` clean.
2. **Asset sweep (full scope):** 101 distinct page-visual URLs referenced by the changed heads → **101/101 present locally** (would serve 200), 0 missing.
3. **Browser (Playwright, desktop 1360×900 + mobile 390×844):** 14/14 pages (both hubs, all 7 caption pages,
   5 representative og pages incl. `index.html`, `about.html`, `404.html`) → **HTTP 200, 0 console/page errors,
   0 failed requests (≥400)**; `og:image`/`twitter:image` DOM values exact per page; both hub cards
   **visible** (bounding boxes recorded) and **pointer click-through landed on** `best-online-dj-courses.html`
   and `music-production-tools.html` respectively; card screenshots `shots/` (desktop + mobile).
4. **html-validate 9.0.0 (8 changed files + `all-dj-guides.html`):** base vs branch = **51 → 51 problems,
   zero delta** (only pre-existing house patterns `wcag/h63` `<th>` scope and `void-style` self-closing metas).
5. Base-absence re-proven on this exact base: both orphaned targets had zero inbound hub refs before this PR
   (grep count 0 on `main@50b35fa` before applying).

## Supersession / dedupe notes for the queue

- #890, #883, #888, #901 all carry value fully contained in this packet (their #775/#783/#902 slivers are
  already on main). If the owner merges this PR, **close #890, #883, #888, #901, #902 and the stale bundle
  #920** rather than merging any of them — their heads trail the 2026-10-19/20 content merges and some
  (#901) would revert shipped fixes if merged as-is.
- Not touched (owner/owner-lane or separate drafts): #886 planner restore, #891 favicon, #892 ratings,
  #893 org-schema, #765 GA4, #766 disclosure, #923–#928 TDQ copy drafts.

## Reproduction

```
python3 -m http.server 8137 --bind 127.0.0.1   # in this branch root
npx --yes html-validate@9.0.0 <changed files>  # base vs branch: 51 = 51
```

Applier (deterministic, assertion-guarded) kept in-session; the applied diff itself is the artifact
(175/175 lines). No merge, no Pages deploy, no production change.
