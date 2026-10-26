# Headphone guide fit selector — visual verification

Second, article-specific milestone after the controller selection-path update. Baseline: pushed checkpoint `85019a3`; the headphone article itself was unchanged there.

## Evidence

- `before/headphones-1440.png` and `before/headphones-390.png` show the existing guide before this work.
- `after/headphones-1440.png` and `after/headphones-390.png` show the page-specific “Find your fit” hero action.
- `after/fit-1440.png` and `after/fit-390.png` show the three-use-case chooser and the active match.

## Browser checks

- Rendered at 1440 px and 390 px; no horizontal overflow or browser page errors. The existing credited editorial hero image remains unchanged.
- The radios work with both pointer and arrow-key input. Home/studio practice selects the Sony MDR-7506; the premium option selects the Pioneer HDJ-X10; each result links to its own detailed verdict.
- The six-model comparison remains available in a native disclosure with six accessible row headers and six column headers. The table is not removed or replaced by the shortcut.
- The model verdict anchors resolve below the sticky header; the user can still browse the complete comparison and retailer notes without using the selector.
