# Mix Lab — beatmatching trainer rebuild (October 2026)

`beatmatch-trainer.html` was a single 45-second scored drill with a rotating
scoreboard on top. It worked, but it asked a beginner to fix tempo and phase at
the same time, told them a percentage instead of what to do, and sounded like a
metronome with a bass note rather than like two records.

This rebuild replaces the engine and the page around it with a **four-lesson
lab** that runs in the order a working DJ actually mixes, and then takes the
training wheels off.

## What changed, in the order a visitor meets it

| Before (`da7b3cf` / `99fd8a2`) | After |
| --- | --- |
| One drill, two modes (guided practice / 45-second timed) | **Four lessons** — tempo, phase, both, then blind — plus **free practice** |
| Ear demos sat in a separate block above the tool with different styling | The ear check is the **first thing inside the lab**: locked / late / early, played on the real decks |
| Two loops deliberately in **different keys** (A minor vs B♭ minor) | Both loops in **A minor, same 4-bar progression**, different drum machines, so a correct blend is consonant and a wrong one flams |
| Drums only: kick, hat, snare, a synth bass note | Full musical loop: kick, hats, snare, bass, **four-chord pad**, plus a Deck B pluck that only swells in when the lock is held |
| One long coach banner that restated the same three steps | A **coach that changes with the situation**, one instruction at a time, and a "step 2" that only appears once step 1 is done |
| Score = % of 45 s locked; result = grade ("TRAINWRECK" / "CLUB READY 🔥") | **Per-lesson goals** (1.5 s tempo hold, 1 s phase, 8 s blend), then a result card with what you actually fixed and the next lesson |
| Nudge jumped the playhead, so a nudge could click | Nudge is a **jog**: the correction is applied over ~25 ms of audio clock, no jump, no click |
| No visual of *why* it sounds wrong | **Beat-grid canvas**: both decks' ticks, bar numbers, playhead, lock shading — and a ±18 ms window drawn on a ±250 ms meter |
| No mobile layout of its own | Reflows to a single column at 860 px; no horizontal overflow at 390 px |

The two decks now carry **phrase information** too (chord, bar 1–4 of the loop),
because phrasing is the next thing a beginner needs after the beatmatch — and it
gives the master deck something real to show.

## The lesson design

1. **Find the tempo.** Beats start aligned and drift apart. Deck B is 1.2–1.8 %
off speed. The nudge cannot help: the goal is a tempo hold (within 0.06 BPM for
1.5 s), and the coach says so.
2. **Line up the beats.** Tempo already correct, kicks 40–90 ms apart. Now the
   fader cannot help — only a jog or nudge. Goal: inside ±18 ms for 1 s.
3. **Hold the blend.** Both wrong, and the coach stops naming which. Goal: fix
   both and hold ±18 ms for eight seconds; Deck B's musical layer swells in as
   the hold progresses, so the reward is a mix rather than a number.

4. **Blind hold.** The same problem as lesson 3, but the meters and the beat
   grid are switched off until you finish: twelve seconds inside ±18 ms by ear
   alone. The result card reveals the numbers, plus how many nudges and fader
   moves it took.

Free practice removes the goals, the hints and the result card.

## Engineering notes

- `assets/mixlab.js` replaces `assets/beatmatch-trainer.js` (deleted). One IIFE,
  no dependencies, ~1,120 lines of JS + a scoped `assets/mixlab.css` module.
- Timing reads the **AudioContext clock**, never `setInterval`, and the UI reads
  the same clock, so the readouts cannot drift away from what you hear.
- Scheduling looks 140 ms ahead with a per-deck pumped beat cursor; positions are
  never wrapped, so bar numbers keep counting.
- Chords are a fixed Am7 · Fmaj7 · Cmaj7 · G6 loop; Deck B's layer is panned
  separately so **Split cue L/R** is meaningful between `var(--ml-deck-a)` and
  `var(--ml-deck-b)`.
- Exposes `window.__mixlab.metrics()` / `.setPitch()` / `.nudge()` / `.setLesson()`
  hooks so the browser test asserts on audio-clock state, not on DOM text.

## Verification

- `node tests/test_mixlab.js` → **all checks passed, 0 console errors**
  (four lessons offered, play/pause, fader clamp, lesson 1 solvable by pitch
  alone, result card + next-lesson routing, lesson 2 solvable by nudge alone,
  demo takeover and hand-back, blind mode hides then reveals the readouts and is
  solvable by ear, space-to-pause, no console noise).
- All three lessons were also driven to completion in a real browser session
  (`after-lesson-1-result.png`, `after-lesson-3-complete.png`) — lesson 1 in
  ~3.4 s of simulated practice, lesson 3 after an 8 s hold.
- `python3 tools/check_site.py` → `118 pages checked, no problems found`.
- `python3 tests/check_site_structure.py` → `118/118 pages passed`.
- No horizontal overflow at 390 × 844 (`scrollWidth === clientWidth === 390`).

## Screenshots in this folder

| File | What it shows |
| --- | --- |
| `before-trainer.png` | The old drill as it shipped: one mode strip, one score, no lesson structure |
| `after-hero.png` | New hero and intro above the lab |
| `after-lab-idle.png` | Four lessons, ear check, both decks, beat grid, meters, coach |
| `after-ear-demo-late.png` | Ear check playing the "Deck B late" flam |
| `after-lesson-1-result.png` | Lesson 1 solved by pitch alone, with the result card and next lesson |
| `after-lesson-3-running.png` | Lesson 3 with both tempo and phase wrong — the coach picks one job |
| `after-lesson-3-complete.png` | Eight-second blend held, phrase readout live |
| `after-blind-hold.png` | Lesson 4: meters and grid switched off, coach qualitative only |
| `after-blind-hold-complete.png` | The reveal: readouts back, nudges and fader moves counted |
| `after-mobile-lab.png` | 390 px layout, no horizontal overflow |
| `after-progress-resume.png` | Coming back later: finished lessons ticked, progress line, resumed at the next unfinished lesson |
| `after-page-full.png` | Whole page: lesson map table, real-gear notes, FAQ |

## Remaining gaps

- `assets/style.css` still carries the old trainer block (`.teacher-*`,
  `.scorecard*`, `.deck*`). Some of it is shared with the inline practice decks on
  `index.html` and the beatmatching guide, so it was left in place rather than
  deleted in bulk; the trainer-only selectors are now dead weight.
- Finished lessons are remembered (localStorage `offbeat.mixlab.done`): the strip
  ticks them off, a progress line names the next one, and a returning reader
  lands on the first unfinished lesson. There is no per-attempt history or
  streak yet, and no best-time record.
- The loops are synthesised, so there is no vinyl noise, no cue bleed and no
  monitoring latency — the two things the lab can never teach.
