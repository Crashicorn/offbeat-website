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

## Round 2 (owner review, 2026-10-25)
- Flagship `best-dj-controllers-2026.html`: DDJ-800 and MC7000 removed from primary picks and moved to a dated "Discontinued models we no longer recommend" note; DDJ-FLX10 added as the sold-new 4-channel pick (about $1,729, launch SRP $1,599); DJ-707M price changed to a sourced range ($1,133–$1,140 retail; $999 launch, 2019); Party Mix II price changed to about $129 with the note that Numark's page shows no price; Hercules corrected to list $349.99 with retailers about $299.99 (the earlier "$299.99 on Oct 12, 2026 official store" claim is not supported).
- Flagship hero: DDJ-FLX4 photo by Solomon203 (Wikimedia Commons, CC BY-SA 4.0), hotlinked from the stable Commons thumbnail with attribution. The sandbox cannot reach upload.wikimedia.org, so the image was NOT rendered or visually verified here; its `onerror` removes the figure rather than showing a placeholder.
- Copy fixes: "six controllers" → "five"; "Updated June 2026" → "Updated October 2026" on this page only.
- Link check (local href/src): 0 broken. JSON-LD on the flagship parses.
- Laptop page: six "Verify current price and exact model" cells remain. NOT fixed in this round (no dated laptop price sources gathered).
- Mobile: the flagship and homepage tables sit in horizontally scrolling wrappers by design (min-width 560px); the document does not scroll sideways.
- Evidence added: flagship-top-desktop-round2.png (text-first hero as rendered in the sandbox).
