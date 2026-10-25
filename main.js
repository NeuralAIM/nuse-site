(function () {
  "use strict";
  var doc = document.documentElement;
  var reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var shot = /[?&]shot/.test(location.search);           // для скриншотов: всё сразу на месте
  var $ = function (id) { return document.getElementById(id); };
  var qs = function (el, s) { return el.querySelector(s); };
  var qsa = function (el, s) { return Array.prototype.slice.call(el.querySelectorAll(s)); };
  var only = shot && (location.search.match(/only=(\w+)/) || [])[1];   // скриншот одного раздела
  if (only) Array.prototype.forEach.call(document.querySelectorAll("main > section"), function (s) { if (s.id !== only) s.style.display = "none"; });
  var year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  var TRACKS = [
    { t: "Ночной город", a: "Moonlane", c: [330, 48, 50], cv: "linear-gradient(135deg,#d0628f,#2a1430)", p: 92, say: "Этот должен зайти" },
    { t: "Ближе к утру", a: "Aurel", c: [212, 55, 52], cv: "linear-gradient(135deg,#5a86d6,#141c3a)", p: 87, say: "Очень в вашем вкусе" },
    { t: "Тёплый свет", a: "Sola Vey", c: [28, 72, 54], cv: "linear-gradient(135deg,#e39a4f,#3a1e10)", p: 95, say: "Почти наверняка понравится" },
    { t: "Пульс", a: "Kairo", c: [272, 50, 56], cv: "linear-gradient(135deg,#9a6be0,#1d1236)", p: 81, say: "В вашем духе" }
  ];
  var hsl = function (c, dl, a) { return "hsla(" + Math.round(c[0]) + "," + Math.round(c[1]) + "%," + Math.round(Math.max(0, Math.min(95, c[2] + (dl || 0)))) + "%," + (a == null ? 1 : a) + ")"; };

  // ── «горки»: та же форма, что в плеере, когда данных трека нет (спокойные холмы) ──
  var FAKE = (function () {
    var src = [], i, j, N = 160, out = new Float32Array(N + 1), mx = 1;
    for (i = 0; i < 96; i++) src.push(42 + 22 * Math.sin(i / 8) + 14 * Math.sin(i / 3.7 + 1) + 8 * Math.sin(i / 1.9));
    var n = src.length, sg = Math.max(2.5, n / 30);
    for (i = 0; i <= N; i++) {
      var c = i / N * (n - 1), v = 0, w = 0;
      for (j = Math.max(0, Math.floor(c - sg * 2)); j <= Math.min(n - 1, Math.ceil(c + sg * 2)); j++) {
        var k = Math.exp(-((j - c) * (j - c)) / (2 * sg * sg)); v += src[j] * k; w += k;
      }
      out[i] = v / w;
    }
    for (i = 0; i <= N; i++) mx = Math.max(mx, out[i]);
    for (i = 0; i <= N; i++) out[i] /= mx;
    return out;
  })();
  function at(u) {
    u = ((u % 1) + 1) % 1;
    var N = FAKE.length - 1, x = u * N, i = Math.floor(x), f = x - i;
    return FAKE[i] * (1 - f) + FAKE[Math.min(N, i + 1)] * f;
  }

  // ── цвет сцены плывёт к цвету трека по кратчайшей дуге (как ambStep в плеере) ──
  function Amb(el) {
    var c = (el.getAttribute("data-amb") || "330,48,50").split(",").map(Number);
    this.el = el; this.cur = c.slice(); this.to = c.slice();
    el.style.transition = "none"; this.css(c); void el.offsetWidth; el.style.transition = "";   // начальный цвет сразу, без перелива
  }
  Amb.prototype.set = function (c) { this.to = c.slice(); this.css(c); };
  Amb.prototype.css = function (c) { this.el.style.setProperty("--amb", "hsl(" + c[0] + "," + c[1] + "%," + c[2] + "%)"); };
  Amb.prototype.step = function (k) {
    var dh = ((this.to[0] - this.cur[0] + 540) % 360) - 180;
    this.cur[0] = (this.cur[0] + dh * k + 360) % 360;
    this.cur[1] += (this.to[1] - this.cur[1]) * k;
    this.cur[2] += (this.to[2] - this.cur[2]) * k;
    return this.cur;
  };

  // ── сияние: крошечный холст 120×76, браузер растягивает и размывает (приём живого экрана) ──
  var LAYERS = [
    { dh: -38, k: 1.25, span: 110, a: .38, y: .02 },
    { dh: 34, k: 1.0, span: 80, a: .42, y: .1 },
    { dh: 0, k: 0.8, span: 56, a: .5, y: .18, lift: 4 }
  ];
  function hills(g, gw, gh, T, c, vis, alpha, e) {
    for (var li = 0; li < LAYERS.length; li++) {
      var L = LAYERS[li], amp = gh * (0.42 + 0.28 * e) * L.k;
      g.beginPath(); g.moveTo(0, gh);
      for (var x = 0; x <= gw; x += 3) {
        var u = x / gw;
        var wob = Math.sin(T * (0.35 + li * 0.11) + u * 5 + li * 2) * 0.06 + Math.sin(T * 0.21 + u * 11 + li) * 0.03;
        g.lineTo(x, gh * (1.08 - L.y) - amp * (at((vis + (u - 0.5) * L.span) / 90) * 0.68 + 0.1 + wob));
      }
      g.lineTo(gw, gh); g.closePath();
      var hh = [(c[0] + L.dh + 360) % 360, Math.min(100, c[1] + 10), c[2]];
      var gr = g.createLinearGradient(0, 0, 0, gh);
      gr.addColorStop(0, hsl(hh, 2 + (L.lift || 0), (L.a * (0.8 + 0.4 * e) * alpha).toFixed(3)));
      gr.addColorStop(1, hsl(hh, -c[2] * 0.4, (L.a * 0.25 * alpha).toFixed(3)));
      g.fillStyle = gr; g.fill();
    }
  }
  function Glow(cv, amb, mode) {
    this.cv = cv; this.amb = amb; this.mode = mode; this.mix = 0; this.second = null;
    cv.width = 120; cv.height = 76;
    this.g = cv.getContext("2d");
  }
  Glow.prototype.draw = function (now) {
    var g = this.g, T = now / 1000 + 40, c = this.amb.step(0.035);
    g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, 120, 76);
    g.globalCompositeOperation = "lighter";
    var e = 0.5 + 0.08 * Math.sin(T * 0.4);
    if (this.second) {               // «Драйв»: свет двух треков перетекает
      var m = this.mix;
      hills(g, 120, 76, T * 1.3, c, T * 6, 0.3 + 0.9 * (1 - m), 0.6);
      hills(g, 120, 76, T * 1.3 + 3, this.second, T * 6 + 40, 0.3 + 0.9 * m, 0.6);
    } else hills(g, 120, 76, T, c, T * 2.2, 1, e);
  };

  // ═══ демо-блоки ═══
  var demos = [];
  function addDemo(el, d) { d.el = el; d.vis = false; demos.push(d); return d; }

  // сцены с сиянием
  qsa(document, ".stage").forEach(function (st) {
    var amb = new Amb(st);
    st._amb = amb;
    var cv = qs(st, "canvas.wv-glow");
    if (cv && cv.getContext) {
      st._glow = new Glow(cv, amb);
      st._glow.draw(performance.now());
      var wrap = cv.parentNode;                          // проявляется обёртка; размытый слой уже готов и не меняет размер
      if (shot) { wrap.style.transition = "none"; wrap.classList.add("is-on"); }
      else requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add("is-on"); }); });
    }
    addDemo(st, { tick: function (now) { if (st._glow) st._glow.draw(now); } });
  });

  function swapCover(box, cv) {
    var old = qsa(box, ".cv");
    var n = document.createElement("i");
    n.className = "cv swap-in"; n.style.setProperty("--cv", cv);
    box.appendChild(n);
    old.forEach(function (o) { o.classList.remove("swap-in"); o.classList.add("swap-out"); setTimeout(function () { o.remove(); }, 600); });
  }

  // 01 — волна: треки сменяются, NAI говорит
  (function () {
    var el = $("dWave"); if (!el) return;
    var i = 0, next = 0, naiOff = 0;
    var cover = qs(el, ".dw-cover"), ttl = qs(el, ".wv-ttl"), who = qs(el, ".wv-who"), badge = qs(el, ".ml-badge"), say = qs(el, ".np-nai"), like = qs(el, ".wv-like");
    qs(cover, ".cv").style.setProperty("--cv", TRACKS[0].cv);
    function show(k, first) {
      var t = TRACKS[k];
      if (!first) swapCover(cover, t.cv);
      ttl.textContent = t.t; who.textContent = t.a; badge.textContent = t.p + "%";
      [ttl.parentNode, badge].forEach(function (x) { x.classList.remove("meta-swap"); void x.offsetWidth; x.classList.add("meta-swap"); });
      say.textContent = t.say; say.classList.add("on");
      like.classList.toggle("is-liked", k === 2);
      el._amb.set(t.c);
    }
    show(0, true);
    addDemo(el, { tick: function (now) {
      if (!next) { next = now + 6500; naiOff = now + 3800; return; }
      if (naiOff && now > naiOff) { say.classList.remove("on"); naiOff = 0; }
      if (now > next) { i = (i + 1) % TRACKS.length; show(i); next = now + 6500; naiOff = now + 3800; }
    } });
  })();

  // 02 — текст по словам: слово за словом, протяжное слово заливается плавно, строки едут вверх
  (function () {
    var list = $("lyrList"); if (!list) return;
    var LINES = [
      ["Still the music finds a way", "Но музыка находит путь"],
      ["City lights are falling slow*", "Огни города медленно гаснут"],
      ["I can hear you through the noise", "Я слышу тебя сквозь шум"],
      ["Every word is on its way*", "Каждое слово уже в пути"],
      ["Hold the night and let it play", "Удержи ночь — пусть звучит"],
      ["We were never meant to stay*", "Нам не суждено было остаться"]
    ];
    var LONG = 1700;
    var made = 0, cur = null, wi = 0, nextAt = 0, longEnd = 0, longEl = null;
    function make() {
      var L = LINES[made % LINES.length]; made++;
      var d = document.createElement("div");
      d.className = "lyr-line";
      L[0].split(" ").forEach(function (w, k, a) {
        var s = document.createElement("span"); s.className = "lyr-w";
        if (w.slice(-1) === "*") { w = w.slice(0, -1); s.setAttribute("data-long", "1"); s.setAttribute("data-t", w); }
        s.textContent = w; d.appendChild(s);
        if (k < a.length - 1) d.appendChild(document.createTextNode(" "));
      });
      var tr = document.createElement("span"); tr.className = "lyr-tr"; tr.textContent = L[1]; d.appendChild(tr);
      list.appendChild(d);
      return d;
    }
    for (var k = 0; k < 6; k++) make();
    function place(instant) {
      var y = -(cur.offsetTop + cur.offsetHeight / 2);
      if (instant) { list.style.transition = "none"; list.style.transform = "translateY(" + y + "px)"; void list.offsetHeight; list.style.transition = ""; }
      else list.style.transform = "translateY(" + y + "px)";
    }
    function finishLong() {
      if (!longEl) return;
      longEl.classList.add("on"); longEl.classList.remove("lw"); longEl.style.removeProperty("--p"); longEl = null;
    }
    function activate(line, instant) {
      finishLong();
      if (cur) { cur.classList.remove("active"); cur.classList.add("past"); }
      cur = line; cur.classList.add("active"); wi = 0;
      while (list.children.length > 7 && list.children[0] !== cur && list.children[1] !== cur) { list.removeChild(list.children[0]); place(true); }
      var n = cur, ahead = 0;
      while (n.nextElementSibling) { n = n.nextElementSibling; ahead++; }
      if (ahead < 3) make();
      place(instant);
    }
    list.children[0].classList.add("past");
    qsa(list.children[0], ".lyr-w").forEach(function (w) { w.classList.add("on"); });
    activate(list.children[1], true);
    if (reduced) qsa(cur, ".lyr-w").slice(0, 3).forEach(function (w) { w.classList.add("on"); });
    addDemo($("dLyr"), { tick: function (now) {
      if (reduced) return;
      if (longEl) {                                   // протяжное слово: заливка едет слева направо
        var p = Math.min(100, (1 - (longEnd - now) / LONG) * 100);
        longEl.style.setProperty("--p", p.toFixed(1));
        if (now >= longEnd) { finishLong(); nextAt = now + 380; }
        return;
      }
      if (!nextAt) { nextAt = now + 600; return; }
      if (now < nextAt) return;
      var ws = qsa(cur, ".lyr-w");
      if (wi < ws.length) {
        var w = ws[wi]; wi++;
        if (w.getAttribute("data-long")) { longEl = w; w.classList.add("lw"); w.style.setProperty("--p", "0"); longEnd = now + LONG; return; }
        w.classList.add("on");
        nextAt = now + 260 + w.textContent.length * 55 + (wi === ws.length ? 380 : 0);
      } else { activate(cur.nextElementSibling); nextAt = now + 900; }
    } });
    addEventListener("resize", function () { if (cur) place(true); });
  })();

  // 03 — нижняя панель: горка интереса, гребень цветом того, кто поёт, значки, «к интересному» и «к припеву»
  (function () {
    var el = $("dPlayer"); if (!el) return;
    var all = $("pwAll"), done = $("pwDone"), fill = $("pwFill"), now0 = $("pwNow"), marks = $("pwMarks"), jump = $("pwJump"), cho = $("pwChorus");
    var DUR = 204, amb = [330, 48, 50];
    el.style.setProperty("--amb", "hsl(330,48%,50%)");
    // кто поёт: 0 — никто, 1 — девушка, 2 — парень, 3 — вместе (цвета — как в плеере)
    var VOICE = [[0, 30, 0], [30, 70, 1], [70, 100, 3], [100, 130, 2], [130, 158, 1], [158, 190, 3], [190, 204, 0]];
    var VHSL = [null, [335, 85, 68], [208, 88, 64], [268, 78, 72]];
    var GOLD = [45, 90, 66];
    var CHORUS = [[72, 100], [158, 190]];
    var MARKS = [[30, "mic", VHSL[1]], [72, "chorus", GOLD], [100, "mic", VHSL[2]], [158, "bolt", GOLD]];
    var SVG = {
      mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/></svg>',
      bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 5 14h6l-1 8 8-12h-6z"/></svg>',
      chorus: '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>'
    };
    function interest(sec) {                       // спокойное вступление, подъёмы к припевам
      var u = sec / DUR, v = 0.28 + 0.32 * at(u * 0.9 + 0.05);
      CHORUS.forEach(function (c) { var m = (c[0] + c[1]) / 2, w = (c[1] - c[0]) * 0.75; v += 0.42 * Math.exp(-Math.pow((sec - m) / w, 2)); });
      if (sec < 30) v *= 0.55 + 0.45 * (sec / 30);
      return Math.min(1, v);
    }
    var zone = $("pwZone");
    function hillY(sec, H) {                         // горка поднимается в своей полосе между строками панели
      var zt = zone.offsetTop, zb = zt + zone.offsetHeight + 8;
      return zb - Math.max(0.06, interest(sec)) * (zb - zt - 22);
    }
    function path(g, W, H) {
      var n = 140;
      g.beginPath();
      for (var i = 0; i <= n; i++) { var x = i / n * W, y = hillY(i / n * DUR, H); if (!i) g.moveTo(x, y); else g.lineTo(x, y); }
    }
    function paint(cv) {
      var W = el.clientWidth, H = el.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      path(g, W, H); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      var gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "hsla(" + amb[0] + "," + amb[1] + "%," + Math.min(80, amb[2] + 8) + "%,1)");
      gr.addColorStop(1, "hsla(" + amb[0] + "," + amb[1] + "%," + Math.max(20, amb[2] - 22) + "%,.35)");
      g.fillStyle = gr; g.fill();
      // гребень: цвет того, кто поёт в эту секунду
      var col = g.createLinearGradient(0, 0, W, 0), bl = 3 / DUR;
      VOICE.forEach(function (v, i) {
        var c = v[2] ? hsl(VHSL[v[2]], 8, 1) : "hsla(" + amb[0] + "," + amb[1] + "%,86%,.9)";
        col.addColorStop(Math.min(1, v[0] / DUR + (i ? bl : 0)), c);
        col.addColorStop(Math.max(0, v[1] / DUR - (i < VOICE.length - 1 ? bl : 0)), c);
      });
      path(g, W, H); g.lineWidth = 2; g.lineJoin = "round"; g.strokeStyle = col; g.stroke();
      // припевы — тонкая полоса внизу
      g.fillStyle = hsl(GOLD, 0, .85);
      CHORUS.forEach(function (c) { g.fillRect(c[0] / DUR * W, H - 2, (c[1] - c[0]) / DUR * W, 2); });
    }
    function paintMarks() {
      var H = el.clientHeight;
      marks.innerHTML = MARKS.map(function (m) {
        return '<span class="np-mark" style="left:' + (m[0] / DUR * 100).toFixed(2) + "%;top:" + Math.max(0, hillY(m[0], H) - 28).toFixed(1) + "px;--c:" + hsl(m[2]) + '">' + SVG[m[1]] + "</span>";
      }).join("");
    }
    function paintAll() { paint(all); paint(done); paintMarks(); }
    paintAll();
    addEventListener("resize", paintAll);
    var lastSec = -1;
    function setPos(sec) {
      var r = Math.max(0, Math.min(1, sec / DUR));
      fill.style.transform = "scaleX(" + r.toFixed(4) + ")";
      done.style.clipPath = "inset(0 " + ((1 - r) * 100).toFixed(2) + "% 0 0)";
      var s = Math.floor(sec);
      if (s !== lastSec) { lastSec = s; now0.textContent = Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    }
    // сценарий: спокойное начало → «к интересному» → играет → «к припеву» → играет → по кругу
    var pos = 0, t0 = 0, last = 0, seek = null, step = 0;
    function press(btn, to, now) {
      btn.classList.add("press"); setTimeout(function () { btn.classList.remove("press"); }, 260);
      seek = { from: pos, to: to, t: now, d: 700 };
    }
    setPos(reduced ? 40 : 0);
    addDemo(el, { tick: function (now) {
      if (reduced) return;
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      if (!t0) t0 = now;
      if (seek) {
        var k = Math.min(1, (now - seek.t) / seek.d), e = 1 - Math.pow(1 - k, 3);
        pos = seek.from + (seek.to - seek.from) * e;
        if (k >= 1) seek = null;
      } else {
        pos += dt * (step === 0 ? 2 : step === 1 ? 4 : 6);
        if (step === 0 && now - t0 > 2400) { press(jump, 34, now); step = 1; }
        else if (step === 1 && pos > 58) { press(cho, 72, now); step = 2; }
        else if (step === 2 && pos > 176) { seek = { from: pos, to: 0, t: now, d: 1100 }; step = 0; t0 = now + 1100; }
      }
      jump.style.opacity = step >= 1 && pos > 34.5 ? ".45" : "";
      cho.style.opacity = step >= 2 && pos > 72.5 ? ".45" : "";
      setPos(pos);
    } });
  })();

  // 04 — Драйв: лента сведения — следующий трек входит в такт, голос передаётся
  (function () {
    var el = $("dDrive"); if (!el) return;
    var cv = $("ddCv"), ttl = $("ddTtl"), who = $("ddWho"), tag = $("ddTag"), cover = qs(el, ".dd-cover"), glow = el._glow;
    var L = 46, O = 12, STEP = L - O, VIEW = 70, SPEED = 3.2;   // длина куска, перекрытие, окно ленты (с), скорость ленты
    var VH = [[335, 85, 68], [208, 88, 64]];
    var T = reduced ? STEP + O / 2 : STEP - 5, last = 0, shown = null;
    function trackAt(k) { return TRACKS[((k % TRACKS.length) + TRACKS.length) % TRACKS.length]; }
    function draw() {
      var s = sizeCv(cv), g = s.g, W = s.W, H = s.H;
      g.clearRect(0, 0, W, H);
      var X = function (t) { return W / 2 + (t - T) / VIEW * W; };
      var lane = function (k) { return ((k % 2) + 2) % 2 ? H * 0.8 : H * 0.44; };
      var k0 = Math.floor((T - VIEW / 2) / STEP) - 1, k1 = Math.ceil((T + VIEW / 2) / STEP) + 1, k, b, t;
      for (k = k0; k <= k1; k++) {                    // зона перехода и доли в ней
        var os = k * STEP + STEP, oe = os + O;
        g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(X(os), H * 0.08, X(oe) - X(os), H * 0.84);
        for (b = 0; b <= O; b++) { g.fillStyle = "rgba(255,255,255," + (b % 4 === 0 ? .28 : .1) + ")"; g.fillRect(X(os + b) - 0.5, H * 0.12, 1, H * 0.76); }
      }
      for (k = k0; k <= k1; k++) {
        var tr = trackAt(k), st = k * STEP, en = st + L, y0 = lane(k), hh = H * 0.3, c = tr.c, fo = O / L;
        // горка трека: проявляется на входе, гаснет на выходе
        var grd = g.createLinearGradient(X(st), 0, X(en), 0);
        grd.addColorStop(0, hsl(c, 6, 0)); grd.addColorStop(fo, hsl(c, 6, .55)); grd.addColorStop(1 - fo, hsl(c, 6, .55)); grd.addColorStop(1, hsl(c, 6, 0));
        g.beginPath(); g.moveTo(X(st), y0);
        for (t = st; t <= en + 0.01; t += 0.5) {
          var env = Math.min(1, (t - st) / O * 1.6, (en - t) / O * 1.6 + 0.05);
          g.lineTo(X(t), y0 - hh * (0.25 + 0.6 * at((t - st) / L * 0.8 + k * 0.37)) * Math.max(0, env));
        }
        g.lineTo(X(en), y0); g.closePath(); g.fillStyle = grd; g.fill();
        // голос: поёт между переходами — в зоне перехода один уже замолк, другой ещё не вступил
        var vc = VH[((k % 2) + 2) % 2], rx = X(st + O + 1.5), rw = X(en - O - 1.5) - rx;
        g.fillStyle = hsl(vc, 0, .95); g.beginPath();
        if (g.roundRect) g.roundRect(rx, y0 + 6, rw, 4, 2); else g.rect(rx, y0 + 6, rw, 4);
        g.fill();
      }
      g.globalCompositeOperation = "destination-out";   // края ленты гаснут
      var fl = g.createLinearGradient(0, 0, W, 0);
      fl.addColorStop(0, "rgba(0,0,0,1)"); fl.addColorStop(.14, "rgba(0,0,0,0)"); fl.addColorStop(.86, "rgba(0,0,0,0)"); fl.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = fl; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "source-over";
    }
    function update(first) {
      var base = Math.floor(T / STEP), ph = T - base * STEP;
      var inX = ph < O;                                         // идёт переход: трек base-1 → base
      tag.classList.toggle("on", inX);
      var cur = Math.floor((T - O / 2) / STEP) + 1;             // с середины перехода играет уже следующий
      if (cur !== shown) {
        var tr = trackAt(cur);
        if (first) qs(cover, ".cv").style.setProperty("--cv", tr.cv); else swapCover(cover, tr.cv);
        ttl.textContent = tr.t; who.textContent = tr.a;
        if (!first) { var x = ttl.parentNode; x.classList.remove("meta-swap"); void x.offsetWidth; x.classList.add("meta-swap"); }
        el.style.setProperty("--amb", hsl(tr.c));
        shown = cur;
      }
      if (glow) {
        el._amb.to = (inX ? trackAt(base - 1) : trackAt(base)).c.slice();
        el._amb.cur = el._amb.to.slice();
        glow.second = trackAt(base).c.slice();
        glow.mix = inX ? ph / O : 0;
      }
    }
    update(true); draw();
    addDemo(el, { tick: function (now) {
      if (reduced) return;
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      T += dt * SPEED;
      update(false); draw();
    } });
    addEventListener("resize", draw);
  })();

  // волна в дорожке: столбики, как в плеере (голос — плавнее, музыка — плотнее)
  function bars(g, W, H, T, speed, kind, amp, c, spacing) {
    g.clearRect(0, 0, W, H);
    var step = spacing || 5, n = Math.ceil(W / step) + 1, mid = H * 0.56;
    for (var i = 0; i < n; i++) {
      var x = i * step, u = (x / W) + T * speed * 0.05;
      var v = kind === "voc"
        ? Math.max(0, Math.sin(u * 7.0) * 0.5 + Math.sin(u * 17.0 + 1) * 0.3 + Math.sin(u * 41.0) * 0.18) * (0.55 + 0.45 * Math.sin(u * 2.1))
        : 0.35 + 0.3 * Math.abs(Math.sin(u * 23.0)) + 0.25 * Math.abs(Math.sin(u * 61.0 + 2)) * (Math.sin(u * 8.0) > -0.2 ? 1 : 0.4);
      var h = Math.max(1.5, v * (H * 0.62) * amp);
      g.fillStyle = hsl(c, 14, (0.45 + 0.5 * Math.min(1, v)).toFixed(3));
      g.fillRect(x, mid - h / 2, Math.max(2, step - 2.5), h);
    }
  }
  function sizeCv(cv) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, W: W, H: H };
  }

  // 05 — голос и минус
  (function () {
    var el = $("dStem"); if (!el) return;
    var lanes = qsa(el, ".lane"), mis = qsa(el, ".mi"), st = $("stemState");
    var MODES = [["mix", "весь трек"], ["voc", "только голос"], ["ins", "без голоса"]];
    var m = 0, next = 0, amp = { voc: 1, ins: 1 };
    var COL = { voc: [335, 85, 62], ins: [205, 60, 58] };
    function setMode(i) {
      m = i; var id = MODES[i][0];
      mis.forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("data-stem") === id); });
      st.textContent = MODES[i][1];
      lanes.forEach(function (l) { var k = l.getAttribute("data-lane"); l.classList.toggle("is-off", id !== "mix" && id !== k); });
    }
    setMode(0);
    function draw(now) {
      var id = MODES[m][0];
      lanes.forEach(function (l) {
        var k = l.getAttribute("data-lane"), want = id === "mix" || id === k ? 1 : 0.12;
        amp[k] += (want - amp[k]) * 0.08;
        var s = sizeCv(qs(l, ".lane-cv"));
        bars(s.g, s.W, s.H, now / 1000, 1, k, amp[k], COL[k], 5);
      });
    }
    draw(performance.now());
    addDemo(el, { tick: function (now) {
      if (reduced) return;
      if (!next) next = now + 3200;
      if (now > next) { setMode((m + 1) % 3); next = now + 3200; }
      draw(now);
    } });
    addEventListener("resize", function () { draw(performance.now()); });
  })();

  // 06 — скорость: темп сжимается и растягивается, тон на месте
  (function () {
    var el = $("dSpeed"); if (!el) return;
    var cv = $("spCv"), val = $("spVal"), st = $("spState"), mis = qsa(el, ".mi");
    var MODES = [["normal", 1, "1×"], ["fast", 1.2, "1.2×"], ["slow", 0.85, "0.85×"]];
    var m = 0, next = 0, sp = 1, pos = 0, last = 0;
    function setMode(i) {
      m = i; var M = MODES[i];
      mis.forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("data-speed") === M[0]); });
      st.textContent = M[2]; val.textContent = M[2];
    }
    setMode(0);
    function draw(now) {
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      sp += (MODES[m][1] - sp) * 0.06;
      pos += dt * sp;
      var s = sizeCv(cv);
      bars(s.g, s.W, s.H, pos, 1.6, "ins", 0.9, [28, 72, 60], 6 / sp);
    }
    draw(performance.now());
    addDemo(el, { tick: function (now) {
      if (reduced) return;
      if (!next) next = now + 3600;
      if (now > next) { setMode((m + 1) % 3); next = now + 3600; }
      draw(now);
    } });
    addEventListener("resize", function () { draw(performance.now()); });
  })();

  // 07 — устройства: музыка переходит с компьютера на телефон и обратно
  (function () {
    var el = $("dDev"); if (!el) return;
    var rows = qsa(el, ".dev-pick-row"), card = qs(el, ".dev-card"), stt = qs(el, ".dev-state"), strip = $("devStrip");
    var on = 0, next = 0;
    var S = [
      { strip: "Играет на «Компьютер»: Ночной город — Moonlane", pc: "играет · Ночной город", ph: "на паузе · Ночной город", st: "на паузе", play: false },
      { strip: "Играет на «Телефон»: Ночной город — Moonlane", pc: "на паузе · Ночной город", ph: "играет · Ночной город", st: "играет", play: true }
    ];
    function set(i) {
      on = i; var s = S[i];
      rows.forEach(function (r, k) { r.classList.toggle("is-on", k === i); });
      qs(rows[0], "small").textContent = s.pc; qs(rows[1], "small").textContent = s.ph;
      stt.textContent = s.st; card.classList.toggle("is-playing", s.play);
      strip.style.opacity = "0";
      setTimeout(function () { strip.textContent = s.strip; strip.style.opacity = ""; }, 260);
    }
    addDemo(el, { tick: function (now) {
      if (reduced) return;
      if (!next) next = now + 3800;
      if (now > next) { set(1 - on); next = now + 3800; }
    } });
  })();

  // ── один цикл кадров на всё: 30 кадров/с, только то, что на экране ──
  if ("IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { demos.forEach(function (d) { if (d.el === e.target) d.vis = e.isIntersecting; }); });
    }, { rootMargin: "80px" });
    demos.forEach(function (d) { vio.observe(d.el); });
  } else demos.forEach(function (d) { d.vis = true; });
  if (!reduced) {
    var last = 0, raf = 0;
    var frame = function (now) {
      raf = 0;
      if (document.hidden) return;
      if (now - last >= 1000 / 30 - 2) {
        last = now;
        for (var i = 0; i < demos.length; i++) if (demos[i].vis) demos[i].tick(now);
      }
      raf = requestAnimationFrame(frame);
    };
    var kick = function () { if (!raf) raf = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", kick);
    kick();
  }

  // ── шапка: «линза» вкладок едет к текущему разделу ──
  var head = $("head"), tabs = $("tabs");
  var links = tabs ? qsa(tabs, "a[data-sec]") : [];
  var lens = tabs ? qs(tabs, ".head-tabs-lens") : null, current = null;
  function setActive(a, instant) {
    if (!tabs || !lens) return;
    if (a === current && !instant) return;
    current = a;
    if (instant) tabs.classList.add("no-anim");
    links.forEach(function (l) { l.classList.toggle("is-active", l === a); });
    if (a) { tabs.style.setProperty("--lx", a.offsetLeft + "px"); tabs.style.setProperty("--lw", a.offsetWidth + "px"); tabs.classList.add("has-active"); }
    else tabs.classList.remove("has-active");
    if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { tabs.classList.remove("no-anim"); }); });
  }
  function pick() {
    var y = window.scrollY + window.innerHeight * 0.5, best = null;
    links.forEach(function (l) {
      var el = $(l.getAttribute("data-sec"));
      if (el && el.getBoundingClientRect().top + window.scrollY <= y) best = l;
    });
    return best;
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (head) head.classList.toggle("is-scrolled", window.scrollY > 8);
      setActive(pick(), false);
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", function () { setActive(pick(), true); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setActive(pick(), true); });
  setActive(pick(), true);
  onScroll();

  // ── появление при прокрутке ──
  var items = qsa(document, ".rv");
  if (!("IntersectionObserver" in window) || reduced || shot) {
    if (shot) doc.classList.remove("js");
    items.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });
})();
