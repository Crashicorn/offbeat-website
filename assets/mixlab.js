/* =============================================================================
   Offbeat — Mix Lab
   A beatmatching drill that behaves like a small two-deck setup.

   Why this exists (design notes):
   - You hear two *musical* 4-bar loops in the same key (A minor: Am7–Fmaj7–Cmaj7–G),
     so a locked mix is consonant and a wrong one flams. The decks are told apart by
     timbre and rhythm, not by key, so locking actually sounds good.
   - Tempo and phase are taught separately, in the order a working DJ does them:
     1. find the tempo, 2. line up the beats, 3. hold the blend.
   - Success is audible: when the last step is held, Deck B's musical layer swells in
     and a resolve chord lands, so the reward is a mix, not a number.
   - Timing runs off the AudioContext clock; the UI reads the same clock, so the
     readouts never disagree with what you hear.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.querySelector("[data-mixlab]");
  if (!root) return;

  var ICON = {
    wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 12h2.4l1.8-5 2.4 10 2.2-13 2.3 16 1.8-8H21"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.6"/><path d="M12 3.6V1.4M12 22.6v-2.2M3.6 12H1.4M22.6 12h-2.2"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 14v-2a8 8 0 1 1 16 0v2"/><rect x="2.6" y="13.6" width="4.4" height="6.4" rx="1.6"/><rect x="17" y="13.6" width="4.4" height="6.4" rx="1.6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6L19 12z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.6" height="14" rx="1"/><rect x="13.4" y="5" width="3.6" height="14" rx="1"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 3.6v4.8h4.8"/></svg>',
    cue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14l5-7zM13 5v14l5-7z"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.6l4.6 4.6L19.5 6.8"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 10.6v6M12 7.6v.1"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6 21.4 20H2.6z"/><path d="M12 9.6v4.6M12 17.2v.1"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8z"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.4" y="6.4" width="19.2" height="11.2" rx="2"/><path d="M6 10h.1M9.2 10h.1M12.4 10h.1M15.6 10h.1M18.8 10h.1M7.4 14h9.2"/></svg>'
  };

  var GENRES = {
    house: { label: "House", bpm: 124 },
    techhouse: { label: "Tech house", bpm: 128 },
    disco: { label: "Nu-disco", bpm: 115 },
    techno: { label: "Techno", bpm: 132 },
    dnb: { label: "Drum & bass", bpm: 174 }
  };

  var LOCK_MS = 18;          /* phase window in milliseconds */
  var TEMPO_LOCK = 0.06;     /* BPM tolerance for "tempo is right" */
  var LESSONS = [
    {
      id: 1,
      title: "Find the tempo",
      short: "Pitch only. The beats start together and slowly slide apart.",
      goal: "Hold the tempo within 0.06 BPM for 1.5 seconds.",
      hint: "Deck B starts on the beat but at the wrong speed, so the gap widens steadily. Ignore the nudge buttons — this is a pitch-fader problem.",
      setup: { tempoError: 0.016, phase: 0 },
      check: "tempo"
    },
    {
      id: 2,
      title: "Line up the beats",
      short: "Tempo is already right. The kicks are just in the wrong place.",
      goal: "Bring the kick offset inside ±18 ms and keep it there for 1 second.",
      hint: "The pitch is already matched. Use Nudge (or drag the platter) to shift Deck B a few milliseconds — small corrections only.",
      setup: { tempoError: 0, phase: 0.18 },
      check: "phase"
    },
    {
      id: 3,
      title: "Hold the blend",
      short: "Both are wrong, and nobody tells you which. That is a real mix.",
      goal: "Fix tempo and phase, then hold the lock for 8 seconds.",
      hint: "Tempo first, then phase. When the kicks fuse, hold the fader still and let the second track come in.",
      setup: { tempoError: 0.011, phase: 0.23 },
      check: "hold"
    },
    {
      id: 4,
      title: "Blind hold",
      short: "No meters, no grid, no numbers. Eight seconds of listening, then twelve.",
      goal: "Hold the blend for 12 seconds with every readout hidden.",
      hint: "The numbers come back when you are done. Trust the flam, not the screen — make one small correction at a time and then listen.",
      setup: { tempoError: 0.008, phase: 0.15 },
      check: "blind"
    }
  ];

  var BLIND_HOLD_MS = 12000;

  var S = {
    running: false,
    ctx: null,
    mode: "lesson",
    lesson: 1,
    genre: "house",
    bpmA: 124,
    baseBpm: 124,
    pitch: 0,
    posA: 0,
    posB: 0,
    beatA: 0,
    beatB: 0,
    schedA: -1,
    schedB: -1,
    nudgeQueue: 0,           /* milliseconds of phase correction still to apply */
    lockSince: 0,
    streakStart: 0,
    bestHold: 0,
    holdMs: 0,
    tempoOkSince: 0,
    phaseOkSince: 0,
    startedAt: 0,
    lastAudio: 0,
    lessonDone: false,
    timer: null,
    raf: null,
    splitCue: false,
    soloA: false,
    soloB: false,
    musicB: 0.18,
    lastFrame: 0,
    offsetMs: 0,
    tempoDiff: 0,
    locked: false,
    demoKind: null,
    demoEndsAt: 0,
    stats: { tempoSec: null, phaseSec: null, holdSec: 0, startOffset: 0, startTempo: 0 }
  };

  /* ------------------------------------------------------------ audio graph */
  var A = {};

  function makeNoise(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function buildGraph() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();
    S.ctx = ctx;

    var master = ctx.createGain();
    master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    master.connect(comp).connect(ctx.destination);

    A.noise = makeNoise(ctx, 2);
    A.master = master;
    A.deckA = ctx.createGain();
    A.deckB = ctx.createGain();
    A.deckA.gain.value = 0.85;
    A.deckB.gain.value = 0.85;
    A.musicA = ctx.createGain();
    A.musicB = ctx.createGain();
    A.musicA.gain.value = 0.5;
    A.musicB.gain.value = S.musicB;

    if (ctx.createStereoPanner) {
      A.panA = ctx.createStereoPanner();
      A.panB = ctx.createStereoPanner();
      A.panA.pan.value = 0;
      A.panB.pan.value = 0;
      A.deckA.connect(A.panA).connect(master);
      A.deckB.connect(A.panB).connect(master);
    } else {
      A.deckA.connect(master);
      A.deckB.connect(master);
    }
    A.musicA.connect(A.deckA);
    A.musicB.connect(A.deckB);
    return ctx;
  }

  function route() {
    if (!A.deckA) return;
    var soloA = S.soloA, soloB = S.soloB;
    A.deckA.gain.setTargetAtTime(soloB ? 0 : 0.85, S.ctx.currentTime, 0.02);
    A.deckB.gain.setTargetAtTime(soloA ? 0 : 0.85, S.ctx.currentTime, 0.02);
    if (A.panA && A.panB) {
      A.panA.pan.setTargetAtTime(S.splitCue ? -0.9 : 0, S.ctx.currentTime, 0.03);
      A.panB.pan.setTargetAtTime(S.splitCue ? 0.9 : 0, S.ctx.currentTime, 0.03);
    }
  }

  /* -------------------------------------------------------------- synthesis */
  function kick(ctx, when, out, level, tone) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(tone || 150, when);
    osc.frequency.exponentialRampToValueAtTime(46, when + 0.1);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + 0.32);
  }

  function noiseHit(ctx, when, out, opts) {
    if (!A.noise) return;
    var src = ctx.createBufferSource();
    src.buffer = A.noise;
    var filter = ctx.createBiquadFilter();
    filter.type = opts.type || "highpass";
    filter.frequency.value = opts.freq || 6000;
    if (opts.q) filter.Q.value = opts.q;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(opts.level || 0.1, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (opts.decay || 0.05));
    src.connect(filter).connect(gain).connect(out);
    src.start(when);
    src.stop(when + (opts.decay || 0.05) + 0.03);
  }

  function tone(ctx, when, out, freq, level, decay, type) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + decay + 0.02);
  }

  /* A minor progression: Am7 · Fmaj7 · Cmaj7 · G6 — four bars, then repeat. */
  var CHORDS = [
    [220.0, 261.63, 329.63, 392.0],    /* A3 C4 E4 G4  */
    [174.61, 220.0, 261.63, 329.63],   /* F3 A3 C4 E4  */
    [196.0, 261.63, 329.63, 392.0],    /* G3 C4 E4 G4  */
    [196.0, 246.94, 293.66, 392.0]     /* G3 B3 D4 G4  */
  ];

  function pad(ctx, when, out, notes, dur, level) {
    notes.forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1500;
      osc.type = i % 2 ? "triangle" : "sine";
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 4;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(level, when + 0.14);
      gain.gain.linearRampToValueAtTime(level * 0.8, when + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(filter).connect(gain).connect(out);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    });
  }

  function scheduleBeat(deck, when, bpm, beatIndex) {
    var ctx = S.ctx;
    var beat = 60 / bpm;
    var bar = Math.floor(beatIndex / 4);
    var inBar = ((beatIndex % 4) + 4) % 4;
    var chord = CHORDS[((bar % 4) + 4) % 4];
    var outDrums = deck === "a" ? A.deckA : A.deckB;
    var outMusic = deck === "a" ? A.musicA : A.musicB;

    if (deck === "a") {
      kick(ctx, when, outDrums, 0.62, 158);
      noiseHit(ctx, when + beat * 0.5, outDrums, { freq: 8200, level: 0.055, decay: 0.1 });
      if (inBar === 1 || inBar === 3) noiseHit(ctx, when, outDrums, { type: "bandpass", freq: 1900, q: 1.2, level: 0.1, decay: 0.12 });
      if (inBar === 0 || inBar === 2) tone(ctx, when + 0.01, outDrums, chord[0] / 4, 0.1, 0.24, "triangle");
      if (inBar === 0) pad(ctx, when, outMusic, chord, beat * 4, 0.05);
    } else {
      kick(ctx, when, outDrums, 0.5, 140);
      noiseHit(ctx, when + beat * 0.25, outDrums, { freq: 9000, level: 0.03, decay: 0.03 });
      noiseHit(ctx, when + beat * 0.75, outDrums, { freq: 9000, level: 0.03, decay: 0.03 });
      noiseHit(ctx, when + beat * 0.5, outDrums, { type: "bandpass", freq: 5200, q: 0.8, level: 0.032, decay: 0.16 });
      if (inBar === 2) noiseHit(ctx, when, outDrums, { type: "bandpass", freq: 2100, q: 1.4, level: 0.07, decay: 0.1 });
      /* offbeat pluck — the layer that tells you the second track is in */
      tone(ctx, when + beat * 0.5, outMusic, chord[2] * 2, 0.05, 0.14, "square");
      tone(ctx, when + beat * 0.75, outMusic, chord[3] * 2, 0.035, 0.1, "triangle");
      if (inBar === 0) pad(ctx, when, outMusic, chord.map(function (f) { return f * 2; }), beat * 4, 0.045);
    }
  }

  /* ------------------------------------------------------------- scheduling */
  function currentBpmB() {
    return S.baseBpm * (1 + S.pitch / 100);
  }

  function pump(deck, t, horizon) {
    var bpm = deck === "a" ? S.bpmA : currentBpmB();
    var pos = deck === "a" ? S.posA : S.posB;
    var last = deck === "a" ? S.schedA : S.schedB;
    var period = 60 / bpm;
    var index = Math.max(Math.ceil(pos), last + 1);
    var when = t + (index - pos) * period;
    var guard = 0;
    while (when < horizon && guard < 12) {
      if (deck === "a") S.beatA = index; else S.beatB = index;
      scheduleBeat(deck, when, bpm, index);
      if (deck === "a") S.schedA = index; else S.schedB = index;
      index += 1;
      when += period;
      guard += 1;
    }
  }

  function tick() {
    if (!S.running) return;
    var ctx = S.ctx;
    var t = ctx.currentTime;
    var dt = t - S.lastAudio;
    if (dt > 0 && dt < 0.6) {
      S.posA += (dt * S.bpmA) / 60;
      S.posB += (dt * currentBpmB()) / 60;
    }
    if (dt > 0 && Math.abs(S.nudgeQueue) > 0.01) {
      /* a nudge is a short jog: shift Deck B at up to 0.9 s of audio per second */
      var stepMs = Math.sign(S.nudgeQueue) * Math.min(Math.abs(S.nudgeQueue), dt * 900);
      S.posB += stepMs / (60000 / S.bpmA);
      S.nudgeQueue -= stepMs;
    }
    if (dt > 0) S.lastAudio = t;
    pump("a", t, t + 0.14);
    pump("b", t, t + 0.14);
  }

  /* --------------------------------------------------------------- metrics */
  function wrapBeats(n) {
    var w = n - Math.round(n);
    return w;
  }
  function offsetMs() {
    return wrapBeats(S.posA - S.posB) * (60000 / S.bpmA);
  }
  function tempoDiff() {
    return currentBpmB() - S.bpmA;
  }

  /* ------------------------------------------------------------------ UI */
  var ui = {
    lessons: root.querySelector("[data-ml-lessons]"),
    play: root.querySelector("[data-ml-play]"),
    reset: root.querySelector("[data-ml-reset]"),
    genre: root.querySelector("[data-ml-genre]"),
    level: root.querySelector("[data-ml-level]"),
    bpmA: root.querySelector("[data-ml-bpm-a]"),
    bpmB: root.querySelector("[data-ml-bpm-b]"),
    pitch: root.querySelector("[data-ml-pitch]"),
    pitchValue: root.querySelector("[data-ml-pitch-value]"),
    platterA: root.querySelector("[data-ml-platter-a]"),
    platterB: root.querySelector("[data-ml-platter-b]"),
    barsA: root.querySelector("[data-ml-bars-a]"),
    barsB: root.querySelector("[data-ml-bars-b]"),
    nudgeBack: root.querySelector("[data-ml-nudge-back]"),
    nudgeFwd: root.querySelector("[data-ml-nudge-fwd]"),
    cue: root.querySelector("[data-ml-cue]"),
    soloA: root.querySelector("[data-ml-solo-a]"),
    soloB: root.querySelector("[data-ml-solo-b]"),
    split: root.querySelector("[data-ml-split]"),
    offset: root.querySelector("[data-ml-offset]"),
    tempo: root.querySelector("[data-ml-tempo]"),
    phase: root.querySelector("[data-ml-phase]"),
    phaseWindow: root.querySelector("[data-ml-phase-window]"),
    phasePip: root.querySelector("[data-ml-phase-pip]"),
    lockFill: root.querySelector("[data-ml-lock-fill]"),
    lockValue: root.querySelector("[data-ml-lock-value]"),
    phrase: root.querySelector("[data-ml-phrase]"),
    chord: root.querySelector("[data-ml-chord]"),
    barLabel: root.querySelector("[data-ml-bar]"),
    coach: root.querySelector("[data-ml-coach]"),
    coachIcon: root.querySelector("[data-ml-coach-icon]"),
    coachTitle: root.querySelector("[data-ml-coach-title]"),
    coachMsg: root.querySelector("[data-ml-coach-msg]"),
    status: root.querySelector("[data-ml-status]"),
    result: root.querySelector("[data-ml-result]"),
    canvas: root.querySelector("[data-ml-canvas]"),
    demos: document.querySelectorAll("[data-ml-demo]"),
    blindNote: root.querySelector("[data-ml-blind-note]"),
    progress: root.querySelector("[data-ml-progress]")
  };

  function fmt(n, d) { return (Number(n) || 0).toFixed(d === undefined ? 1 : d); }

  function setPitch(value) {
    S.pitch = Math.max(-6, Math.min(6, Math.round(value * 100) / 100));
    if (ui.pitch) ui.pitch.value = String(S.pitch);
    if (ui.pitchValue) {
      ui.pitchValue.textContent = (S.pitch > 0 ? "+" : S.pitch < 0 ? "−" : "") + fmt(Math.abs(S.pitch), 2) + "%";
    }
    if (ui.bpmB) ui.bpmB.textContent = fmt(currentBpmB(), 1);
  }

  function applyBlindUi() {
    var lesson = LESSONS[S.lesson - 1];
    var blind = S.mode === "lesson" && !!lesson && lesson.check === "blind" && !S.lessonDone;
    root.classList.toggle("is-blind", blind);
    if (ui.blindNote) ui.blindNote.hidden = !blind;
  }

  function setLesson(id) {
    S.lesson = id;
    S.mode = "lesson";
    applyBlindUi();
    stop();
    resetDeckToLesson();
    updateLessonStrip();
    if (ui.level) ui.level.value = "lesson";
    updateCoach(true);
    render();
  }

  function resetDeckToLesson() {
    var lesson = LESSONS[S.lesson - 1];
    S.lessonDone = false;
    S.stats = { tempoSec: null, phaseSec: null, holdSec: 0, nudges: 0, pitchMoves: 0 };
    S.lockSince = 0;
    S.streakStart = 0;
    S.holdMs = 0;
    S.tempoOkSince = 0;
    S.phaseOkSince = 0;
    S.musicB = 0.18;
    if (A.musicB && S.ctx) A.musicB.gain.setTargetAtTime(S.musicB, S.ctx.currentTime, 0.05);
    if (ui.result) ui.result.hidden = true;
  }

  function updateLessonStrip() {
    if (!ui.lessons) return;
    ui.lessons.querySelectorAll("[data-ml-lesson], [data-ml-free]").forEach(function (btn) {
      var isFree = btn.hasAttribute("data-ml-free");
      var id = Number(btn.getAttribute("data-ml-lesson"));
      var active = isFree ? S.mode === "free" : (S.mode === "lesson" && id === S.lesson);
      btn.classList.toggle("is-active", active);
      btn.classList.toggle("is-done", !isFree && completed.indexOf(id) !== -1);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  var completed = [];
  try {
    completed = JSON.parse(localStorage.getItem("offbeat.mixlab.done") || "[]") || [];
  } catch (e) { completed = []; }

  function updateProgress() {
    if (!ui.progress) return;
    var done = LESSONS.filter(function (l) { return completed.indexOf(l.id) !== -1; });
    if (!done.length) {
      ui.progress.textContent = "No lessons finished yet — start with lesson 1.";
      return;
    }
    if (done.length === LESSONS.length) {
      ui.progress.innerHTML = "<b>All four lessons complete.</b> Free practice is the next room — no targets, just the two decks.";
      return;
    }
    var next = LESSONS.filter(function (l) { return completed.indexOf(l.id) === -1; })[0];
    ui.progress.innerHTML = "<b>" + done.length + " of " + LESSONS.length + " lessons complete.</b> Next up: " + next.title.toLowerCase() + ".";
  }

  function markDone(id) {
    if (completed.indexOf(id) === -1) {
      completed.push(id);
      try { localStorage.setItem("offbeat.mixlab.done", JSON.stringify(completed)); } catch (e) { /* ignore */ }
    }
    updateLessonStrip();
    updateProgress();
  }

  /* --------------------------------------------------------------- frames */
  function frame(ts) {
    if (!S.running) { S.raf = null; return; }
    tick();

    var now = ts || window.performance.now();
    var delta = S.lastFrame ? Math.min(64, now - S.lastFrame) : 16;
    S.lastFrame = now;

    S.offsetMs = offsetMs();
    S.tempoDiff = tempoDiff();
    S.locked = Math.abs(S.offsetMs) <= LOCK_MS && Math.abs(S.tempoDiff) <= TEMPO_LOCK;

    if (S.locked) {
      if (!S.lockSince) S.lockSince = now;
      S.holdMs += delta;
      if (S.holdMs > S.bestHold) S.bestHold = S.holdMs;
    } else {
      S.lockSince = 0;
      S.holdMs = 0;
    }

    /* lesson progression */
    if (S.mode === "lesson" && !S.lessonDone) {
      var lesson = LESSONS[S.lesson - 1];
      var tempoRight = Math.abs(S.tempoDiff) <= TEMPO_LOCK;
      var phaseRight = Math.abs(S.offsetMs) <= LOCK_MS;

      if (tempoRight) {
        if (!S.tempoOkSince) S.tempoOkSince = now;
        if (S.stats.tempoSec === null && now - S.tempoOkSince >= 1500) S.stats.tempoSec = (now - S.startedAt) / 1000;
      } else {
        S.tempoOkSince = 0;
      }

      if (tempoRight && phaseRight) {
        if (!S.phaseOkSince) S.phaseOkSince = now;
        if (S.stats.phaseSec === null && now - S.phaseOkSince >= 1000) S.stats.phaseSec = (now - S.startedAt) / 1000;
      } else {
        S.phaseOkSince = 0;
      }

      var pass = false;
      if (lesson.check === "tempo") pass = S.stats.tempoSec !== null;
      else if (lesson.check === "phase") pass = S.stats.phaseSec !== null;
      else if (lesson.check === "hold") pass = S.locked && S.holdMs >= 8000;
      else if (lesson.check === "blind") pass = S.locked && S.holdMs >= BLIND_HOLD_MS;

      /* During the hold lesson, the second track arrives as you keep it locked. */
      if (lesson.check === "hold" && S.locked) {
        S.musicB = Math.min(0.85, 0.18 + (S.holdMs / 8000) * 0.67);
        if (A.musicB) A.musicB.gain.setTargetAtTime(S.musicB, S.ctx.currentTime, 0.08);
      } else if (lesson.check === "hold" && !S.locked && !S.lessonDone) {
        S.musicB = Math.max(0.18, S.musicB - 0.0025);
        if (A.musicB) A.musicB.gain.setTargetAtTime(S.musicB, S.ctx.currentTime, 0.1);
      }

      if (pass) completeLesson();
    }

    if (S.demoKind && now >= S.demoEndsAt) stop();

    paint(delta);
    S.raf = window.requestAnimationFrame(frame);
  }

  function paint(delta) {
    if (ui.bpmA) ui.bpmA.textContent = fmt(S.bpmA, 1);
    if (ui.bpmB) ui.bpmB.textContent = fmt(currentBpmB(), 1);

    if (ui.offset) {
      var rounded = Math.round(S.offsetMs);
      ui.offset.textContent = (rounded > 0 ? "+" : rounded < 0 ? "−" : "") + Math.abs(rounded);
    }
    if (ui.tempo) {
      var t = S.tempoDiff;
      ui.tempo.textContent = (Math.abs(t) < 0.05 ? "0.00" : (t > 0 ? "+" : "−") + fmt(Math.abs(t), 2));
    }

    if (ui.phasePip && ui.phase) {
      var pct = Math.max(-1, Math.min(1, S.offsetMs / 250));
      ui.phasePip.style.transform = "translateX(" + (pct * 50) + "%)";
      ui.phase.classList.toggle("is-locked", S.locked);
    }
    if (ui.phaseWindow && ui.phase) {
      /* the ±18 ms window as a share of the ±250 ms meter */
      ui.phaseWindow.style.width = ((LOCK_MS / 250) * 50 * 2).toFixed(2) + "%";
    }
    if (ui.pitchValue) {
      ui.pitchValue.classList.toggle("is-locked", Math.abs(S.tempoDiff) <= TEMPO_LOCK);
      ui.pitchValue.classList.toggle("is-near", Math.abs(S.tempoDiff) > TEMPO_LOCK && Math.abs(S.tempoDiff) < 0.4);
    }
    if (ui.platterA) ui.platterA.style.transform = "rotate(" + ((S.posA * 90) % 360).toFixed(1) + "deg)";
    if (ui.platterB) ui.platterB.style.transform = "rotate(" + ((S.posB * 90) % 360).toFixed(1) + "deg)";

    if (ui.lockFill) ui.lockFill.style.width = Math.min(100, (S.holdMs / 8000) * 100) + "%";
    if (ui.lockValue) ui.lockValue.textContent = fmt(S.holdMs / 1000, 1);

    pulseBars(ui.barsA, S.posA);
    pulseBars(ui.barsB, S.posB);

    updatePhrase();
    updateCoach(false);
    drawTimeline();
  }

  var CHORD_NAMES = ["Am7", "Fmaj7", "Cmaj7", "G6"];

  function updatePhrase() {
    var bar = Math.floor(S.posA / 4);
    var inLoop = ((bar % 4) + 4) % 4;
    if (ui.chord) ui.chord.textContent = CHORD_NAMES[inLoop];
    if (ui.barLabel) ui.barLabel.textContent = "bar " + (inLoop + 1) + " / 4";
    if (ui.phrase) {
      var dots = ui.phrase.children;
      for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("is-on", i <= inLoop);
    }
  }

  function pulseBars(container, pos) {
    if (!container) return;
    var bars = container.children;
    var phase = pos - Math.floor(pos);
    var kick = Math.max(0, 1 - phase * 3.2);
    for (var i = 0; i < bars.length; i++) {
      var wave = 0.28 + 0.5 * Math.abs(Math.sin((i / bars.length) * Math.PI * 2 + pos * 0.9));
      var level = Math.min(1, wave * 0.75 + kick * 0.5);
      bars[i].style.height = (level * 100).toFixed(0) + "%";
      bars[i].classList.toggle("is-hit", kick > 0.45 && i > 1 && i < bars.length - 1);
    }
  }

  function updateCoach(force) {
    if (!ui.coach || !ui.coachTitle || !ui.coachMsg) return;
    var state, title, msg;

    if (S.demoKind) {
      state = "warn";
      title = S.demoKind === "locked" ? "Kicks arriving together" : "Listen to the flam";
      msg = S.demoKind === "locked"
        ? "One punchy transient, no double tap. That is the sound you are trying to hold."
        : S.demoKind === "dragging"
          ? "Deck B is <b>late</b>: you hear <b>ba-dum</b>. The second kick trails the first by about 90 ms."
          : "Deck B is <b>early</b>: you hear <b>dum-ba</b>. The second kick arrives before the first.";
    } else if (!S.running) {
      state = "idle";
      var lesson = LESSONS[S.lesson - 1];
      title = S.mode === "lesson" ? "Lesson " + lesson.id + " · " + lesson.title : "Free practice";
      msg = S.mode === "lesson" ? lesson.goal + " " + (S.lessonDone ? "" : lesson.hint) : "Both decks are running. Nothing is scored — use it to try ideas.";
    } else if (S.lessonDone) {
      state = "ok";
      title = "Lesson complete";
      msg = "That is the skill. Reset when you want to do it again without any readouts helping you.";
    } else if (LESSONS[S.lesson - 1] && LESSONS[S.lesson - 1].check === "blind" && S.mode === "lesson") {
      state = S.locked ? "ok" : "warn";
      title = S.locked
        ? "Blind hold · " + Math.max(0, Math.ceil((BLIND_HOLD_MS - S.holdMs) / 1000)) + "s of clean blend left"
        : "Blind hold · trust the flam";
      if (S.locked) {
        msg = "That is the sound. Keep your hand off everything until it asks you again.";
      } else if (Math.abs(S.tempoDiff) > TEMPO_LOCK) {
        msg = "The gap is still moving — Deck B is " + (S.tempoDiff > 0 ? "a shade <b>fast</b>" : "a shade <b>slow</b>") +
          ". Small fader moves, then listen for two bars before touching it again.";
      } else {
        msg = "The tempo is close enough; the kicks are just smeared. One nudge, then listen — you will hear the flam close.";
      }
    } else if (Math.abs(S.tempoDiff) > TEMPO_LOCK) {
      state = "warn";
      var fast = S.tempoDiff > 0;
      title = "Step 1 · match the tempo";
      msg = "Deck B is running <b>" + (fast ? "fast" : "slow") + "</b> by " + fmt(Math.abs(S.tempoDiff), 2) +
        " BPM, so the gap keeps " + (fast ? "opening" : "closing") + ". Move the pitch fader " + (fast ? "down" : "up") + ".";
    } else if (!S.locked) {
      state = "warn";
      var ahead = S.offsetMs > 0;
      title = "Step 2 · line up the beats";
      msg = "Tempo is right. Deck B is <b>" + Math.round(Math.abs(S.offsetMs)) + " ms " + (ahead ? "behind" : "ahead") +
        "</b> — tap <b>" + (ahead ? "nudge forward" : "nudge back") + "</b> or drag the platter a little.";
    } else {
      state = "ok";
      title = S.mode === "lesson" && LESSONS[S.lesson - 1].check === "hold"
        ? "Locked · hold it for " + Math.max(0, Math.ceil((8000 - S.holdMs) / 1000)) + "s"
        : "Locked in";
      msg = "Kicks are inside " + Math.round(Math.abs(S.offsetMs)) + " ms. Keep your hand off the pitch fader and let it run.";
    }

    if (force || ui.coachTitle.textContent !== title) {
      ui.coach.className = "ml-coach" + (state === "ok" ? " ml-coach--ok" : state === "warn" ? " ml-coach--warn" : "");
      ui.coachTitle.textContent = title;
      ui.coachMsg.innerHTML = msg;
      if (ui.coachIcon) ui.coachIcon.innerHTML = state === "ok" ? ICON.check : state === "warn" ? ICON.warn : ICON.target;
    }
    if (ui.status) {
      ui.status.innerHTML = S.running
        ? "Playing · " + GENRES[S.genre].label + " " + fmt(S.bpmA, 0) + " BPM · hold <b>" + fmt(S.holdMs / 1000, 1) + "s</b>"
        : "Paused";
    }
  }

  /* ---------------------------------------------------------- beat timeline */
  function drawTimeline() {
    var canvas = ui.canvas;
    if (!canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(300, Math.round(rect.width));
    var h = Math.max(96, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var gutter = 66;
    var plotW = w - gutter - 8;
    var pxPerBeat = Math.max(38, Math.min(110, plotW / 8));
    var cx = gutter + plotW * 0.3;
    var rowA = Math.round(h * 0.36);
    var rowB = Math.round(h * 0.68);

    /* rows */
    ctx.fillStyle = "rgba(125,211,252,.05)";
    ctx.fillRect(gutter, rowA - 14, plotW, 28);
    ctx.fillStyle = "rgba(192,132,252,.06)";
    ctx.fillRect(gutter, rowB - 14, plotW, 28);

    /* locked shading across both rows */
    if (S.running && S.locked) {
      ctx.fillStyle = "rgba(52,211,153,.12)";
      ctx.fillRect(cx - pxPerBeat * 0.08, 0, pxPerBeat * 0.16, h);
    }

    /* playhead (now) */
    var grad = ctx.createLinearGradient(cx - 6, 0, cx + 6, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,.2)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 6, 0, 12, h);
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, 4);
    ctx.lineTo(cx + 0.5, h - 4);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.moveTo(cx - 4, 2);
    ctx.lineTo(cx + 4, 2);
    ctx.lineTo(cx, 8);
    ctx.closePath();
    ctx.fill();

    function drawTicks(pos, row, soft, strong, numbered) {
      var first = Math.floor(pos - (cx - gutter) / pxPerBeat) - 1;
      var last = Math.ceil(pos + (w - cx) / pxPerBeat) + 1;
      for (var i = first; i <= last; i++) {
        var x = Math.round(cx + (i - pos) * pxPerBeat) + 0.5;
        if (x < gutter || x > w - 4) continue;
        var isBar = ((i % 4) + 4) % 4 === 0;
        ctx.strokeStyle = isBar ? strong : soft;
        ctx.lineWidth = isBar ? 2.2 : 1.4;
        var tall = isBar ? 13 : 7;
        ctx.beginPath();
        ctx.moveTo(x, row - tall);
        ctx.lineTo(x, row + tall);
        ctx.stroke();

        if (isBar && numbered && x < w - 96) {
          var barNo = Math.floor(i / 4) + 1;
          ctx.fillStyle = "rgba(255,255,255,.42)";
          ctx.font = "700 8.5px Inter, system-ui, sans-serif";
          ctx.fillText(String(barNo), x - 4, 12);
        }
      }
    }

    drawTicks(S.posA, rowA, "rgba(125,211,252,.5)", "rgba(125,211,252,.95)", true);
    drawTicks(S.posB, rowB, "rgba(192,132,252,.5)", "rgba(192,132,252,.95)", false);

    /* row labels in the gutter */
    ctx.font = "700 8.5px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(125,211,252,.85)";
    ctx.fillText("DECK A", 6, rowA - 2);
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.fillText("master", 6, rowA + 10);
    ctx.fillStyle = "rgba(192,132,252,.9)";
    ctx.fillText("DECK B", 6, rowB - 2);
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.fillText("yours", 6, rowB + 10);

    /* beat counter under the playhead */
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.font = "600 8.5px Inter, system-ui, sans-serif";
    ctx.fillText("now", cx + 6, h - 5);
    ctx.fillStyle = "rgba(52,211,153,.75)";
    ctx.fillText("bar " + (Math.floor(S.posA / 4) + 1), w - 46, h - 5);
  }

  /* ---------------------------------------------------------------- actions */
  function start() {
    var lesson = LESSONS[S.lesson - 1];
    if (!S.ctx) buildGraph();
    if (!S.ctx) {
      if (ui.coachMsg) ui.coachMsg.textContent = "This browser will not start audio. Try Chrome, Firefox or Safari.";
      return;
    }
    if (S.ctx.state === "suspended") S.ctx.resume();
    route();

    if (S.mode === "lesson") {
      var setup = lesson.setup;
      var err = setup.tempoError * (Math.random() < 0.5 ? -1 : 1);
      if (S.lesson === 1) err = (0.012 + Math.random() * 0.006) * (Math.random() < 0.5 ? -1 : 1);
      if (S.lesson === 3) err = (0.009 + Math.random() * 0.005) * (Math.random() < 0.5 ? -1 : 1);
      S.baseBpm = S.bpmA * (1 + err);
      var phase = setup.phase ? (0.5 + Math.random() * 0.5) * setup.phase : 0;
      S.posB = phase;
      S.posA = 0;
      resetDeckToLesson();
    } else {
      S.baseBpm = S.bpmA * (1 + (Math.random() * 0.02 - 0.01));
      S.posB = Math.random() * 0.6 + 0.2;
      S.posA = 0;
      S.bestHold = 0;
      S.holdMs = 0;
      S.lockSince = 0;
    }

    S.pitch = 0;
    setPitch(0);
    S.stats.startOffset = Math.round(wrapBeats(S.posA - S.posB) * (60000 / S.bpmA));
    S.stats.startTempo = currentBpmB() - S.bpmA;
    S.schedA = -1;
    S.schedB = -1;
    S.nudgeQueue = 0;
    S.lastAudio = S.ctx.currentTime;
    S.lastFrame = window.performance.now();
    S.startedAt = S.lastFrame;
    S.running = true;
    S.demoKind = null;
    if (ui.result) ui.result.hidden = true;
    if (ui.play) {
      ui.play.innerHTML = ICON.pause + "<span>Pause</span>";
      ui.play.setAttribute("data-state", "playing");
    }
    S.raf = window.requestAnimationFrame(frame);
    updateCoach(true);
  }

  function stop() {
    S.running = false;
    if (S.raf) { window.cancelAnimationFrame(S.raf); S.raf = null; }
    if (S.timer) { window.clearInterval(S.timer); S.timer = null; }
    if (ui.play) {
      ui.play.innerHTML = ICON.play + "<span>Play both decks</span>";
      ui.play.setAttribute("data-state", "idle");
    }
    updateCoach(true);
  }

  function completeLesson() {
    S.lessonDone = true;
    applyBlindUi();
    markDone(S.lesson);
    S.musicB = 0.85;
    if (A.musicB) A.musicB.gain.setTargetAtTime(0.85, S.ctx.currentTime, 0.15);
    rewardChord();

    var lesson = LESSONS[S.lesson - 1];
    var stats = {
      tempo: S.stats.tempoSec,
      phase: S.stats.phaseSec,
      hold: S.holdMs / 1000
    };
    if (ui.result) {
      ui.result.hidden = false;
      ui.result.querySelector("[data-ml-result-title]").textContent = "Lesson " + lesson.id + " complete · " + lesson.title;
      ui.result.querySelector("[data-ml-result-badge]").textContent =
        lesson.check === "tempo" ? "Tempo matched" : lesson.check === "phase" ? "Phase locked"
          : lesson.check === "blind" ? "Blind held" : "Blend held";

      var started = Math.max(0.1, Math.abs(S.stats.startTempo));
      var startGap = Math.abs(Math.round(S.stats.startOffset));
      ui.result.querySelector("[data-ml-result-text]").textContent = lesson.check === "tempo"
        ? "Deck B arrived about " + fmt(started, 1) + " BPM out and you pulled it back to " + fmt(S.bpmA, 1) +
          " by ear, without touching the nudge. On real gear the fader would now be within a millimetre of where it belongs."
        : lesson.check === "phase"
          ? "You closed a " + startGap + " ms gap down to a single transient. That is the correction every blend needs, and the smallest one that will still work."
          : lesson.check === "blind"
            ? "Twelve seconds of blend with no meters, no grid and no numbers — " + (S.stats.nudges || 0) + " nudges and " +
              (S.stats.pitchMoves || 0) + " fader moves. That is the version of this skill that travels to real gear."
            : "Tempo, phase and eight seconds of holding it. The second track is now fully in the mix — that is what a blend sounds like when it works.";

      var statsEl = ui.result.querySelector("[data-ml-result-stats]");
      if (statsEl) {
        var cells = '<div><span>Tempo matched in</span><b>' + (stats.tempo ? fmt(stats.tempo, 1) + "s" : "—") + "</b></div>";
        if (lesson.check !== "tempo") {
          cells += '<div><span>Phase locked in</span><b>' + (stats.phase ? fmt(stats.phase, 1) + "s" : "—") + "</b></div>";
        }
        if (lesson.check === "blind") {
          cells += '<div><span>Nudges used</span><b>' + (S.stats.nudges || 0) + "</b></div>";
          cells += '<div><span>Fader moves</span><b>' + (S.stats.pitchMoves || 0) + "</b></div>";
        }
        cells += '<div><span>Longest hold</span><b>' + fmt(S.bestHold / 1000, 1) + "s</b></div>";
        statsEl.innerHTML = cells;
      }
      var next = ui.result.querySelector("[data-ml-result-next]");
      if (next) {
        var nextId = S.lesson + 1;
        if (nextId <= LESSONS.length) {
          next.textContent = "Next: " + LESSONS[nextId - 1].title;
          next.setAttribute("data-ml-go", String(nextId));
          next.hidden = false;
        } else {
          next.textContent = "Try free practice";
          next.setAttribute("data-ml-go", "free");
          next.hidden = false;
        }
      }
    }
    updateCoach(true);
  }

  function rewardChord() {
    if (!S.ctx) return;
    var t = S.ctx.currentTime + 0.02;
    var out = S.ctx.createGain();
    out.gain.value = 0.16;
    out.connect(A.master);
    [440, 523.25, 659.25, 880].forEach(function (f, i) {
      tone(S.ctx, t + i * 0.03, out, f, 0.12, 0.8, i % 2 ? "sine" : "triangle");
    });
  }

  function reset() {
    stop();
    applyBlindUi();
    S.pitch = 0;
    if (S.ctx) S.nudgeQueue = 0;
    setPitch(0);
    S.posA = 0;
    S.posB = 0;
    S.schedA = -1;
    S.schedB = -1;
    S.holdMs = 0;
    S.lockSince = 0;
    S.musicB = 0.18;
    if (A.musicB && S.ctx) A.musicB.gain.setTargetAtTime(0.18, S.ctx.currentTime, 0.05);
    S.lessonDone = false;
    if (ui.result) ui.result.hidden = true;
    if (ui.offset) ui.offset.textContent = "0";
    if (ui.tempo) ui.tempo.textContent = "0.00";
    if (ui.lockFill) ui.lockFill.style.width = "0%";
    if (ui.lockValue) ui.lockValue.textContent = "0.0";
    if (S.ctx) drawTimeline();
    updateCoach(true);
  }

  function nudge(ms) {
    if (!S.running) return;
    S.stats.nudges = (S.stats.nudges || 0) + 1;
    /* queue a short jog so the correction happens over a few audio frames
       instead of jumping the playhead (which would click) */
    S.nudgeQueue = Math.max(-260, Math.min(260, S.nudgeQueue + ms));
  }

  function cue() {
    if (!S.running) return;
    S.nudgeQueue = 0;
    S.posB = Math.round(S.posA);
    S.schedB = Math.floor(S.posB);
  }

  function demo(kind) {
    if (!S.ctx) buildGraph();
    if (!S.ctx) return;
    if (S.ctx.state === "suspended") S.ctx.resume();
    stop();
    var wasFree = S.mode === "free";
    S.demoReturn = wasFree ? "free" : "lesson";
    S.mode = "demo";
    S.demoKind = kind;
    S.bpmA = GENRES[S.genre].bpm;
    S.baseBpm = S.bpmA;
    S.pitch = 0;
    S.posA = 0;
    S.posB = kind === "locked" ? 0 : kind === "dragging" ? -90 / (60000 / S.bpmA) : 90 / (60000 / S.bpmA);
    S.schedA = -1;
    S.schedB = -1;
    S.lastAudio = S.ctx.currentTime;
    S.lastFrame = window.performance.now();
    S.demoEndsAt = S.lastFrame + 3800;
    S.running = true;
    if (A.musicB) A.musicB.gain.setTargetAtTime(0.5, S.ctx.currentTime, 0.08);
    ui.demos.forEach(function (b) {
      var on = b.getAttribute("data-ml-demo") === kind;
      b.classList.toggle("is-playing", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    S.raf = window.requestAnimationFrame(frame);
    updateCoach(true);
    updateLessonStrip();
  }

  /* --------------------------------------------------------------- wiring */
  if (ui.play) {
    ui.play.addEventListener("click", function () {
      if (S.running) stop(); else start();
    });
  }
  if (ui.reset) ui.reset.addEventListener("click", reset);
  if (ui.pitch) {
    ui.pitch.addEventListener("input", function (e) {
      if (S.running) S.stats.pitchMoves = (S.stats.pitchMoves || 0) + 1;
      setPitch(parseFloat(e.target.value));
    });
    ui.pitch.addEventListener("dblclick", function () { setPitch(0); });
  }
  if (ui.genre) {
    ui.genre.addEventListener("change", function (e) {
      S.genre = e.target.value;
      S.bpmA = GENRES[S.genre].bpm;
      stop();
      reset();
      if (ui.bpmA) ui.bpmA.textContent = fmt(S.bpmA, 1);
    });
  }
  if (ui.level) {
    ui.level.addEventListener("change", function (e) {
      var v = e.target.value;
      if (v === "free") {
        S.mode = "free";
        S.lessonDone = false;
        S.demoKind = null;
        stop();
        reset();
        updateLessonStrip();
        updateCoach(true);
      } else {
        setLesson(Number(v.replace("lesson", "")) || 1);
      }
    });
  }
  if (ui.lessons) {
    ui.lessons.addEventListener("click", function (e) {
      var free = e.target.closest("[data-ml-free]");
      if (free) {
        S.mode = "free";
        S.lessonDone = false;
        S.demoKind = null;
        stop();
        reset();
        updateLessonStrip();
        if (ui.level) ui.level.value = "free";
        updateCoach(true);
        return;
      }
      var btn = e.target.closest("[data-ml-lesson]");
      if (!btn) return;
      setLesson(Number(btn.getAttribute("data-ml-lesson")));
      if (ui.level) ui.level.value = "lesson" + S.lesson;
    });
  }
  if (ui.nudgeBack) ui.nudgeBack.addEventListener("click", function () { nudge(-22, true); });
  if (ui.nudgeFwd) ui.nudgeFwd.addEventListener("click", function () { nudge(22, true); });
  if (ui.cue) ui.cue.addEventListener("click", cue);

  if (ui.soloA) ui.soloA.addEventListener("click", function () {
    S.soloA = !S.soloA; if (S.soloA) S.soloB = false;
    ui.soloA.setAttribute("aria-pressed", S.soloA ? "true" : "false");
    if (ui.soloB) ui.soloB.setAttribute("aria-pressed", "false");
    route();
  });
  if (ui.soloB) ui.soloB.addEventListener("click", function () {
    S.soloB = !S.soloB; if (S.soloB) S.soloA = false;
    ui.soloB.setAttribute("aria-pressed", S.soloB ? "true" : "false");
    if (ui.soloA) ui.soloA.setAttribute("aria-pressed", "false");
    route();
  });
  if (ui.split) ui.split.addEventListener("click", function () {
    S.splitCue = !S.splitCue;
    ui.split.setAttribute("aria-pressed", S.splitCue ? "true" : "false");
    route();
  });

  ui.demos.forEach(function (btn) {
    btn.addEventListener("click", function () {
      demo(btn.getAttribute("data-ml-demo"));
      window.setTimeout(function () {
        ui.demos.forEach(function (b) { b.classList.remove("is-playing"); b.setAttribute("aria-pressed", "false"); });
        if (S.demoKind) {
          S.demoKind = null;
          stop();
          S.mode = S.demoReturn || "lesson";
          S.lessonDone = false;
          reset();
          updateLessonStrip();
          updateCoach(true);
        }
      }, 3900);
    });
  });

  /* jog platter: drag horizontally or vertically to shift phase */
  if (ui.platterB) {
    var dragging = false, lastX = 0, lastY = 0;
    ui.platterB.addEventListener("pointerdown", function (e) {
      if (!S.running) return;
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      ui.platterB.setPointerCapture(e.pointerId);
    });
    ui.platterB.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = lastY - e.clientY;
      lastX = e.clientX; lastY = e.clientY;
      nudge((dx + dy) * 1.4, true);
    });
    function endDrag() { dragging = false; }
    ui.platterB.addEventListener("pointerup", endDrag);
    ui.platterB.addEventListener("pointercancel", endDrag);
  }

  /* keyboard */
  document.addEventListener("keydown", function (e) {
    /* Only take over the keyboard once the reader is actually using the lab:
       either focus is inside it, or a deck is already running. Otherwise Space
       and the arrow keys should keep doing what they normally do on a page. */
    var inLab = root.contains(document.activeElement);
    if (!inLab && !S.running) return;
    if (e.target.matches("input, select, textarea, [contenteditable]")) {
      if (e.target === ui.pitch && (e.code === "ArrowUp" || e.code === "ArrowDown")) {
        e.preventDefault();
        if (S.running) S.stats.pitchMoves = (S.stats.pitchMoves || 0) + 1;
        setPitch(S.pitch + (e.code === "ArrowUp" ? 0.02 : -0.02));
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "Space") { e.preventDefault(); if (S.running) stop(); else start(); }
    else if (e.code === "ArrowLeft") { e.preventDefault(); nudge(-22, true); }
    else if (e.code === "ArrowRight") { e.preventDefault(); nudge(22, true); }
    else if (e.code === "ArrowUp") { e.preventDefault(); setPitch(S.pitch + 0.02); }
    else if (e.code === "ArrowDown") { e.preventDefault(); setPitch(S.pitch - 0.02); }
    else if (e.code === "KeyC") { e.preventDefault(); cue(); }
    else if (e.code === "KeyR") { e.preventDefault(); reset(); }
  });

  /* result "next" button */
  if (ui.result) {
    ui.result.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ml-go], [data-ml-retry]");
      if (!btn) return;
      if (btn.hasAttribute("data-ml-retry")) { reset(); start(); return; }
      var go = btn.getAttribute("data-ml-go");
      if (go === "free") {
        S.mode = "free";
        S.lessonDone = false;
        if (ui.level) ui.level.value = "free";
        reset();
        updateLessonStrip();
        updateCoach(true);
      } else {
        setLesson(Number(go));
        if (ui.level) ui.level.value = "lesson" + S.lesson;
      }
    });
  }

  function render() {
    if (ui.bpmA) ui.bpmA.textContent = fmt(S.bpmA, 1);
    setPitch(S.pitch);
    updatePhrase();
    drawTimeline();
  }

  /* Resize handling for the timeline canvas */
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawTimeline, 120);
  });

  /* Boot */
  S.bpmA = GENRES[S.genre].bpm;
  S.baseBpm = S.bpmA;
  if (completed.length) {
    var firstOpen = LESSONS.filter(function (l) { return completed.indexOf(l.id) === -1; })[0];
    if (firstOpen) {
      S.lesson = firstOpen.id;
      if (ui.level) ui.level.value = "lesson" + S.lesson;
      applyBlindUi();
    }
  }
  updateLessonStrip();
  updateProgress();
  updateCoach(true);
  render();

  /* Test hook: lets the automated checks read the same numbers the UI shows. */
  window.__mixlab = {
    state: S,
    metrics: function () {
      return {
        running: S.running, offsetMs: S.offsetMs, tempoDiff: S.tempoDiff,
        locked: S.locked, lesson: S.lesson, mode: S.mode, holdMs: S.holdMs,
        bpmA: S.bpmA, bpmB: currentBpmB(), pitch: S.pitch, lessonDone: S.lessonDone
      };
    },
    setPitch: setPitch, nudge: nudge, cue: cue, start: start, stop: stop, reset: reset,
    demo: demo, setLesson: setLesson
  };
})();
