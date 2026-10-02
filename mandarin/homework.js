/* Weekly homework page: checklist, character flashcards with speaking practice,
   and a 30-second math facts drill. Everything runs in the browser — no
   server, no paid APIs. Progress lives in this device's localStorage. */
(function () {
  "use strict";

  var cfg = JSON.parse(document.getElementById("week").textContent);
  var deck = window.MANDARIN_DECKS[cfg.deck];
  var HOMO = window.MANDARIN_HOMOPHONES || {};
  var CARDS = deck.cards.filter(function (c) { return cfg.sheets.indexOf(c.sheet) !== -1; });

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // ---------- storage (never trusted to exist: private mode, blocked storage) ----------
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* page still works, just won't remember */ } }
  };
  var PKEY = "mandarin.progress." + cfg.deck;   // per character, shared across weeks
  var WKEY = "mandarin.week." + cfg.week;       // checklist ticks for this week
  var DKEY = "mandarin.drill";                  // best scores + practice days
  var progress = store.get(PKEY, {});
  var weekState = store.get(WKEY, { manual: {} });
  var drillState = store.get(DKEY, { best: {}, days: {} });

  // ---------- icons (inline, outline style) ----------
  var P = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    shuffle: '<path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3-1.5 4-3M14 9.5c1-1.5 2-2.5 4-2.5h3M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    flip: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 6 17.4L4.3 14a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
    again: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/>',
    go: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function icon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + "</svg>";
  }

  // ---------- progress ----------
  function statusOf(c) { return progress[c.c] ? progress[c.c].st : "new"; }
  function setStatus(c, st, by) {
    if (st === "new") delete progress[c.c];
    else progress[c.c] = { st: st, by: by || "self", t: new Date().toISOString() };
    store.set(PKEY, progress);
    renderGrid();
    renderTasks();
  }
  function doneCount() { return CARDS.filter(function (c) { return statusOf(c) === "done"; }).length; }

  // ---------- checklist ----------
  function practiceDays() { return Object.keys(drillState.days || {}).filter(function (d) { return d >= cfg.week; }).length; }

  function renderTasks() {
    var box = $("#tasks");
    box.innerHTML = "";
    cfg.tasks.forEach(function (t) {
      var auto = false, meta = t.meta || "", go = null;
      if (t.type === "flashcards") {
        var n = doneCount();
        auto = n === CARDS.length;
        meta = n + " / " + CARDS.length + " · " + (t.meta || "");
        go = "#chars";
      } else if (t.type === "drill") {
        var days = practiceDays(), goal = t.days || 5;
        auto = days >= goal;
        var dots = "";
        for (var i = 0; i < goal; i++) dots += '<i class="' + (i < days ? "on" : "") + '"></i>';
        meta = (t.meta || "") + ' <span class="days" aria-label="' + days + " of " + goal + ' days">' + dots + "</span>";
        go = "#drill";
      }
      var done = auto || !!weekState.manual[t.id];
      var row = el("div", "task" + (done ? " done" : ""));
      var check = el("button", "check", icon("check"));
      check.setAttribute("aria-label", done ? "Done" : "Mark done");
      check.setAttribute("aria-pressed", String(done));
      check.addEventListener("click", function () {
        if (auto) return;
        weekState.manual[t.id] = !weekState.manual[t.id];
        store.set(WKEY, weekState);
        renderTasks();
      });
      var body = el("div", "body");
      body.appendChild(el("div", "title", '<span class="zh">' + t.zh + "</span>" + t.en));
      body.appendChild(el("div", "meta", meta));
      if (t.steps) {
        var det = el("details");
        det.appendChild(el("summary", null, t.stepsLabel || "How"));
        var ol = el("ol", "steps");
        t.steps.forEach(function (s) { ol.appendChild(el("li", null, s)); });
        det.appendChild(ol);
        body.appendChild(det);
      }
      row.appendChild(check);
      row.appendChild(body);
      if (go) {
        var a = el("a", "go", icon("go"));
        a.href = go;
        a.setAttribute("aria-label", "Go to " + t.en);
        row.appendChild(a);
      }
      box.appendChild(row);
    });
  }

  // ---------- character grid ----------
  var filter = "all";
  var shuffled = null;  // array of indexes when shuffled

  function visibleCards() {
    var order = shuffled ? shuffled.map(function (i) { return CARDS[i]; }) : CARDS.slice();
    if (filter === "all") return order;
    return order.filter(function (c) {
      var s = statusOf(c);
      return filter === "done" ? s === "done" : s !== "done";
    });
  }

  function renderGrid() {
    var counts = { all: CARDS.length, learning: CARDS.length - doneCount(), done: doneCount() };
    Array.prototype.forEach.call(document.querySelectorAll("[data-filter]"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
      $(".n", b).textContent = counts[b.dataset.filter];
    });
    var grid = $("#char-grid");
    grid.innerHTML = "";
    var list = visibleCards();
    if (!list.length) {
      grid.appendChild(el("p", "empty", filter === "done" ? "Say a character to fill this up." : "全部会了！ Every character is done."));
      return;
    }
    list.forEach(function (c, i) {
      var st = statusOf(c);
      var b = el("button", "tile " + (st === "new" ? "" : st), c.c);
      b.setAttribute("aria-label", c.c + " " + c.py + (st === "done" ? ", done" : st === "learning" ? ", still learning" : ""));
      if (st === "done") b.insertAdjacentHTML("beforeend", icon(progress[c.c].by === "heard" ? "mic" : "hand", "badge"));
      b.addEventListener("click", function () { openCard(list, i); });
      grid.appendChild(b);
    });
  }

  document.addEventListener("click", function (e) {
    var f = e.target.closest("[data-filter]");
    if (f) { filter = f.dataset.filter; renderGrid(); }
  });
  $("#shuffle").addEventListener("click", function () {
    if (shuffled) { shuffled = null; }
    else {
      shuffled = CARDS.map(function (_, i) { return i; });
      for (var i = shuffled.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
    }
    $("#shuffle").setAttribute("aria-pressed", String(!!shuffled));
    renderGrid();
  });

  // ---------- audio helpers ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var srBroken = false;       // recognition unavailable on this device (e.g. Dictation off)
  var noConcurrent = false;   // this browser can't record and recognize at the same time
  var player = new Audio();
  var actx = null;
  var zhVoice = null;
  var SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    var vs = speechSynthesis.getVoices();
    zhVoice = vs.filter(function (v) { return /^zh[-_]CN/i.test(v.lang); })[0] ||
              vs.filter(function (v) { return /^(zh|cmn)/i.test(v.lang) && !/HK|yue/i.test(v.lang); })[0] || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  // Called synchronously inside a tap so iPad Safari allows sound later on.
  function unlockAudio() {
    try { player.src = SILENT; var p = player.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !actx) actx = new AC();
      if (actx && actx.state === "suspended") actx.resume();
    } catch (e) {}
    try { if ("speechSynthesis" in window && !speechSynthesis.speaking) { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
  }

  function say(text) {
    return new Promise(function (resolve) {
      if (!("speechSynthesis" in window)) { resolve(false); return; }
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      if (zhVoice) u.voice = zhVoice;
      u.rate = 0.7;
      var finished = false;
      var end = function (ok) { if (!finished) { finished = true; resolve(ok); } };
      u.onend = function () { end(true); };
      u.onerror = function () { end(false); };
      speechSynthesis.speak(u);
      setTimeout(function () { end(true); }, 3500);
    });
  }

  function playBlob(blob) {
    return new Promise(function (resolve) {
      if (!blob) { resolve(false); return; }
      var finished = false;
      var done = function () {
        if (finished) return;
        finished = true;
        player.onended = player.onerror = player.onpause = null;
        resolve(true);
      };
      player.onended = done;
      player.onerror = done;
      player.onpause = done;
      player.src = URL.createObjectURL(blob);
      var p = player.play();
      if (p && p.catch) p.catch(function () { done(); });
      setTimeout(done, 6000);
    });
  }

  function chime() {
    if (!actx) return;
    try {
      [660, 990].forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.12;
        o.frequency.value = f; o.type = "sine";
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.4);
      });
    } catch (e) {}
  }

  // Starts listening immediately — call it inside the tap, or iPad Safari may refuse.
  // Returns { done: Promise<{texts}|{error}>, cancel() }.
  function recognize() {
    var r, finished = false, timer = null, grace = null, resolveFn;
    var done = new Promise(function (res) { resolveFn = res; });
    function finish(v) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(grace);
      try { if (r) r.abort(); } catch (e) {}
      resolveFn(v);
    }
    var handle = { done: done, cancel: function () { finish({ error: "cancelled" }); } };
    try { r = new SR(); } catch (e) { finish({ error: "unsupported" }); return handle; }
    r.lang = "zh-CN";
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 5;
    r.onresult = function (e) {
      var texts = [];
      for (var i = 0; i < e.results.length; i++)
        for (var j = 0; j < e.results[i].length; j++) texts.push(e.results[i][j].transcript);
      finish({ texts: texts });
    };
    r.onerror = function (e) { finish({ error: e.error || "error" }); };
    r.onend = function () { finish({ error: "no-speech" }); };
    // After 7s ask for whatever it heard (Safari may only deliver a result on stop), then give up.
    timer = setTimeout(function () {
      try { r.stop(); } catch (e) {}
      grace = setTimeout(function () { finish({ error: "no-speech" }); }, 1500);
    }, 7000);
    try { r.start(); } catch (e) { finish({ error: "start-failed" }); }
    return handle;
  }

  // A heard character counts if it IS the card, or sounds the same ignoring tone.
  var DIGITS = "零一二三四五六七八九";
  function heardMatch(texts, c) {
    var ok = {};
    ok[c.c] = true;
    c.s.forEach(function (s) { (HOMO[s] || "").split("").forEach(function (ch) { ok[ch] = true; }); });
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i].replace(/[0-9]/g, function (d) { return DIGITS[d]; });
      for (var k = 0; k < t.length; k++) if (ok[t[k]]) return t[k];
    }
    return null;
  }
  function firstHan(texts) {
    for (var i = 0; i < texts.length; i++) {
      var m = texts[i].match(/[㐀-鿿]/);
      if (m) return m[0];
    }
    return "";
  }

  // ---------- big card ----------
  var ov = $("#overlay");
  var cardEl = $("#card");
  var statusEl = $("#status");
  var micBtn = $("#mic");
  var list = [], idx = 0, busy = false, lastBlob = null, advanceTimer = null, returnFocus = null;

  function openCard(l, i) {
    list = l.slice();
    idx = i;
    returnFocus = document.activeElement;
    ov.hidden = false;
    document.body.style.overflow = "hidden";
    showCard();
    $("#close").focus();
  }
  function closeCard() {
    clearTimeout(advanceTimer);
    cancelAttempt();
    try { player.pause(); } catch (e) {}
    try { speechSynthesis.cancel(); } catch (e) {}
    ov.hidden = true;
    document.body.style.overflow = "";
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  function showCard() {
    clearTimeout(advanceTimer);
    var c = list[idx];
    lastBlob = null;
    cardEl.classList.remove("flipped");
    cardEl.classList.toggle("is-done", statusOf(c) === "done");
    cardEl.classList.toggle("is-learning", statusOf(c) === "learning");
    $("#front-char").textContent = c.c;
    $("#back-char").textContent = c.c;
    $("#back-py").textContent = c.py;
    $("#back-en").textContent = c.en;
    $("#back-built").textContent = c.built;
    $("#back-rad").textContent = "部首 " + c.rad;
    $("#count").textContent = (idx + 1) + " / " + list.length;
    idleStatus();
  }

  function setMsg(kind, html) {
    statusEl.className = "status" + (kind ? " " + kind : "");
    statusEl.innerHTML = html;
  }

  function idleStatus() {
    var c = list[idx], st = statusOf(c);
    var html = '<div class="row">';
    if (st !== "done") html += '<button class="pill yes" data-act="know">' + icon("check") + '<span class="zh">我会了</span></button>';
    if (st !== "learning") html += '<button class="pill" data-act="learning"><span class="zh">还在学</span></button>';
    html += "</div>";
    setMsg("", html);
  }

  statusEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var c = list[idx], act = b.dataset.act;
    if (act === "know") { setStatus(c, "done", "self"); celebrate(); cardEl.classList.add("is-done"); cardEl.classList.remove("is-learning"); idleStatus(); }
    else if (act === "learning") { setStatus(c, "learning"); cardEl.classList.add("is-learning"); cardEl.classList.remove("is-done"); idleStatus(); }
    else if (act === "mine") { unlockAudio(); playBlob(lastBlob); }
    else if (act === "teacher") { unlockAudio(); say(c.c); }
  });

  function go(d) {
    var n = idx + d;
    if (n < 0 || n >= list.length) return;
    cancelAttempt();
    idx = n;
    showCard();
  }

  function celebrate() {
    chime();
    var b = el("div", "burst");
    var colors = ["#3d6b4f", "#e2b25c", "#b5432f", "#5b8fd6", "#8fbf9f"];
    for (var i = 0; i < 14; i++) {
      var dot = el("i");
      var a = (i / 14) * Math.PI * 2, r = 120 + Math.random() * 60;
      dot.style.background = colors[i % colors.length];
      dot.style.setProperty("--x", Math.cos(a) * r + "px");
      dot.style.setProperty("--y", Math.sin(a) * r + "px");
      b.appendChild(dot);
    }
    cardEl.appendChild(b);
    setTimeout(function () { b.remove(); }, 900);
  }

  function startRecorder(stream) {
    if (!window.MediaRecorder) return null;
    try {
      var chunks = [];
      var rec = new MediaRecorder(stream);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      var stopped = new Promise(function (res) {
        rec.onstop = function () { res(chunks.length ? new Blob(chunks, { type: rec.mimeType || "audio/mp4" }) : null); };
      });
      rec.start();
      return { stop: function () { try { if (rec.state !== "inactive") rec.stop(); } catch (e) {} return stopped; } };
    } catch (e) { return null; }
  }

  // Tracks the loudest moment of our copy of the mic, to notice a recording that came out silent.
  function meter(stream, L) {
    if (!actx) return;
    try {
      var src = actx.createMediaStreamSource(stream), an = actx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      var buf = new Float32Array(an.fftSize);
      L.meterTimer = setInterval(function () {
        an.getFloatTimeDomainData(buf);
        for (var i = 0; i < buf.length; i++) { var v = Math.abs(buf[i]); if (v > L.peak) L.peak = v; }
      }, 80);
      L.metered = true;
    } catch (e) {}
  }

  function stopStream(stream) { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); }

  var attemptId = 0, live = null, notAllowed = 0;

  function micUI(on) {
    micBtn.classList.toggle("listening", on);
    micBtn.setAttribute("aria-label", on ? "Listening" : "Say it");
  }

  function releaseLive(L) {
    if (!L) return;
    clearInterval(L.meterTimer);
    if (L.rec) L.rec.cancel();
    if (L.recorder) L.recorder.stop();
    stopStream(L.stream);
    if (live === L) live = null;
  }

  // Stop listening right away (card closed, next card, or Hear tapped).
  function cancelAttempt() {
    if (!busy) return;
    attemptId++;
    releaseLive(live);
    busy = false;
    micUI(false);
  }

  async function attempt() {
    if (busy) return;
    var c = list[idx], my = ++attemptId;
    var stale = function () { return my !== attemptId; };
    clearTimeout(advanceTimer);
    busy = true;
    micUI(true);
    setMsg("", '<span class="zh">请说</span><span>Say it now</span>');
    try { player.pause(); } catch (e) {}
    try { speechSynthesis.cancel(); } catch (e) {}
    lastBlob = null;

    var canCheck = !!SR && !srBroken;
    var L = live = { rec: canCheck ? recognize() : null, stream: null, recorder: null, muted: false, peak: 0, metered: false };

    var micOk = true;
    if (!canCheck || !noConcurrent) {
      try {
        L.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (stale()) { stopStream(L.stream); return; }
        L.stream.getAudioTracks().forEach(function (t) { t.onmute = t.onended = function () { L.muted = true; }; });
        L.recorder = startRecorder(L.stream);
        meter(L.stream, L);
      } catch (e) { micOk = false; }
    }

    var result;
    if (!canCheck) result = micOk ? (await wait(2500), { selfCheck: true }) : { error: "mic-denied" };
    else result = await L.rec.done;
    if (stale()) return;

    clearInterval(L.meterTimer);
    if (L.recorder) {
      var blob = await L.recorder.stop();
      if (stale()) return;
      // Some iPads hand the mic to the recognizer and our copy goes quiet. If she was heard but the
      // recording is silent, stop recording alongside recognition from now on.
      var silent = L.muted || !blob || blob.size < 1000 || (L.metered && L.peak < 0.01);
      if (canCheck && result.texts && silent) noConcurrent = true;
      lastBlob = silent ? null : blob;
    }
    stopStream(L.stream);
    if (live === L) live = null;
    if (canCheck && result.error === "not-allowed" && !micOk) result = { error: "mic-denied" };
    finishAttempt(c, result);
  }

  function finishAttempt(c, result) {
    busy = false;
    micUI(false);
    if (c !== list[idx] || ov.hidden || result.error === "cancelled") return;
    var tryAgain = "<span>Tap the microphone and try again.</span>";

    if (result.error === "mic-denied") {
      setMsg("err", '<span class="zh">麦克风关了</span><span>The microphone is off. Ask a grown-up to allow it.</span>');
      return;
    }
    if (result.error === "not-allowed" || result.error === "start-failed") notAllowed++;
    if (result.error === "service-not-allowed" || result.error === "unsupported" || notAllowed >= 2) {
      // Recognition itself is off (on iPad: Dictation). Fall back to listen-and-compare.
      srBroken = true;
      showNotice("Speech checking isn't working on this device, so she'll compare her voice with the teacher's and decide. On iPad, a grown-up can check Settings → General → Keyboard → Enable Dictation, then reload.");
      setMsg("try", tryAgain);
      return;
    }
    if (result.error === "not-allowed" || result.error === "start-failed") { setMsg("try", tryAgain); return; }
    if (result.error === "audio-capture") { noConcurrent = true; setMsg("try", tryAgain); return; }
    if (result.error === "network") {
      srBroken = true;
      showNotice("Speech checking needs an internet connection. Until it's back, she'll compare her voice with the teacher's and decide.");
      setMsg("try", tryAgain);
      return;
    }
    if (result.error) {
      setMsg("try", '<span class="zh">没听到</span><span>I didn\'t hear you — tap the microphone and say it.</span>');
      return;
    }

    if (result.selfCheck) { compare(c, null); return; }

    if (heardMatch(result.texts, c)) {
      setStatus(c, "done", "heard");
      cardEl.classList.add("is-done");
      cardEl.classList.remove("is-learning");
      celebrate();
      setMsg("good", '<span class="zh">对了！' + c.c + " " + c.py + "</span>");
      if (idx < list.length - 1) advanceTimer = setTimeout(function () { if (!ov.hidden && !busy) go(1); }, 1800);
      return;
    }
    if (statusOf(c) === "new") { setStatus(c, "learning"); cardEl.classList.add("is-learning"); }
    compare(c, firstHan(result.texts));
  }

  // Not a match (or no checking available): play her voice, then the teacher's. Never "wrong".
  async function compare(c, heard) {
    var my = attemptId;
    var html = '<span class="zh">再听一听</span>';
    if (heard) html += '<span style="font-weight:400;font-size:0.95rem">I heard <span class="zh" style="font-size:1.1rem">' + heard + "</span></span>";
    html += '<div class="row">';
    if (lastBlob) html += '<button class="pill" data-act="mine">' + icon("play") + "You</button>";
    html += '<button class="pill" data-act="teacher">' + icon("speaker") + '<span class="zh">老师</span></button>';
    if (statusOf(c) !== "done") html += '<button class="pill yes" data-act="know">' + icon("check") + '<span class="zh">我会了</span></button>';
    html += "</div>";
    setMsg("try", html);
    if (lastBlob) { await playBlob(lastBlob); await wait(300); }
    if (my === attemptId && c === list[idx] && !ov.hidden && !busy) await say(c.c);
  }

  function showNotice(text) {
    var n = $("#notice");
    n.textContent = text;
    n.hidden = false;
  }

  micBtn.addEventListener("click", function () { unlockAudio(); attempt(); });
  $("#hear").addEventListener("click", function () {
    cancelAttempt();  // never let the recognizer hear the teacher's voice
    unlockAudio();
    if (!("speechSynthesis" in window)) { setMsg("err", "<span>This browser can't speak Chinese out loud.</span>"); return; }
    if (!zhVoice) pickVoice();
    say(list[idx].c).then(function (ok) {
      var voicesLoaded = speechSynthesis.getVoices().length > 0;
      if (!ok || (voicesLoaded && !zhVoice)) setMsg("err", "<span>No Chinese voice found. On iPad: Settings → Accessibility → Spoken Content → Voices → Chinese.</span>");
    });
  });
  $("#flip").addEventListener("click", function () { cardEl.classList.toggle("flipped"); });
  cardEl.addEventListener("click", function () { cardEl.classList.toggle("flipped"); });
  $("#prev").addEventListener("click", function () { go(-1); });
  $("#next").addEventListener("click", function () { go(1); });
  $("#close").addEventListener("click", closeCard);
  document.addEventListener("keydown", function (e) {
    if (ov.hidden) return;
    if (e.key === "Escape") closeCard();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === " " && e.target === document.body) { e.preventDefault(); cardEl.classList.toggle("flipped"); }
  });
  var touchX = null;
  $("#stage").addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  $("#stage").addEventListener("touchend", function (e) {
    if (touchX == null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  });

  // ---------- 30-second facts drill ----------
  var drill = cfg.drill;
  var op = drill.ops[0], set = "mix";
  var round = null;

  function sets() { var s = []; for (var i = 1; i <= 10; i++) s.push(String(i)); s.push("mix"); return s; }
  function setLabel(s) { return s === "mix" ? "?" : (op === "-" ? "−" : "+") + s; }
  function key() { return op + set; }

  function makeProblem(prev) {
    for (var tries = 0; tries < 10; tries++) {
      var a, b;
      var n = set === "mix" ? Math.floor(Math.random() * 11) : Number(set);
      var other = Math.floor(Math.random() * 11);
      if (op === "-") { b = n; a = n + other; } else { a = other; b = n; if (Math.random() < 0.5) { var t = a; a = b; b = t; } }
      var p = { a: a, b: b, ans: op === "-" ? a - b : a + b };
      if (!prev || p.a !== prev.a || p.b !== prev.b) return p;
    }
    return p;
  }

  function renderDrillSetup() {
    var box = $("#drill-box");
    var html = '<div class="pick" role="group" aria-label="Add or subtract">';
    drill.ops.forEach(function (o) {
      html += '<button class="chip" data-op="' + o + '" aria-pressed="' + (o === op) + '">' + (o === "-" ? '<span class="zh">减法</span> −' : '<span class="zh">加法</span> +') + "</button>";
    });
    html += '</div><div class="pick" role="group" aria-label="Which facts">';
    sets().forEach(function (s) {
      html += '<button class="chip" data-set="' + s + '" aria-pressed="' + (s === set) + '" aria-label="' + (s === "mix" ? "Mixed" : (op === "-" ? "minus " : "plus ") + s) + '">' + setLabel(s) + "</button>";
    });
    html += "</div>";
    var best = drillState.best[key()];
    html += '<div class="start"><button class="big-btn" id="drill-go">' + icon("play") + '<span class="zh">开始</span> 30s</button></div>';
    html += '<p class="best">' + (best ? "Best: " + best + " ✓" : "Answer as many as you can in 30 seconds.") + "</p>";
    box.innerHTML = html;
  }

  $("#drill-box").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.op) { op = b.dataset.op; renderDrillSetup(); }
    else if (b.dataset.set) { set = b.dataset.set; renderDrillSetup(); }
    else if (b.id === "drill-go" || b.id === "drill-again") { unlockAudio(); startRound(); }
    else if (b.id === "drill-back") { renderDrillSetup(); }
    else if (b.dataset.k != null) { press(b.dataset.k); }
  });

  function startRound() {
    var box = $("#drill-box");
    box.innerHTML =
      '<div class="play">' +
      '<div class="timer" aria-hidden="true"><i id="t-bar"></i></div>' +
      '<div class="score" id="t-score">0 ✓</div>' +
      '<div class="problem" id="t-prob" aria-live="polite"></div>' +
      '<div class="answer" id="t-ans" aria-label="Your answer"></div>' +
      '<div class="pad">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button data-k="' + n + '">' + n + "</button>"; }).join("") +
      '<button data-k="clear" aria-label="Clear">' + icon("x") + '</button><button data-k="0">0</button><button data-k="back" aria-label="Delete">' + icon("left") + "</button>" +
      "</div></div>";
    round = { score: 0, typed: "", prob: makeProblem(null), end: Date.now() + 30000 };
    showProblem();
    round.tick = setInterval(function () {
      var left = Math.max(0, round.end - Date.now());
      $("#t-bar").style.width = (left / 300) + "%";
      if (!left) endRound();
    }, 200);
  }

  function showProblem() {
    $("#t-prob").textContent = round.prob.a + " " + (op === "-" ? "−" : "+") + " " + round.prob.b + " =";
    $("#t-ans").textContent = round.typed;
    $("#t-ans").className = "answer";
  }

  function press(k) {
    if (!round || round.locked) return;
    if (k === "clear") round.typed = "";
    else if (k === "back") round.typed = round.typed.slice(0, -1);
    else if (round.typed.length < 2) round.typed += k;
    $("#t-ans").textContent = round.typed;
    $("#t-ans").className = "answer";
    var want = String(round.prob.ans);
    if (round.typed.length < want.length) return;
    if (round.typed === want) {
      round.score++;
      $("#t-score").textContent = round.score + " ✓";
      $("#t-ans").className = "answer right";
      round.locked = true;
      setTimeout(function () {
        if (!round) return;
        round.locked = false;
        round.typed = "";
        round.prob = makeProblem(round.prob);
        showProblem();
      }, 250);
    } else {
      var a = $("#t-ans");
      a.className = "answer";
      void a.offsetWidth;
      a.className = "answer wrong";
      round.typed = "";
      setTimeout(function () { if (round) $("#t-ans").textContent = ""; }, 300);
    }
  }

  document.addEventListener("keydown", function (e) {
    if (!round || !ov.hidden) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("back");
  });

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function endRound() {
    clearInterval(round.tick);
    var score = round.score;
    round = null;
    var k = key(), prev = drillState.best[k] || 0, record = score > prev;
    if (record) drillState.best[k] = score;
    if (score > 0) drillState.days[today()] = true;
    store.set(DKEY, drillState);
    if (record && score > 0) chime();
    $("#drill-box").innerHTML =
      '<div class="result">' +
      '<div class="num">' + score + "</div>" +
      '<div class="score">' + (record && score > 0 ? '<span class="zh">新纪录！</span> New best' : "Best: " + Math.max(prev, score)) + "</div>" +
      '<div class="row" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' +
      '<button class="big-btn" id="drill-again">' + icon("again") + '<span class="zh">再来</span></button>' +
      '<button class="chip" id="drill-back">' + setLabel(set) + " · change</button>" +
      "</div></div>";
    renderTasks();
  }

  // ---------- parent reset ----------
  $("#reset").addEventListener("click", function () {
    if (!confirm("Clear all flashcard and drill progress on this device?")) return;
    if (round) { clearInterval(round.tick); round = null; }
    progress = {}; weekState = { manual: {} }; drillState = { best: {}, days: {} };
    store.set(PKEY, progress); store.set(WKEY, weekState); store.set(DKEY, drillState);
    renderTasks(); renderGrid(); renderDrillSetup();
  });

  if (!SR) showNotice("This browser can't check speech, so she'll compare her voice with the teacher's and decide. Safari on iPad (with Dictation on) or Chrome can check it.");

  $("#shuffle").innerHTML = icon("shuffle") + '<span class="zh">打乱</span>';
  $("#mic").innerHTML = icon("mic");
  $("#hear").innerHTML = icon("speaker");
  $("#flip").innerHTML = icon("flip");
  $("#prev").innerHTML = icon("left");
  $("#next").innerHTML = icon("right");
  $("#close").innerHTML = icon("x");
  $("#flip-hint").innerHTML = icon("flip");
  renderTasks();
  renderGrid();
  renderDrillSetup();
})();
