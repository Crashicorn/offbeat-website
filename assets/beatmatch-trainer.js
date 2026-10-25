/* Offbeat — browser beatmatching trainer.
 *
 * Two synthesised "records" are played together: deck A is the master and never
 * moves, deck B starts at a random offset with a slightly wrong tempo. Your job
 * is the real one — match the tempo with the pitch fader, then line the kicks up
 * with nudges — and the trainer keeps score.
 *
 * Includes:
 * - Web Audio synthesized drum machine & bass synth with stereo split-cueing
 * - Interactive rotating vinyl/CDJ jog platters with drag-to-nudge
 * - Dual-lane real-time beat phase meter with target alignment playhead
 * - "Hear the difference" audio ear-training demos (Locked vs Dragging vs Rushing)
 * - Cue-to-beat-one drop functionality
 * - Per-difficulty personal bests & streak tracking in localStorage
 * - Copyable score cards & actionable coaching verdicts
 */
(function () {
  "use strict";

  var root = document.getElementById("trainer");
  if (!root) return;

  var el = {
    start: root.querySelector("[data-start]"),
    stop: root.querySelector("[data-stop]"),
    stage: root.querySelector("[data-stage]"),
    clock: root.querySelector("[data-clock]"),
    score: root.querySelector("[data-score]"),
    verdict: root.querySelector("[data-verdict]"),
    best: root.querySelector("[data-best]"),
    pitch: root.querySelector("[data-pitch]"),
    pitchValue: root.querySelector("[data-pitch-value]"),
    bpmA: root.querySelector("[data-bpm-a]"),
    bpmB: root.querySelector("[data-bpm-b]"),
    drift: root.querySelector("[data-drift]"),
    driftBar: root.querySelector("[data-drift-bar]"),
    driftReadout: root.querySelector(".readout--drift"),
    status: root.querySelector("[data-lock-status]"),
    nudgeBack: root.querySelector("[data-nudge-back]"),
    nudgeFwd: root.querySelector("[data-nudge-fwd]"),
    hide: root.querySelector("[data-hide]"),
    reset: root.querySelector("[data-reset]"),
    difficulty: root.querySelector("[data-difficulty]"),
    liveA: root.querySelector("[data-live-a]"),
    liveB: root.querySelector("[data-live-b]"),
    platterA: root.querySelector("[data-platter-a]"),
    platterB: root.querySelector("[data-platter-b]"),
    cueBtn: root.querySelector("[data-cue]"),
    splitCueBtn: root.querySelector("[data-split-cue]"),
    soloABtn: root.querySelector("[data-solo-a]"),
    soloBBtn: root.querySelector("[data-solo-b]"),
    phaseTracker: root.querySelector("[data-phase-tracker]"),
    phaseLaneA: root.querySelector("[data-phase-lane-a]"),
    phaseLaneB: root.querySelector("[data-phase-lane-b]"),
    scorecard: root.querySelector("[data-scorecard]"),
    scorecardClose: root.querySelector("[data-scorecard-close]"),
    scorecardRetry: root.querySelector("[data-scorecard-retry]"),
    scorecardCopy: root.querySelector("[data-scorecard-copy]"),
    demoLocked: document.querySelector("[data-demo='locked']"),
    demoDragging: document.querySelector("[data-demo='dragging']"),
    demoRushing: document.querySelector("[data-demo='rushing']")
  };

  var MASTER_BPM = 124;
  var DRILL = 45; // seconds per attempt

  var state = {
    running: false,
    bpmA: MASTER_BPM,
    ctx: null,
    startTime: 0,
    endsAt: 0,
    bpmB: MASTER_BPM,
    pitch: 0,          // percent, -8..+8 around the random start
    baseBpm: MASTER_BPM,
    posA: 0,           // playhead of each deck, in beats
    posB: 0,
    lastAudio: 0,      // AudioContext time of the previous clock advance
    scheduledA: -1,    // index of the last beat handed to the audio scheduler
    scheduledB: -1,
    beatA: 0,
    beatB: 0,
    nudge: 0,          // -1 slowing, 0 free, +1 pushing
    lockedMs: 0,
    totalMs: 0,
    currentLockStreakMs: 0,
    maxLockStreakMs: 0,
    driftSamples: [],
    lastFrame: 0,
    locked: false,
    splitCue: false,
    soloA: false,
    soloB: false,
    raf: null,
    ticker: null,
    rotA: 0,
    rotB: 0,
    demoTimer: null
  };

  var audio = {
    master: null,
    chanA: null,
    chanB: null,
    pannerA: null,
    pannerB: null,
    noise: null
  };

  /* ------------------------------------------------------------------ audio */
  function noiseBuffer(ctx, seconds) {
    var length = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function ensureAudioCtx() {
    if (state.ctx) return state.ctx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();
    state.ctx = ctx;

    var master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    audio.master = master;
    audio.noise = noiseBuffer(ctx, 0.5);

    var chanA = ctx.createGain();
    var chanB = ctx.createGain();
    chanA.gain.value = 0.85;
    chanB.gain.value = 0.85;

    if (ctx.createStereoPanner) {
      audio.pannerA = ctx.createStereoPanner();
      audio.pannerB = ctx.createStereoPanner();
      audio.pannerA.pan.value = 0;
      audio.pannerB.pan.value = 0;
      chanA.connect(audio.pannerA).connect(master);
      chanB.connect(audio.pannerB).connect(master);
    } else {
      chanA.connect(master);
      chanB.connect(master);
    }

    audio.chanA = chanA;
    audio.chanB = chanB;
    return ctx;
  }

  function applyAudioRouting() {
    if (!audio.chanA || !audio.chanB) return;
    // Solo / Mute handling
    if (state.soloA) {
      audio.chanA.gain.value = 0.85;
      audio.chanB.gain.value = 0;
    } else if (state.soloB) {
      audio.chanA.gain.value = 0;
      audio.chanB.gain.value = 0.85;
    } else {
      audio.chanA.gain.value = 0.85;
      audio.chanB.gain.value = 0.85;
    }

    // Split cue panning
    if (audio.pannerA && audio.pannerB) {
      if (state.splitCue) {
        audio.pannerA.pan.setValueAtTime(-0.85, state.ctx.currentTime);
        audio.pannerB.pan.setValueAtTime(0.85, state.ctx.currentTime);
      } else {
        audio.pannerA.pan.setValueAtTime(0, state.ctx.currentTime);
        audio.pannerB.pan.setValueAtTime(0, state.ctx.currentTime);
      }
    }
  }

  function kick(ctx, when, gainValue, out) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(155, when);
    osc.frequency.exponentialRampToValueAtTime(46, when + 0.11);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + 0.3);
  }

  function noiseHit(ctx, when, out, options) {
    if (!audio.noise) return;
    var src = ctx.createBufferSource();
    src.buffer = audio.noise;
    var filter = ctx.createBiquadFilter();
    filter.type = options.type || "highpass";
    filter.frequency.value = options.frequency || 6000;
    var gain = ctx.createGain();
    var peak = options.gain || 0.12;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (options.decay || 0.06));
    src.connect(filter).connect(gain).connect(out);
    src.start(when);
    src.stop(when + (options.decay || 0.06) + 0.02);
  }

  function hat(ctx, when, out) {
    noiseHit(ctx, when, out, { type: "highpass", frequency: 8000, gain: 0.048, decay: 0.035 });
  }

  function snare(ctx, when, out) {
    noiseHit(ctx, when, out, { type: "bandpass", frequency: 1800, gain: 0.14, decay: 0.13 });
  }

  function bassNote(ctx, when, out, freq) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.055, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + 0.24);
  }

  /* Each deck sounds slightly different so they are easy to tell apart */
  function scheduleBeat(deck, when, bpm) {
    bpm = bpm || (deck === "a" ? state.bpmA : currentBpmB());
    var beat = deck === "a" ? state.beatA : state.beatB;
    var out = deck === "a" ? audio.chanA : audio.chanB;
    var position = ((beat % 4) + 4) % 4;

    if (deck === "a") {
      kick(state.ctx, when, 0.65, out);
      if (position === 1 || position === 3) snare(state.ctx, when, out);
      hat(state.ctx, when + 60 / bpm / 2, out);
      bassNote(state.ctx, when + 0.02, out, position % 2 === 0 ? 55 : 65.4);
    } else {
      kick(state.ctx, when, 0.58, out);
      if (position === 1 || position === 3) snare(state.ctx, when, out);
      hat(state.ctx, when + 60 / bpm / 2, out);
      hat(state.ctx, when + (60 / bpm) * 0.75, out);
      bassNote(state.ctx, when + 0.02, out, position % 2 === 0 ? 61.7 : 73.4);
    }
  }

  /* ------------------------------------------------------------- scheduling */
  function advanceClock() {
    var t = state.ctx.currentTime;
    var dt = t - state.lastAudio;
    if (dt > 0 && dt < 1) {
      state.posA += (dt * state.bpmA) / 60;
      state.posB += (dt * currentBpmB()) / 60;
    }
    if (dt > 0) state.lastAudio = t;
    return t;
  }

  function pumpDeck(deck, t, horizon, bpm) {
    var pos = deck === "a" ? state.posA : state.posB;
    var last = deck === "a" ? state.scheduledA : state.scheduledB;
    var period = 60 / bpm;
    var index = Math.ceil(pos);
    if (index <= last) index = last + 1;
    var when = t + (index - pos) * period;
    var guard = 0;

    while (when < horizon && guard < 8) {
      if (deck === "a") state.beatA = index;
      else state.beatB = index;
      scheduleBeat(deck, when, bpm);
      if (deck === "a") state.scheduledA = index;
      else state.scheduledB = index;
      index += 1;
      when += period;
      guard += 1;
    }
  }

  function scheduler() {
    if (!state.running) return;
    var t = advanceClock();
    var horizon = t + 0.16;
    pumpDeck("a", t, horizon, state.bpmA);
    pumpDeck("b", t, horizon, currentBpmB());
  }

  function currentBpmB() {
    var base = state.bpmB;
    if (state.nudge === -1) base *= 0.88;
    if (state.nudge === 1) base *= 1.13;
    return base;
  }

  function phaseMs() {
    if (!state.running) return 0;
    var beats = state.posA - state.posB;
    beats -= Math.round(beats);
    return beats * (60000 / state.bpmA);
  }

  /* -------------------------------------------------------------------- UI */
  function fmt(n, digits) {
    return n.toFixed(digits === undefined ? 1 : digits);
  }

  function setPitch(percent) {
    state.pitch = Math.max(-8, Math.min(8, percent));
    state.bpmB = state.baseBpm * (1 + state.pitch / 100);
    if (el.pitch) el.pitch.value = String(state.pitch);
    if (el.pitchValue) el.pitchValue.textContent = (state.pitch > 0 ? "+" : "") + fmt(state.pitch, 2) + "%";
    if (el.bpmB) el.bpmB.textContent = fmt(state.bpmB, 2);
  }

  var BEST_KEY = "offbeat.beatmatch.best";

  function bestScores() {
    try {
      var raw = window.localStorage.getItem(BEST_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function difficultyKey() {
    return el.difficulty ? el.difficulty.value : "steady";
  }

  function showBest() {
    if (!el.best) return;
    var value = bestScores()[difficultyKey()];
    if (typeof value === "number") {
      el.best.textContent = "Personal best on " + difficultyKey() + ": " + value + "%";
      el.best.hidden = false;
      el.best.setAttribute("data-personal-best", String(value));
    } else {
      el.best.textContent = "No score on " + difficultyKey() + " yet. Drill to set your high score.";
      el.best.hidden = false;
      el.best.removeAttribute("data-personal-best");
    }
  }

  function recordBest(pct) {
    var scores = bestScores();
    var key = difficultyKey();
    var previous = typeof scores[key] === "number" ? scores[key] : -1;
    if (pct > previous) {
      scores[key] = pct;
      try {
        window.localStorage.setItem(BEST_KEY, JSON.stringify(scores));
      } catch (error) {
        /* private mode */
      }
      showBest();
      return true;
    }
    showBest();
    return false;
  }

  function resetScore() {
    state.lockedMs = 0;
    state.totalMs = 0;
    state.currentLockStreakMs = 0;
    state.maxLockStreakMs = 0;
    state.driftSamples = [];
    if (el.score) el.score.textContent = "0%";
    if (el.clock) el.clock.textContent = DRILL + "s";
    if (el.verdict) {
      el.verdict.textContent = "";
      el.verdict.removeAttribute("data-grade");
    }
    if (el.scorecard) el.scorecard.hidden = true;
  }

  function randomiseStart() {
    var skill = el.difficulty ? el.difficulty.value : "steady";
    var spread = skill === "easy" ? 0.9 : skill === "hard" ? 3.2 : 1.8;
    var sign = Math.random() < 0.5 ? -1 : 1;
    state.baseBpm = MASTER_BPM * (1 + (sign * spread * (0.5 + Math.random() * 0.5)) / 100);
    state.phaseStart = skill === "easy" ? 0.14 : skill === "hard" ? 0.44 : 0.28;
    setPitch(0);
  }

  function cueDeckB() {
    if (!state.running) return;
    // Align Deck B's next beat exactly with Deck A's next beat 1 (downbeat)
    var currentA = state.posA;
    var nextDownbeatA = Math.ceil(currentA / 4) * 4;
    var offsetToBeats = nextDownbeatA - currentA;
    state.posB = -offsetToBeats;
    state.scheduledB = Math.floor(state.posB);
    if (el.status) el.status.textContent = "Cued! Deck B dropped on the downbeat.";
  }

  function start() {
    if (state.running) return;
    stopAudioDemo();
    var ctx = ensureAudioCtx();
    if (!ctx) {
      if (el.status) el.status.textContent = "AudioContext not supported in this browser.";
      return;
    }
    if (ctx.state === "suspended") ctx.resume();
    applyAudioRouting();

    randomiseStart();
    state.posA = 0;
    state.posB = -state.phaseStart;
    state.lastAudio = ctx.currentTime;
    state.scheduledA = -1;
    state.scheduledB = -1;
    state.beatA = 0;
    state.beatB = 0;
    state.nudge = 0;
    state.running = true;
    state.startTime = performance.now();
    state.endsAt = state.startTime + DRILL * 1000;
    state.lastFrame = state.startTime;
    resetScore();

    if (el.stage) el.stage.classList.add("is-running");
    if (el.start) el.start.disabled = true;
    if (el.stop) el.stop.disabled = false;
    if (el.status) el.status.textContent = "Deck B is live. Match tempo with pitch fader, then nudge phase.";

    state.ticker = window.setInterval(function () {
      try { scheduler(); } catch (error) { /* safe */ }
    }, 25);
    try { scheduler(); } catch (error) { /* safe */ }
    frame();
  }

  function stop(reason) {
    if (!state.running) return;
    state.running = false;
    window.clearInterval(state.ticker);
    window.cancelAnimationFrame(state.raf);
    if (el.stage) el.stage.classList.remove("is-running");
    if (el.start) el.start.disabled = false;
    if (el.stop) el.stop.disabled = true;
    if (el.driftBar) el.driftBar.style.setProperty("--offset", "0");
    if (el.status && reason === "manual") el.status.textContent = "Stopped. Press start for a fresh attempt.";
    if (reason === "done") finish();
  }

  function finish() {
    var pct = state.totalMs > 0 ? Math.round((state.lockedMs / state.totalMs) * 100) : 0;
    if (el.score) el.score.textContent = pct + "%";
    if (el.clock) el.clock.textContent = "0s";

    var isBest = recordBest(pct);
    var avgDrift = 0;
    if (state.driftSamples.length) {
      var sum = state.driftSamples.reduce(function (a, b) { return a + b; }, 0);
      avgDrift = Math.round(sum / state.driftSamples.length);
    }
    var maxStreakSec = (state.maxLockStreakMs / 1000).toFixed(1);

    var text = "";
    var grade = "";
    var tip = "";
    if (pct >= 85) {
      text = "Locked in! That is a mix you could take straight into a club.";
      grade = "great";
      tip = "Your ears and nudging are spot-on. Try turning on 'Hide readouts' to train purely by ear.";
    } else if (pct >= 65) {
      text = "Solid blend! You kept the groove locked through most of the drill.";
      grade = "good";
      tip = "Watch for small tempo drift after 10–15 seconds. Make pitch moves in tinier 0.05% nudges.";
    } else if (pct >= 40) {
      text = "Getting closer. The tempo was near, but phase kept slipping.";
      grade = "ok";
      tip = "Spend the first 15 seconds focusing exclusively on the pitch fader before touching the nudges.";
    } else {
      text = "Rough flam. Slow down: match pitch first, then give one deliberate nudge.";
      grade = "rough";
      tip = "Try the 'Easy' difficulty or use the Split Cue toggle (🎧) to isolate Deck A in your left ear.";
    }

    if (el.status) el.status.textContent = "Drill complete! Review your scorecard below.";
    if (el.verdict) {
      el.verdict.textContent = isBest ? text + " ★ New personal best!" : text;
      el.verdict.setAttribute("data-grade", grade);
    }

    // Render detailed scorecard
    if (el.scorecard) {
      var scoreVal = el.scorecard.querySelector("[data-score-val]");
      var scoreGrade = el.scorecard.querySelector("[data-score-grade]");
      var scoreDrift = el.scorecard.querySelector("[data-score-drift]");
      var scoreStreak = el.scorecard.querySelector("[data-score-streak]");
      var scoreTip = el.scorecard.querySelector("[data-score-tip]");

      if (scoreVal) scoreVal.textContent = pct + "%";
      if (scoreGrade) {
        scoreGrade.textContent = grade === "great" ? "MASTER BLEND" : grade === "good" ? "CLUB READY" : grade === "ok" ? "IN THE POCKET" : "NEEDS WORK";
        scoreGrade.className = "scorecard-badge scorecard-badge--" + grade;
      }
      if (scoreDrift) scoreDrift.textContent = (avgDrift > 0 ? "±" : "") + avgDrift + " ms";
      if (scoreStreak) scoreStreak.textContent = maxStreakSec + "s";
      if (scoreTip) scoreTip.textContent = tip;

      el.scorecard.hidden = false;
      el.scorecard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function frame() {
    if (!state.running) return;
    advanceClock();
    var now = performance.now();
    var dt = now - state.lastFrame;
    state.lastFrame = now;
    state.totalMs += dt;

    var diff = phaseMs();
    var absDiff = Math.abs(diff);
    state.locked = absDiff < 18;
    state.driftSamples.push(absDiff);

    if (state.locked) {
      state.lockedMs += dt;
      state.currentLockStreakMs += dt;
      if (state.currentLockStreakMs > state.maxLockStreakMs) {
        state.maxLockStreakMs = state.currentLockStreakMs;
      }
    } else {
      state.currentLockStreakMs = 0;
    }

    var remaining = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
    if (el.clock) el.clock.textContent = remaining + "s";
    if (el.drift) el.drift.textContent = (diff > 0 ? "+" : "") + Math.round(diff) + " ms";

    if (el.driftBar) {
      var clamped = Math.max(-160, Math.min(160, diff));
      el.driftBar.style.setProperty("--offset", String(clamped));
      el.driftBar.classList.toggle("is-locked", state.locked);
      if (el.driftReadout) el.driftReadout.classList.toggle("is-locked", state.locked);
    }

    if (el.score) {
      var currentScore = state.totalMs > 0 ? Math.round((state.lockedMs / state.totalMs) * 100) : 0;
      el.score.textContent = currentScore + "%";
    }

    if (el.status) {
      if (state.locked) {
        el.status.innerHTML = '<span class="status-badge status-badge--lock">LOCKED IN</span> Kicks landing together (<18ms). Hold your pitch steady!';
      } else if (absDiff < 55) {
        var direction = diff > 0 ? "push forward ▶" : "◀ nudge slow";
        el.status.innerHTML = '<span class="status-badge status-badge--close">CLOSE</span> Tap ' + direction + ' to align kicks.';
      } else {
        var hint = diff > 0 ? "Deck B is dragging behind" : "Deck B is rushing ahead";
        el.status.innerHTML = '<span class="status-badge status-badge--drift">DRIFTING</span> ' + hint + ' (' + Math.round(absDiff) + 'ms). Fix tempo first.';
      }
    }

    if (el.bpmA) el.bpmA.textContent = fmt(MASTER_BPM, 1);
    if (el.bpmB) el.bpmB.textContent = fmt(currentBpmB(), 2);

    // Waveform beat pulses
    var beatCycleA = Math.floor(state.posA * 2) % 2 === 0;
    var beatCycleB = Math.floor(state.posB * 2) % 2 === 0;
    if (el.liveA) el.liveA.classList.toggle("is-beat", beatCycleA);
    if (el.liveB) el.liveB.classList.toggle("is-beat", beatCycleB);

    // Rotating jog platters
    state.rotA = (state.posA * 90) % 360;
    state.rotB = (state.posB * 90) % 360;
    if (el.platterA) el.platterA.style.transform = "rotate(" + state.rotA.toFixed(1) + "deg)";
    if (el.platterB) el.platterB.style.transform = "rotate(" + state.rotB.toFixed(1) + "deg)";

    // Update dual phase meter visualization if available
    updatePhaseMeter(diff, state.locked);

    if (now >= state.endsAt) {
      stop("done");
      return;
    }
    state.raf = window.requestAnimationFrame(frame);
  }

  function updatePhaseMeter(diff, isLocked) {
    if (!el.phaseTracker) return;
    el.phaseTracker.classList.toggle("is-locked", isLocked);
    var offsetPx = Math.max(-120, Math.min(120, diff * 0.8));
    el.phaseTracker.style.setProperty("--phase-px", offsetPx + "px");
  }

  /* ------------------------------------------------------------- Audio Demos */
  function stopAudioDemo() {
    if (state.demoTimer) {
      window.clearTimeout(state.demoTimer);
      state.demoTimer = null;
    }
    [el.demoLocked, el.demoDragging, el.demoRushing].forEach(function (btn) {
      if (btn) btn.classList.remove("is-playing");
    });
  }

  function playAudioDemo(type, button) {
    stop("manual");
    stopAudioDemo();
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    button.classList.add("is-playing");
    var now = ctx.currentTime + 0.05;
    var bpm = 124;
    var period = 60 / bpm;
    var offsetSec = type === "locked" ? 0 : type === "dragging" ? 0.085 : -0.085;

    // Play 4 bars of demonstration
    for (var i = 0; i < 16; i++) {
      var tA = now + i * period;
      var tB = now + i * period + offsetSec;
      kick(ctx, tA, 0.6, audio.chanA);
      if (i % 2 === 1) snare(ctx, tA, audio.chanA);
      hat(ctx, tA + period / 2, audio.chanA);

      if (tB > ctx.currentTime) {
        kick(ctx, tB, 0.55, audio.chanB);
        if (i % 2 === 1) snare(ctx, tB, audio.chanB);
        hat(ctx, tB + period / 2, audio.chanB);
      }
    }

    state.demoTimer = window.setTimeout(function () {
      button.classList.remove("is-playing");
      state.demoTimer = null;
    }, 16 * period * 1000 + 400);
  }

  /* ---------------------------------------------------------------- inputs */
  if (el.start) el.start.addEventListener("click", start);
  if (el.stop) el.stop.addEventListener("click", function () { stop("manual"); });
  if (el.reset) el.reset.addEventListener("click", function () {
    stop("manual");
    resetScore();
    if (el.status) el.status.textContent = "Ready. Press start.";
  });

  if (el.cueBtn) {
    el.cueBtn.addEventListener("click", cueDeckB);
  }

  if (el.splitCueBtn) {
    el.splitCueBtn.addEventListener("click", function () {
      state.splitCue = !state.splitCue;
      el.splitCueBtn.classList.toggle("is-active", state.splitCue);
      applyAudioRouting();
      if (el.status) {
        el.status.textContent = state.splitCue
          ? "🎧 Split Cue Active: Deck A in Left ear, Deck B in Right ear."
          : "Stereo Master: Both decks blended in center.";
      }
    });
  }

  if (el.soloABtn) {
    el.soloABtn.addEventListener("click", function () {
      state.soloA = !state.soloA;
      state.soloB = false;
      if (el.soloBBtn) el.soloBBtn.classList.remove("is-active");
      el.soloABtn.classList.toggle("is-active", state.soloA);
      applyAudioRouting();
    });
  }

  if (el.soloBBtn) {
    el.soloBBtn.addEventListener("click", function () {
      state.soloB = !state.soloB;
      state.soloA = false;
      if (el.soloABtn) el.soloABtn.classList.remove("is-active");
      el.soloBBtn.classList.toggle("is-active", state.soloB);
      applyAudioRouting();
    });
  }

  // Audio Demo Buttons
  if (el.demoLocked) el.demoLocked.addEventListener("click", function () { playAudioDemo("locked", el.demoLocked); });
  if (el.demoDragging) el.demoDragging.addEventListener("click", function () { playAudioDemo("dragging", el.demoDragging); });
  if (el.demoRushing) el.demoRushing.addEventListener("click", function () { playAudioDemo("rushing", el.demoRushing); });

  // Platter scratch / rotary touch interaction on Deck B
  if (el.platterB) {
    var isDraggingPlatter = false;
    var lastClientX = 0;

    el.platterB.addEventListener("pointerdown", function (e) {
      if (!state.running) return;
      isDraggingPlatter = true;
      lastClientX = e.clientX;
      el.platterB.setPointerCapture(e.pointerId);
    });

    el.platterB.addEventListener("pointermove", function (e) {
      if (!isDraggingPlatter || !state.running) return;
      var dx = e.clientX - lastClientX;
      lastClientX = e.clientX;
      if (dx > 2) nudge(1);
      else if (dx < -2) nudge(-1);
    });

    ["pointerup", "pointercancel"].forEach(function (evt) {
      el.platterB.addEventListener(evt, function () {
        if (isDraggingPlatter) {
          isDraggingPlatter = false;
          releaseNudge();
        }
      });
    });
  }

  // Difficulty change
  if (el.difficulty) {
    el.difficulty.addEventListener("change", function () {
      if (state.running) {
        stop("manual");
        if (el.status) el.status.textContent = "Stopped. Difficulty changed — start again for a fresh attempt.";
      }
      randomiseStart();
      showBest();
    });
  }
  showBest();

  if (el.pitch) {
    el.pitch.addEventListener("input", function () {
      setPitch(parseFloat(el.pitch.value));
    });
  }

  function nudge(dir) {
    if (!state.running) return;
    state.nudge = dir;
  }
  function releaseNudge() {
    state.nudge = 0;
  }

  [el.nudgeBack, el.nudgeFwd].forEach(function (button) {
    if (!button) return;
    var dir = button === el.nudgeBack ? -1 : 1;
    button.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      nudge(dir);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (type) {
      button.addEventListener(type, releaseNudge);
    });
    button.addEventListener("click", function () {
      if (!state.running || state.nudge !== 0) return;
      nudge(dir);
      window.setTimeout(releaseNudge, 140);
    });
  });

  if (el.hide) {
    el.hide.addEventListener("change", function () {
      root.classList.toggle("is-hidden-readout", el.hide.checked);
    });
  }

  // Scorecard modal actions
  if (el.scorecardClose) {
    el.scorecardClose.addEventListener("click", function () {
      el.scorecard.hidden = true;
    });
  }
  if (el.scorecardRetry) {
    el.scorecardRetry.addEventListener("click", function () {
      el.scorecard.hidden = true;
      start();
    });
  }
  if (el.scorecardCopy) {
    el.scorecardCopy.addEventListener("click", function () {
      var pct = el.score ? el.score.textContent : "0%";
      var diff = difficultyKey();
      var cardText = "🎧 Offbeat Beatmatch Drill: scored " + pct + " on " + diff + " mode! Practise by ear: https://offbeatinc.com/beatmatch-trainer.html";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cardText).then(function () {
          el.scorecardCopy.textContent = "Copied to clipboard!";
          window.setTimeout(function () { el.scorecardCopy.textContent = "Share Result"; }, 2000);
        });
      }
    });
  }

  // Keyboard navigation
  document.addEventListener("keydown", function (event) {
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    if (event.key === "c" || event.key === "C") {
      event.preventDefault();
      cueDeckB();
    } else if (event.key === "m" || event.key === "M") {
      event.preventDefault();
      if (el.splitCueBtn) el.splitCueBtn.click();
    } else if (event.key === "1") {
      event.preventDefault();
      if (el.soloABtn) el.soloABtn.click();
    } else if (event.key === "2") {
      event.preventDefault();
      if (el.soloBBtn) el.soloBBtn.click();
    } else if (event.key === "r" || event.key === "R") {
      if (!state.running) {
        event.preventDefault();
        start();
      }
    } else if (state.running) {
      if (event.key === "ArrowLeft") { event.preventDefault(); nudge(-1); }
      else if (event.key === "ArrowRight") { event.preventDefault(); nudge(1); }
      else if (event.key === "ArrowUp") {
        event.preventDefault();
        var step = event.shiftKey ? 0.25 : 0.05;
        setPitch(state.pitch + step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        var coarseStep = event.shiftKey ? 0.25 : 0.05;
        setPitch(state.pitch - coarseStep);
      } else if (event.key === " ") {
        event.preventDefault();
        stop("manual");
      }
    } else if (event.key === " " && !state.running) {
      event.preventDefault();
      start();
    }
  });

  document.addEventListener("keyup", function (event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") releaseNudge();
  });

  setPitch(0);
  resetScore();
  if (el.status) el.status.textContent = "Ready. Press start to cue deck B.";

  /* Headless test handle */
  window.__trainer = {
    state: state,
    phaseMs: phaseMs,
    setPitch: setPitch,
    start: start,
    stop: stop,
    cueDeckB: cueDeckB
  };
})();
