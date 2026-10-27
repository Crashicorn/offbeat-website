/* Offbeat — DJ software advisor dataset.
 *
 * Every price and licence claim below was read from the vendor's own page on
 * 27 October 2026. Sources:
 *   rekordbox plans ....... https://rekordbox.com/en/plan/
 *   rekordbox unlocks ..... https://rekordbox.com/en/support/hardware-unlock/
 *   Serato Lite ........... https://serato.com/dj/lite
 *   Serato pricing ........ https://serato.com/dj/pro/pricing
 *   Serato hardware ....... https://serato.com/dj/hardware
 *   Traktor Pro 4 ......... https://www.native-instruments.com/products/traktor-pro
 *   Traktor Play .......... https://www.native-instruments.com/products/traktor-play
 *   djay Pro .............. https://www.algoriddim.com/press_releases/448
 *   VirtualDJ licensing ... https://virtualdj.com/buy/
 *   Engine DJ desktop ..... https://enginedj.com/downloads
 *   Mixxx ................. https://mixxx.org/
 *   Spotify mixing ........ https://newsroom.spotify.com/2025-09-24/dj-mix/
 *
 * Where a vendor does not publish something (for example the VirtualDJ
 * Infinity licence price), the value is null and the interface says so rather
 * than guessing. Nothing here is a recommendation by itself: the advisor in
 * software-advisor.js turns these facts plus the visitor's answers into a fit.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- plans --
   * kind: free | lite | subscription | perpetual
   * yearly / monthly: the vendor's own list price in USD, never converted.
   * buyOnce: a perpetual licence price, only where the vendor sells one.
   */
  var DATA = {
    verified: "27 October 2026",

    /* ------------------------------------------------------ questions -- */
    questions: [
      {
        id: "mode",
        label: "How do you want to play?",
        help: "This decides whether a laptop program, a phone app or the hardware itself is running the show.",
        options: [
          { value: "controller", label: "Laptop with a controller" },
          { value: "laptop", label: "Laptop on its own, no controller" },
          { value: "standalone", label: "All-in-one / USB players, no laptop" },
          { value: "mobile", label: "Phone or tablet" },
          { value: "vinyl", label: "Turntables or CDJs through a mixer" },
          { value: "unsure", label: "Not decided yet" }
        ]
      },
      {
        id: "hardware",
        label: "What gear do you own or plan to buy?",
        help: "The model decides whether the software is free, cheap or a paid licence. Pick the closest.",
        options: [
          { value: "none", label: "Nothing yet" },
          { value: "flx4", label: "Pioneer DDJ-FLX4" },
          { value: "flx2", label: "Pioneer DDJ-FLX2" },
          { value: "flx10", label: "Pioneer DDJ-FLX10 / FLX6" },
          { value: "denon", label: "Denon DJ / Engine hardware" },
          { value: "traktor", label: "Traktor Kontrol S2 / S3 / S4" },
          { value: "other", label: "Numark, Hercules, Reloop or Rane" },
          { value: "unsure", label: "Not sure yet" }
        ]
      },
      {
        id: "os",
        label: "What will run the software?",
        help: "Serato and rekordbox are macOS/Windows programs; djay is the only one that treats a tablet as first-class.",
        options: [
          { value: "macos", label: "macOS" },
          { value: "windows", label: "Windows" },
          { value: "ios", label: "iPad or iPhone" },
          { value: "android", label: "Android" },
          { value: "linux", label: "Linux" }
        ]
      },
      {
        id: "music",
        label: "Where does your music come from?",
        help: "Streaming is not the same as owning files: it changes what you can record, and which software will even run.",
        options: [
          { value: "local", label: "Files I own or have downloaded" },
          { value: "streaming", label: "Mostly streaming" },
          { value: "both", label: "Both, about evenly" }
        ]
      },
      {
        id: "budget",
        label: "How do you want to pay?",
        help: "No answer is wrong. It only changes which routes are shown first.",
        options: [
          { value: "free", label: "Free if at all possible" },
          { value: "once", label: "One-off purchase, no subscription" },
          { value: "sub", label: "A subscription is fine" },
          { value: "unsure", label: "Not sure" }
        ]
      },
      {
        id: "needs",
        label: "Which of these do you need?",
        help: "Choose any that matter. Each one has a licence cost on some platforms and none on others.",
        multi: true,
        options: [
          { value: "cdj", label: "Prepare USB sticks for club CDJs" },
          { value: "recording", label: "Record my mixes" },
          { value: "stems", label: "Stems / vocal isolation" },
          { value: "dvs", label: "Timecode vinyl (DVS)" },
          { value: "fourdecks", label: "Four decks or remix decks" },
          { value: "video", label: "Video or karaoke output" }
        ]
      },
      {
        id: "scene",
        label: "What are you aiming at?",
        help: "Optional, but it changes which strengths are worth mentioning.",
        options: [
          { value: "club", label: "Club and booth work" },
          { value: "home", label: "Home mixing and practice" },
          { value: "scratch", label: "Scratch and open format" },
          { value: "events", label: "Parties, weddings and mobile work" },
          { value: "produce", label: "Making edits and producing" },
          { value: "unsure", label: "Not sure yet" }
        ]
      }
    ],

    /* -------------------------------------------------- hardware unlocks --
     * unlocks[platformId]:
     *   "hu"          rekordbox Hardware Unlock — listed gear runs the paid
     *                 plan's features while connected
     *   "lite"        Serato DJ Lite is the free tier this hardware triggers
     *   "pro"         this hardware unlocks the full paid Serato licence
     *   "os"          Engine DJ desktop is the free tool for this hardware
     *   "play"        Traktor Play is bundled or plug-and-play with this gear
     *   "unknown"     the vendor lists per-model behaviour we have not verified
     */
    hardware: {
      none: { label: "No hardware yet", unlocks: {} },
      flx4: {
        label: "DDJ-FLX4",
        unlocks: { rekordbox: "hu", serato: "lite", traktor: "play" },
        note: "On rekordbox's Hardware Unlock list, on Serato's Lite campaign list, and plug-and-play with Traktor Play."
      },
      flx2: {
        label: "DDJ-FLX2",
        unlocks: { rekordbox: "hu", traktor: "play" },
        note: "On rekordbox's Hardware Unlock list and plug-and-play with Traktor Play. Check Serato's own list before assuming Lite."
      },
      flx10: {
        label: "DDJ-FLX10 / FLX6",
        unlocks: { rekordbox: "hu", serato: "unknown" },
        note: "On rekordbox's Hardware Unlock list. Serato's per-model licence tier for this unit has not been verified here."
      },
      denon: {
        label: "Denon DJ / Engine hardware",
        unlocks: { engine: "os" },
        note: "Engine DJ desktop is free and is the preparation tool for Engine OS players."
      },
      traktor: {
        label: "Traktor Kontrol controller",
        unlocks: { traktor: "unknown" },
        note: "Traktor Kontrol hardware is built around Traktor. Bundled-licence terms differ by model, so check the box or the retailer listing."
      },
      other: {
        label: "Numark / Hercules / Reloop / Rane",
        unlocks: {},
        note: "Entry controllers in this group usually unlock Serato DJ Lite or VirtualDJ Home, but it varies per model."
      },
      unsure: { label: "Not sure yet", unlocks: {}, note: "" }
    },

    /* --------------------------------------------------------- platforms -- */
    platforms: [
      {
        id: "rekordbox",
        name: "rekordbox",
        maker: "AlphaTheta (Pioneer DJ)",
        url: "https://rekordbox.com/en/plan/",
        review: "rekordbox-review.html",
        os: ["macos", "windows", "ios", "android"],
        desktopOS: ["macos", "windows"],
        modes: ["controller", "laptop", "standalone", "vinyl", "mobile", "unsure"],
        plans: [
          { id: "free", label: "Free", kind: "free", monthly: 0, yearly: 0 },
          { id: "core", label: "Core", kind: "subscription", monthly: 12, yearly: 120 },
          { id: "creative", label: "Creative", kind: "subscription", monthly: 18, yearly: 180 },
          { id: "professional", label: "Professional", kind: "subscription", monthly: 36, yearly: 360 }
        ],
        perpetual: false,
        freeNote: "Library management, analysis, cue points and USB export, plus Performance mode while Hardware Unlock gear is connected.",
        caps: {
          cdj: { plan: "free", note: "Exporting rekordbox-format USB sticks is free; the format is what club CDJs read." },
          recording: { plan: "core", note: "Recording and mix sharing are listed on Core and above, not on the Free plan." },
          stems: { plan: "core", note: "Stem playback is a paid-plan feature." },
          dvs: { plan: "core", note: "DVS needs a paid plan as well as a device on rekordbox's Hardware Unlock DVS list.", check: "Your device in the DVS column of rekordbox's Hardware Unlock list." },
          fourdecks: { plan: "free", note: "Performance mode gives you the decks, but on the Free plan only while unlock gear is connected.", hardwareDependent: true },
          video: { plan: "core", note: "Video output is listed on the paid plans; the Free plan shows a caution overlay." }
        },
        mobile: { plan: "free", check: "What the rekordbox mobile app allows on your free account compared with the desktop app." },
        streaming: ["Beatport", "Beatsource", "SoundCloud", "TIDAL", "Apple Music", "Spotify"],
        streamingNote: "Spotify, Apple Music and the rest need their own subscription and are licensed for personal, non-commercial use.",
        strengths: [
          "The USB export format club CDJs read, so set preparation works even on the Free plan.",
          "Hardware Unlock means listed controllers run Performance mode without a subscription.",
          "Library, analysis and cue points carry over to whatever plan you hold."
        ],
        watchOuts: [
          "There is no perpetual licence: three years of Core is $360.",
          "The unlock is per feature, so DVS or video may still need a paid plan on unlock-listed gear.",
          "A cancelled Core or Creative subscription cannot simply be re-started."
        ],
        verify: "Whether your exact controller appears on the Hardware Unlock list, and which features it unlocks."
      },
      {
        id: "serato",
        name: "Serato DJ",
        maker: "Serato",
        url: "https://serato.com/dj/pro/pricing",
        review: "serato-dj-pro-review.html",
        os: ["macos", "windows", "ios"],
        desktopOS: ["macos", "windows"],
        modes: ["controller", "laptop", "vinyl", "standalone", "mobile", "unsure"],
        plans: [
          { id: "lite", label: "DJ Lite", kind: "lite", monthly: 0, yearly: 0 },
          { id: "pro", label: "DJ Pro", kind: "perpetual", monthly: 11.99, yearly: 143.88, buyOnce: 299 },
          { id: "suite", label: "DJ Suite", kind: "perpetual", monthly: 14.99, yearly: 179.88, buyOnce: 499 }
        ],
        perpetual: true,
        freeNote: "DJ Lite is a real free tier with 50+ supported controllers, Stems and streaming — no licence key.",
        caps: {
          cdj: { plan: null, note: "Serato is a performance environment: it does not write rekordbox-format sticks for club CDJs." },
          recording: { plan: "pro", note: "Recording a mix needs a Pro or Suite licence." },
          stems: { plan: "lite", note: "Stems is included in DJ Lite, which is unusual at this price." },
          dvs: { plan: "suite", note: "DVS is a Suite feature, not part of Lite or Pro.", check: "Whether the hardware you own provides DVS without the Suite expansion." },
          fourdecks: { plan: "pro", note: "Lite runs two decks; four need DJ Pro." },
          video: { plan: "suite", note: "Video is a Suite feature." }
        },
        mobile: { plan: "suite", note: "Serato DJ for iOS is part of DJ Suite, not DJ Pro and not the free app.", check: "The current Serato DJ for iOS feature limits on your device." },
        streaming: ["Apple Music", "Spotify", "TIDAL", "SoundCloud", "Beatport"],
        streamingNote: "Streamed tracks cannot be recorded, and Apple Music streaming tracks cannot be used with Stems.",
        strengths: [
          "A genuine buy-once Pro licence at $299 — cheaper than three years of subscription rivals.",
          "Lite is a real free tier, not a demo, and already includes Stems.",
          "The reference platform for scratch and open-format work."
        ],
        watchOuts: [
          "Most entry controllers unlock Lite, not Pro: the $299 or $11.99/mo step is the one people miss.",
          "DVS lives in Suite, not Pro.",
          "Serato DJ for iOS is part of Suite, not a separate cheap app."
        ],
        verify: "Whether your controller unlocks Lite, Pro or nothing on Serato's own hardware list."
      },
      {
        id: "traktor",
        name: "Traktor",
        maker: "Native Instruments",
        url: "https://www.native-instruments.com/products/traktor-pro",
        review: "traktor-pro-review.html",
        os: ["macos", "windows"],
        desktopOS: ["macos", "windows"],
        modes: ["controller", "laptop", "vinyl", "unsure"],
        plans: [
          { id: "play", label: "Traktor Play", kind: "perpetual", monthly: null, yearly: null, buyOnce: 49 },
          { id: "pro", label: "Traktor Pro 4", kind: "perpetual", monthly: null, yearly: null, buyOnce: 149 }
        ],
        perpetual: true,
        freeNote: "There is no free tier. Traktor Play is the $49 two-deck edition.",
        caps: {
          cdj: { plan: null, note: "Traktor does not export rekordbox-format sticks; club prep is not its job." },
          recording: { plan: "pro", note: "Traktor Play cannot record a mix; Pro 4 can." },
          stems: { plan: "play", note: "Play separates drums; Pro 4 adds full stem decks." },
          dvs: { plan: "pro", note: "DVS is part of Pro 4." },
          fourdecks: { plan: "pro", note: "Play is two decks; four decks are Pro 4." },
          video: { plan: null, note: "Traktor has no video output." }
        },
        streaming: ["Beatport"],
        streamingNote: "Play streams Beatport only; Pro 4 adds the rest of the Beatport catalogue integration. Local files are the main event.",
        strengths: [
          "One payment, owned: $149 for Pro 4 is the cheapest full-feature licence here.",
          "Four decks, deep effects routing and stem decks appeal to producer-DJs.",
          "Play at $49 upgrades to Pro 4 for the difference, so the cheap step is not wasted."
        ],
        watchOuts: [
          "No free tier at all — this is money on day one.",
          "Narrowest hardware list of the major platforms.",
          "Beatport is the only streaming service.",
          "Play cannot record."
        ],
        verify: "Which licence, if any, is bundled with the hardware you are looking at."
      },
      {
        id: "djay",
        name: "djay",
        maker: "Algoriddim",
        url: "https://www.algoriddim.com/press_releases/448",
        review: "djay-pro-review.html",
        os: ["macos", "windows", "ios", "android"],
        desktopOS: ["macos", "windows"],
        modes: ["controller", "laptop", "mobile", "vinyl", "unsure"],
        plans: [
          { id: "free", label: "Free app", kind: "free", monthly: 0, yearly: 0 },
          { id: "pro", label: "djay Pro", kind: "subscription", monthly: 6.99, yearly: 49.99 }
        ],
        perpetual: false,
        freeNote: "The app is free to download and use with limits; the Pro subscription unlocks recording, full Neural Mix and the rest.",
        caps: {
          cdj: { plan: null, note: "djay does not write rekordbox-format sticks for club CDJs." },
          recording: { plan: "pro", note: "Recording needs the Pro subscription, and streamed tracks cannot be recorded at all." },
          stems: { plan: "pro", note: "Neural Mix is a Pro feature and is unavailable on Apple Music or Spotify tracks." },
          dvs: { plan: "pro", note: "DVS is a Pro feature and needs compatible timecode hardware.", check: "Whether djay supports your timecode interface on your platform." },
          fourdecks: { plan: "pro", note: "Four decks are a Pro feature." },
          video: { plan: "pro", note: "Video mixing is a Pro feature." }
        },
        mobile: { plan: "free", check: "Which features the free app leaves out on your phone or tablet." },
        streaming: ["Apple Music", "Spotify", "TIDAL", "SoundCloud", "Beatport"],
        streamingNote: "Streamed songs cannot be recorded, and Neural Mix is unavailable with Apple Music or Spotify.",
        strengths: [
          "One $49.99/yr subscription covers Mac, iPad, iPhone, Android and Windows.",
          "The only one of these designed for a phone or tablet first.",
          "Best-in-class touch interface and Automix for parties."
        ],
        watchOuts: [
          "No perpetual licence.",
          "Streaming and Neural Mix do not mix: Apple Music and Spotify tracks cannot be separated.",
          "Controller support is wide but not universal."
        ],
        verify: "Whether your controller appears in djay's hardware list, and that your streaming service is supported where you live."
      },
      {
        id: "virtualdj",
        name: "VirtualDJ",
        maker: "Atomix",
        url: "https://virtualdj.com/buy/",
        review: "virtual-dj-vs-serato.html",
        os: ["macos", "windows"],
        desktopOS: ["macos", "windows"],
        modes: ["controller", "laptop", "unsure"],
        plans: [
          { id: "free", label: "Free", kind: "free", monthly: 0, yearly: 0 },
          { id: "home", label: "Home", kind: "subscription", monthly: 4, yearly: 44 },
          { id: "pro", label: "Pro", kind: "subscription", monthly: 19, yearly: 199 },
          { id: "business", label: "Business", kind: "subscription", monthly: 99, yearly: 999 }
        ],
        perpetual: false,
        buyOnceNote: "Atomix still sells an Infinity licence, but its price is not published on the buy page and it excludes some newer AI features — ask the vendor rather than budgeting for it.",
        freeNote: "Free only without a controller or mixer, and not for paid work. Add hardware and Home or Pro is required.",
        caps: {
          cdj: { plan: null, note: "VirtualDJ does not write rekordbox-format sticks for club CDJs." },
          recording: { plan: "pro", note: "Recording needs Pro; Home cannot record or output video." },
          stems: { plan: "pro", note: "Audio stem separation needs Pro." },
          dvs: { plan: "pro", note: "Timecode control needs Pro." },
          fourdecks: { plan: "pro", note: "Four decks need Pro." },
          video: { plan: "pro", note: "Video output needs Pro; Home and the free edition cannot output video." }
        },
        streaming: ["Spotify", "TIDAL", "SoundCloud", "Beatport", "Deezer"],
        streamingNote: "Streaming arrived in September 2026 and is for personal use only.",
        strengths: [
          "Widest hardware and file-format support of anything here.",
          "Karaoke, video and controller breadth make it the mobile-DJ default.",
          "Home at $4/mo is the cheapest paid entry on this page."
        ],
        watchOuts: [
          "The free edition does not cover controller use at all.",
          "Home keeps the audio branding and cannot be used at paid gigs.",
          "The Infinity perpetual licence excludes some newer AI features, and its price is not published on the buy page."
        ],
        verify: "Which controllers Home supports, and whether your gigs count as commercial use under the licence."
      },
      {
        id: "engine",
        name: "Engine DJ",
        maker: "inMusic (Denon DJ)",
        url: "https://enginedj.com/downloads",
        review: "best-standalone-dj-systems.html",
        os: ["macos", "windows"],
        desktopOS: ["macos", "windows"],
        modes: ["standalone", "controller", "unsure"],
        plans: [{ id: "free", label: "Free desktop", kind: "free", monthly: 0, yearly: 0 }],
        perpetual: false,
        freeNote: "The desktop app is free. The software that actually plays is Engine OS, which is built into the hardware.",
        caps: {
          cdj: { plan: null, note: "Engine writes Engine-format media for Denon and Numark players, not rekordbox sticks for CDJs." },
          recording: { plan: "none", note: "Recording happens on the Engine hardware, not in the desktop app." },
          stems: { plan: "none", note: "Stems are handled on the player, and only on models that support them." },
          dvs: { plan: "none", note: "Engine is not a DVS system." },
          fourdecks: { plan: "free", note: "Deck count is a property of the hardware you buy." },
          video: { plan: null, note: "No video output." }
        },
        streaming: [],
        streamingNote: "Engine OS can stream on supported players; the desktop app is for preparation.",
        strengths: [
          "Free, and it is the tool your Denon or Numark hardware is designed around.",
          "Preparation, playlists analysis and export all happen before you leave the house.",
          "No subscription, ever."
        ],
        watchOuts: [
          "It is not a laptop performance app — Engine OS runs on the player.",
          "It cannot prepare sticks for Pioneer CDJs.",
          "Feature support depends on which Engine player you own."
        ],
        verify: "Which Engine OS features your specific player supports."
      },
      {
        id: "mixxx",
        name: "Mixxx",
        maker: "Mixxx (open source)",
        url: "https://mixxx.org/",
        review: "best-free-dj-software-2026.html",
        os: ["macos", "windows", "linux"],
        desktopOS: ["macos", "windows", "linux"],
        modes: ["controller", "laptop", "vinyl", "unsure"],
        plans: [{ id: "free", label: "Free", kind: "free", monthly: 0, yearly: 0 }],
        perpetual: true,
        freeNote: "Everything is free, including recording and four decks. No account, no licence key.",
        caps: {
          cdj: { plan: null, note: "Mixxx does not write rekordbox-format sticks." },
          recording: { plan: "free", note: "Recording is included." },
          stems: { plan: null, note: "No built-in stem separation." },
          dvs: { plan: "free", note: "Timecode vinyl control is included, but needs a suitable audio interface and control records." },
          fourdecks: { plan: "free", note: "Four decks are included." },
          video: { plan: null, note: "No video output." }
        },
        streaming: [],
        streamingNote: "No Apple Music, Spotify or TIDAL integration — it plays files you own.",
        strengths: [
          "Genuinely free, including recording and four decks.",
          "Runs on Linux as well as macOS and Windows.",
          "Nothing to cancel and no library to lose if you stop."
        ],
        watchOuts: [
          "No streaming services at all.",
          "Controller mappings are community-maintained, so pads, jogs and displays vary by model.",
          "No stem separation and no video."
        ],
        verify: "Whether a community mapping exists for your controller, and how complete it is."
      }
    ]
  };

  window.OffbeatSoftwareData = DATA;
})();
