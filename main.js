// Type for Treat: web page around game.riv.
// Plays the file and keeps the player's progress in this browser's localStorage.
//
// What is saved (all read/written through the game's view model, "Game"):
//   candies, highscore1-3 + highscoreName1-3, ghost bag / cosmetic / isGirl,
//   the typed name, music/sfx mute, and which bags/cosmetics are owned
//   (ownedBags / ownedCosmetics are bit masks the store script keeps up to date).
(function () {
  "use strict";

  var SAVE_KEY = "typeForTreat.save.v1";
  var RIV = "game.riv";

  // [view model path, kind]. kind: "n" number, "s" string, "b" boolean.
  var FIELDS = [
    ["candies", "n"],
    ["highscore1", "n"], ["highscore2", "n"], ["highscore3", "n"],
    ["highscoreName1", "s"], ["highscoreName2", "s"], ["highscoreName3", "s"],
    ["ghost/bag", "n"], ["ghost/cosmetic", "n"], ["ghost/isGirl", "b"],
    ["nameInput/text", "s"],
    ["musicMuted", "b"], ["sfxMuted", "b"],
    ["ownedBags", "n"], ["ownedCosmetics", "n"]
  ];

  // Where each saved value lives in the game's view model (grouped since milestone 14).
  // The localStorage keys above stay the same so older saves keep working.
  var VM_PATH = {
    "candies": "save/candies",
    "highscore1": "save/highscore1", "highscore2": "save/highscore2", "highscore3": "save/highscore3",
    "highscoreName1": "save/highscoreName1", "highscoreName2": "save/highscoreName2", "highscoreName3": "save/highscoreName3",
    "ownedBags": "save/ownedBags", "ownedCosmetics": "save/ownedCosmetics",
    "ghost/bag": "ghost/bag", "ghost/cosmetic": "ghost/cosmetic", "ghost/isGirl": "ghost/isGirl",
    "nameInput/text": "menu/nameInput/text",
    "musicMuted": "audio/musicMuted", "sfxMuted": "audio/sfxMuted"
  };

  var canvas = document.getElementById("game");
  var startOverlay = document.getElementById("start");
  var errorBox = document.getElementById("error");

  function fail(message) {
    errorBox.textContent = message;
    errorBox.style.display = "flex";
    startOverlay.classList.add("hidden");
  }

  // ----- storage (works even when the browser blocks localStorage) -----
  function readSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function writeSave(data) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* private mode / storage full: the game still plays, just without saving */ }
  }

  document.getElementById("reset").addEventListener("click", function () {
    if (window.confirm("Erase your saved candies, highscores and purchases?")) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch (e) {}
      window.location.reload();
    }
  });

  // ----- game -----
  var props = {};      // path -> view model property
  var saveTimer = 0;

  function snapshot() {
    var out = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var p = props[FIELDS[i][0]];
      if (p) out[FIELDS[i][0]] = p.value;
    }
    return out;
  }
  function saveSoon() {
    if (saveTimer) return;
    saveTimer = window.setTimeout(function () {
      saveTimer = 0;
      writeSave(snapshot());
    }, 300);
  }
  function saveNow() {
    if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = 0; }
    writeSave(snapshot());
  }

  function bindProperties(vmi) {
    var saved = readSave();
    for (var i = 0; i < FIELDS.length; i++) {
      var path = FIELDS[i][0], kind = FIELDS[i][1];
      var vmPath = VM_PATH[path] || path;
      var p = kind === "n" ? vmi.number(vmPath) : kind === "s" ? vmi.string(vmPath) : vmi.boolean(vmPath);
      if (!p) { console.warn("Type for Treat: no view model property", path); continue; }
      props[path] = p;
      // Restore first, then listen, so loading is not counted as a change.
      if (Object.prototype.hasOwnProperty.call(saved, path) && typeof saved[path] === typeof p.value) {
        p.value = saved[path];
      }
      p.on(saveSoon);
    }
    saveNow(); // first save also records the defaults
  }

  // Use the runtime files shipped in vendor/ (same version as vendor/rive.js) instead of the CDN,
  // so the shader / GPU features of the game match the runtime that was tested.
  rive.RuntimeLoader.setWasmUrl("vendor/rive.wasm?v=2.44.2");

  var r = null; // the Rive instance (created once game.riv has been downloaded)
  var loaded = false;
  var startLabel = startOverlay.querySelector("p");

  function setStartLabel(text) { if (startLabel) startLabel.textContent = text; }

  // Download game.riv ourselves so the player sees progress (it is ~20 MB) and cannot
  // "click to play" before the game exists.
  setStartLabel("Loading… 0%");
  startOverlay.style.cursor = "progress";
  function download(url, onProgress) {
    return window.fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      var total = parseInt(res.headers.get("Content-Length") || "0", 10);
      if (!res.body || !res.body.getReader) return res.arrayBuffer();
      var reader = res.body.getReader(), chunks = [], got = 0;
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) {
            var out = new Uint8Array(got), pos = 0;
            for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], pos); pos += chunks[i].length; }
            return out.buffer;
          }
          chunks.push(step.value);
          got += step.value.length;
          onProgress(got, total);
          return pump();
        });
      }
      return pump();
    });
  }
  download(RIV, function (got, total) {
    setStartLabel(total ? "Loading… " + Math.min(99, Math.floor(got / total * 100)) + "%"
                        : "Loading… " + (got / 1048576).toFixed(1) + " MB");
  }).then(startRive, function () {
    fail("The game could not be downloaded. Check your connection and reload the page.");
  });

  function startRive(buffer) {
  setStartLabel("Starting…");
  r = new rive.Rive({
    buffer: buffer,
    canvas: canvas,
    artboard: "Game",
    stateMachine: "Game SM",
    autoplay: true,
    autoBind: true,
    enableGPUCanvas: true, // needed for the game's shader effects (fog, lantern glow, fireflies)
    layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
    focusOptions: { allowFocusInterrupt: true },
    onLoad: function () {
      resize();
      var vmi = r.viewModelInstance;
      if (!vmi) { fail("The game file loaded without its data. Please reload the page."); return; }
      bindProperties(vmi);
      loaded = true;
      window.setTimeout(function () {
        setStartLabel("Click to play");
        startOverlay.style.cursor = "pointer";
      }, 400); // let the first frames draw behind the overlay
    },
    onLoadError: function () {
      fail("The game could not be loaded. If you opened index.html by double-clicking it, " +
           "serve the folder instead (see web/README.md).");
    }
  });

  window.tft = { rive: r, props: props }; // handy for debugging in the browser console
  }

  // Cap the drawing surface at ~1920 px wide (1.5x on a retina screen at most). A 4096 px wide
  // surface is heavy on some graphics cards and can leave parts of the scene undrawn.
  function resize() {
    if (!r) return;
    var w = Math.max(1, canvas.getBoundingClientRect().width);
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.max(1, 1920 / w));
    r.resizeDrawingSurfaceToCanvas(dpr);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", function () { if (document.hidden) saveNow(); });

  // A first click is needed anyway: browsers only allow sound after a click or key press,
  // and the canvas must have keyboard focus for the typing and arrow keys.
  startOverlay.addEventListener("click", function () {
    if (!loaded) return; // still downloading / starting
    startOverlay.classList.add("hidden");
    canvas.focus();
    resize();
  });
  canvas.addEventListener("pointerdown", function () { canvas.focus(); });

  // Keep the page from scrolling or using shortcuts while the game has the keys.
  window.addEventListener("keydown", function (e) {
    if (e.key === " " || e.key === "Escape" || e.key.indexOf("Arrow") === 0) {
      if (document.activeElement === canvas) e.preventDefault();
    }
  });
})();
