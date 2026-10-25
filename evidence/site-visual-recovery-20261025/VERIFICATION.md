# Site visual recovery — verification (2026-10-25)

Branch: `arena/7ba83faf-offbeat-website` (base: fork `main` = upstream `main` = `bad6e15`).

## What the screenshots show
- `cmp-disclosure-desktop.png` / `cmp-disclosure-mobile.png` — top: `main` before; bottom: after. The generic "Offbeat Inc. DJ guide illustration card" was a duplicated hero figure (two copies on this page). It is removed; the policy page now opens on its text.
- `cmp-contact-desktop.png` — generic card hero removed; text hero stands alone.
- `before-/after-controllers-table-desktop.png` — "Verify current price" cells replaced with dated approximate US price ranges and a price note; DDJ-800 flagged as discontinued by several sellers.

## Method
- Local static server of the branch and a `git archive` of `main`, rendered with headless Chromium (Playwright-core) at 1440px and 390px widths.
- Link/src check: 0 broken local references before and after.
- Every page: exactly one `<head>` (checked), favicon link present (`assets/favicon.svg`).

## Known limits (be explicit)
- The sandbox cannot reach external hosts (images.unsplash.com, assets.alphatheta.com, support.serato.com, etc.). Pages whose hero is a hotlinked photo therefore render without it here. On the live site, those photos should load; the change only removes the figure **if the external image fails**, instead of substituting a generic card. Live pixels were not verified from this sandbox.
- Emoji glyphs render as boxes in the sandbox (no emoji font) — not a site defect.
- Prices are approximate US retail values from retailer/manufacturer listings seen in an October 2026 search. They are ranges, not quotes, and need independent verification before merge.
