/* Offbeat — browser beatmatching trainer.
 *
 * Two synthesised "records" are played together: deck A is the master and never
 * moves, deck B starts at a random offset with a slightly wrong tempo. Your job
 * is the real one — match the tempo with the pitch fader, then line the kicks up
 * with nudges — and the trainer keeps score.
 *
 * Everything is generated with Web Audio oscillators and noise, so the tool
 * needs no audio files, no network and no account. It works on a phone, with a
 * mouse, or with the keyboard.
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
    liveB: root.querySelector("[data-live-b]")
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
    lastFrame: 0,
    locked: false,
    raf: null,
    ticker: null
  };

  var audio = {};

  /* ------------------------------------------------------------------ audio */
  function noiseBuffer(ctx, seconds) {
    var length = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function buildGraph(ctx) {
    var master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    return {
      master: master,
      noise: noiseBuffer(ctx, 0.5)
    };
  }

  function kick(ctx, when, gainValue, out) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.11);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + 0.3);
  }

  function noiseHit(ctx, when, out, options) {
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
    noiseHit(ctx, when, out, { type: "highpass", frequency: 8000, gain: 0.045, decay: 0.035 });
  }

  function snare(ctx, when, out) {
    noiseHit(ctx, when, out, { type: "bandpass", frequency: 1800, gain: 0.13, decay: 0.13 });
  }

  function bassNote(ctx, when, out, freq) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.05, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + 0.24);
  }

  /* Each deck sounds slightly different so they are easy to tell apart. */
  function scheduleBeat(deck, when, bpm) {
    bpm = bpm || (deck === "a" ? state.bpmA : currentBpmB());
    var beat = deck === "a" ? state.beatA : state.beatB;
    var out = deck === "a" ? audio.chanA : audio.chanB;
    var position = beat % 4;

    if (deck === "a") {
      kick(state.ctx, when, 0.62, out);
      if (position === 1 || position === 3) snare(state.ctx, when, out);
      hat(state.ctx, when + 60 / bpm / 2, out);
      bassNote(state.ctx, when + 0.02, out, position % 2 === 0 ? 55 : 65.4);
    } else {
      kick(state.ctx, when, 0.55, out);
      if (position === 1 || position === 3) snare(state.ctx, when, out);
      hat(state.ctx, when + 60 / bpm / 2, out);
      hat(state.ctx, when + (60 / bpm) * 0.75, out);
      bassNote(state.ctx, when + 0.02, out, position % 2 === 0 ? 61.7 : 73.4);
    }
  }

  /* ------------------------------------------------------------- scheduling */
  function advanceClock() {
    // Each deck's playhead moves at its own tempo, so phase is continuous and can
    // be measured to the millisecond instead of snapping to whole beats.
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
    // A held nudge temporarily slows or speeds the platter, like a hand on a jog wheel.
    var base = state.bpmB;
    if (state.nudge === -1) base *= 0.90;
    if (state.nudge === 1) base *= 1.11;
    return base;
  }

  function phaseMs() {
    // How far deck B sits behind deck A, folded into +/- half a beat.
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
      el.best.textContent = "No score on " + difficultyKey() + " yet. This device remembers your best.";
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
        /* private mode or a full quota: the drill still works */
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
    if (el.score) el.score.textContent = "0%";
    if (el.clock) el.clock.textContent = DRILL + "s";
    if (el.verdict) {
      el.verdict.textContent = "";
      el.verdict.removeAttribute("data-grade");
    }
  }

  function randomiseStart() {
    var skill = el.difficulty ? el.difficulty.value : "steady";
    var spread = skill === "easy" ? 0.9 : skill === "hard" ? 3.2 : 1.8;
    var sign = Math.random() < 0.5 ? -1 : 1;
    state.baseBpm = MASTER_BPM * (1 + (sign * spread * (0.5 + Math.random() * 0.5)) / 100);
    // How far out of position deck B starts, measured in beats.
    state.phaseStart = skill === "easy" ? 0.12 : skill === "hard" ? 0.42 : 0.28;
    setPitch(0);
  }

  function start() {
    if (state.running) return;
    if (!state.ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        if (el.status) el.status.textContent = "This browser cannot play audio. Try a recent Chrome, Safari or Firefox.";
        return;
      }
      state.ctx = new Ctx();
      audio = buildGraph(state.ctx);
      audio.chanA = state.ctx.createGain();
      audio.chanB = state.ctx.createGain();
      audio.chanA.gain.value = 0.85;
      audio.chanB.gain.value = 0.85;
      audio.chanA.connect(audio.master);
      audio.chanB.connect(audio.master);
    }
    if (state.ctx.state === "suspended") state.ctx.resume();

    randomiseStart();
    state.posA = 0;
    state.posB = -state.phaseStart; // in beats: deck B arrives late
    state.lastAudio = state.ctx.currentTime;
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
    if (el.status) el.status.textContent = "Deck B is cued. Match the tempo, then the beats.";
    state.ticker = window.setInterval(function () {
      try { scheduler(); } catch (error) { /* keep the clock running */ }
    }, 25);
    try { scheduler(); } catch (error) { /* first pass is best-effort */ }
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
    if (el.status && reason === "manual") el.status.textContent = "Stopped. Start again for a fresh attempt.";
    if (reason === "done") finish();
  }

  function finish() {
    var pct = state.totalMs > 0 ? Math.round((state.lockedMs / state.totalMs) * 100) : 0;
    if (el.score) el.score.textContent = pct + "%";
    if (el.clock) el.clock.textContent = "0s";
    if (el.status) el.status.textContent = "Time. Same drill again, or hide the readouts and do it by ear.";
    if (!el.verdict) return;
    var text;
    var grade;
    if (pct >= 85) { text = "Locked in. That is a mix you could take into a room."; grade = "great"; }
    else if (pct >= 65) { text = "Solid. One more pass and it will hold without thinking."; grade = "good"; }
    else if (pct >= 40) { text = "Getting there. The tempo is close; the phase is what keeps slipping."; grade = "ok"; }
    else { text = "Rough. Slow down: fix the tempo first, then nudge once. Do not chase it."; grade = "rough"; }
    el.verdict.textContent = recordBest(pct) ? text + " That is a new personal best on this difficulty." : text;
    el.verdict.setAttribute("data-grade", grade);
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
    if (state.locked) state.lockedMs += dt;

    var remaining = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
    if (el.clock) el.clock.textContent = remaining + "s";
    if (el.drift) el.drift.textContent = (diff > 0 ? "+" : "") + Math.round(diff) + " ms";
    if (el.driftBar) {
      var clamped = Math.max(-160, Math.min(160, diff));
      el.driftBar.style.setProperty("--offset", String(clamped));
      el.driftBar.classList.toggle("is-locked", state.locked);
      if (el.driftReadout) el.driftReadout.classList.toggle("is-locked", state.locked);
    }
    if (el.score) el.score.textContent = (state.totalMs > 0 ? Math.round((state.lockedMs / state.totalMs) * 100) : 0) + "%";
    if (el.status) {
      el.status.textContent = state.locked
        ? "Kicks are landing together. Hold it there."
        : absDiff < 60
          ? "Close — nudge it in. Small moves."
          : "Drifting. Is the tempo right, or is it only the position?";
    }
    if (el.bpmA) el.bpmA.textContent = fmt(MASTER_BPM, 1);
    if (el.bpmB) el.bpmB.textContent = fmt(currentBpmB(), 2);
    if (el.liveA) el.liveA.classList.toggle("is-beat", Math.floor(state.posA * 2) % 2 === 0);
    if (el.liveB) el.liveB.classList.toggle("is-beat", Math.floor(state.posB * 2) % 2 === 0);

    if (now >= state.endsAt) {
      stop("done");
      return;
    }
    state.raf = window.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- inputs */
  if (el.start) el.start.addEventListener("click", start);
  if (el.stop) el.stop.addEventListener("click", function () { stop("manual"); });
  if (el.reset) el.reset.addEventListener("click", function () {
    stop("manual");
    resetScore();
    if (el.status) el.status.textContent = "Ready. Press start.";
  });

  if (el.difficulty) {
    el.difficulty.addEventListener("change", function () {
      // Changing difficulty mid-drill would mix two scoring standards, so stop cleanly.
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
    // A click (keyboard Enter/Space, or an assistive input that only fires click)
    // becomes a short 140 ms nudge so the control is not pointer-only.
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

  document.addEventListener("keydown", function (event) {
    if (!state.running) return;
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.key === "ArrowLeft") { event.preventDefault(); nudge(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); nudge(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setPitch(state.pitch + 0.05); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setPitch(state.pitch - 0.05); }
    else if (event.key === " ") { event.preventDefault(); stop("manual"); }
  });
  document.addEventListener("keyup", function (event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") releaseNudge();
  });

  setPitch(0);
  resetScore();
  if (el.status) el.status.textContent = "Ready. Press start to cue deck B.";

  /* A tiny debug handle so the behaviour can be verified in a headless browser. */
  window.__trainer = {
    state: state,
    phaseMs: phaseMs,
    setPitch: setPitch,
    start: start,
    stop: stop
  };
})();
