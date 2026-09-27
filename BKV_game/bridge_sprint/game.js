// Bridge Sprint: ride tram 4/6 along the Nagykörút, get stuck on the
// Petőfi híd, then sprint to BME before the professor closes the door.
// Plain canvas, no dependencies. Open index.html in a browser to play.
'use strict';
(() => {
  // ---------------------------------------------------------------- setup
  const W = 960, H = 540;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.floor(W * s) + 'px';
    canvas.style.height = Math.floor(H * s) + 'px';
    canvas.width = Math.floor(W * s * dpr);
    canvas.height = Math.floor(H * s * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- utils
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const pad = n => String(n).padStart(2, '0');
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function fmtClock(sec) {
    sec = Math.floor(sec);
    return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
  }
  function fmtDur(sec) {
    sec = Math.round(Math.abs(sec));
    return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function text(str, x, y, size, color, align = 'center', weight = '700') {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }
  function shade(hex, k = 0.72) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${((n >> 16) * k) | 0},${(((n >> 8) & 255) * k) | 0},${((n & 255) * k) | 0})`;
  }

  // ---------------------------------------------------------------- audio
  let AC = null, muted = false;
  function unlockAudio() {
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
    }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function beep(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
    if (!AC || muted) return;
    const t0 = AC.currentTime + delay;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(AC.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }
  const SFX = {
    ding() { beep(1319, 0.5, 'sine', 0.08); beep(1047, 0.7, 'sine', 0.08, 0, 0.18); },
    step() { beep(170, 0.04, 'square', 0.025); },
    coin() { beep(988, 0.08, 'square', 0.035); beep(1319, 0.12, 'square', 0.035, 0, 0.06); },
    bad() { beep(180, 0.3, 'sawtooth', 0.06, 0.5); },
    good() { beep(660, 0.1, 'triangle', 0.07); beep(880, 0.15, 'triangle', 0.07, 0, 0.09); },
    jump() { beep(380, 0.15, 'triangle', 0.045, 2); },
    power() { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'square', 0.04, 0, i * 0.07)); },
  };

  // ---------------------------------------------------------------- storage
  const BEST_KEY = 'bkv-bridge-sprint-best';
  function loadBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- constants
  const START_CLOCK = 7 * 3600 + 57 * 60;   // 07:57:00
  const CLASS_TIME = 8 * 3600 + 15 * 60;    // 08:15:00
  const STOPS = [
    'Nyugati pályaudvar', 'Oktogon', 'Király utca', 'Wesselényi utca', 'Blaha Lujza tér',
    'Rákóczi tér', 'Corvin-negyed', 'Mester utca', 'Boráros tér', 'Petőfi híd',
  ];
  const MOVE = 3.2, DWELL = 0.8, SEG = MOVE + DWELL; // real seconds per stop
  const RIDE_RATE = 80 / SEG;   // game seconds per real second while riding (80 s per stop)
  const RUN_RATE = 5;           // game seconds per real second while running
  const PPM = 40, PX = 260, GY = 430;       // pixels per metre, player screen x, ground y
  const BRIDGE_END = 200, FINISH = 258;     // metres
  const STAIRS_N = 16;

  // ---------------------------------------------------------------- state
  let state = 'title';
  let G = null;
  let best = loadBest();
  let titleT = 0;
  const fade = { a: 0, dir: 0, next: null };
  let toasts = [];
  let particles = [];

  function toast(msg, color = '#fff') {
    const dup = toasts.find(t => t.msg === msg);
    if (dup) { dup.t = Math.min(dup.t, 0.15); return; }
    toasts.push({ msg, color, t: 0 });
    if (toasts.length > 3) toasts.shift();
  }

  function newGame() {
    G = {
      clock: START_CLOCK, deadline: CLASS_TIME, stamina: 100, coins: 0,
      profLate: false, falls: 0, fines: 0, trips: 0, shake: 0, finish: 0,
    };
    toasts = [];
    particles = [];
    initRide();
    state = 'ride';
    toast('Tram 6 · Nyugati → BME. Class starts 08:15!', '#ffd23f');
  }

  function goto(next) {
    if (fade.dir !== 0) return;
    fade.dir = 1;
    fade.next = next;
  }

  function enter(next) {
    if (next === 'stuck') initStuck();
    else if (next === 'bridge') initBridge();
    else if (next === 'stairs') initStairs();
    else if (next === 'result') initResult();
    state = next;
  }

  // ---------------------------------------------------------------- input
  const pointers = new Set();
  const keysDown = new Set();
  const isHeld = () => pointers.size > 0 || keysDown.size > 0;

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function zoneFor(x, y) {
    if ((state === 'bridge' || state === 'stairs') && y > H * 0.5) {
      if (x < W * 0.4) return 'L';
      if (x > W * 0.6) return 'R';
    }
    return 'A';
  }

  // Keys only reach the page when it has focus (matters when embedded in an iframe).
  canvas.tabIndex = 0;
  let focused = document.hasFocus();
  const grabFocus = () => { try { canvas.focus({ preventScroll: true }); } catch (err) { /* ignore */ } };
  grabFocus();
  window.addEventListener('focus', () => { focused = true; });
  document.addEventListener('mousedown', grabFocus);

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    grabFocus();
    focused = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pointers.add(e.pointerId);
    unlockAudio();
    const p = toLogical(e);
    press(zoneFor(p.x, p.y));
  });
  const release = e => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  const KEYMAP = {
    ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R',
    Space: 'A', ArrowUp: 'A', KeyW: 'A', Enter: 'A',
  };
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') { muted = !muted; toast(muted ? 'Sound off' : 'Sound on'); return; }
    focused = true;
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    keysDown.add(e.code);
    unlockAudio();
    press(k);
  });
  window.addEventListener('keyup', e => keysDown.delete(e.code));
  window.addEventListener('blur', () => { focused = false; keysDown.clear(); pointers.clear(); });

  function press(k) {
    if (fade.dir === 1) return;
    switch (state) {
      case 'title': newGame(); break;
      case 'ride': rideTap(); break;
      case 'stuck': stuckTap(); break;
      case 'bridge': if (k === 'A') bridgeJump(); else bridgeStep(k); break;
      case 'stairs': if (k !== 'A') stairsStep(k); break;
      case 'result': if (Res.t > 0.8) newGame(); break;
    }
  }

  // ================================================================ RIDE
  // Timing inside one stop-to-stop segment (seconds since leaving the stop).
  const CW0 = 0.6, CA0 = 1.3, CA1 = 2.8;     // curve: warning, active start, active end
  const IA = 0.3, IARR = 1.6, IEND = 2.8;    // inspector: appears, arrives, gives up
  let R;

  function makeBuildings() {
    const cols = ['#e8d5b7', '#d9b99b', '#c9a27e', '#e6c9a8', '#cbb89d', '#d4a373', '#bfa6a0', '#e3d3a8', '#b7c4b0'];
    const list = [];
    let x = 0;
    while (x < 2400) {
      const w = rand(130, 220);
      list.push({ x, w, c: pick(cols), top: rand(0, 40), orn: Math.random() < 0.5, dome: Math.random() < 0.15 });
      x += w + 3;
    }
    return { list, loop: x };
  }

  const PASSENGERS = [
    { x: 110, s: 0.95, shirt: '#8e44ad', pants: '#2c3e50', skin: '#f1c27d', hair: '#3b2a1a', armUp: true },
    { x: 215, s: 0.9, shirt: '#16a085', pants: '#34495e', skin: '#e0ac69', hair: '#111111', bag: '#555555' },
    { x: 700, s: 1.0, shirt: '#c0392b', pants: '#2d3436', skin: '#ffdbac', hair: '#b8860b', armUp: true },
    { x: 800, s: 0.85, shirt: '#7f8c8d', pants: '#4a4a4a', skin: '#f1c27d', hair: '#dddddd' },
    { x: 895, s: 0.95, shirt: '#2980b9', pants: '#1e272e', skin: '#8d5524', hair: '#111111', armUp: true },
  ];

  function initRide() {
    const evs = shuffle(['curve', 'curve', 'curve', 'insp', 'insp', null, null, null]);
    const i = evs.indexOf(null);
    [evs[0], evs[i]] = [evs[i], evs[0]]; // first stretch is a calm intro
    evs.push(null);                      // last stretch: onto the bridge
    R = {
      seg: 0, t: 0, scroll: 0, speed: 0, evs, res: null, held: 0, fall: 0,
      insp: null, passT: 0, arrived: false, fumble: 0, city: makeBuildings(),
    };
    toast('HOLD on curves · TAP when the inspector arrives', '#fff');
  }

  const curveAmt = () => (R.evs[R.seg] === 'curve' && R.t >= CA0 && R.t < CA1)
    ? Math.sin(Math.PI * (R.t - CA0) / (CA1 - CA0)) : 0;
  const isLastSeg = () => R.seg === STOPS.length - 2;

  function updateRide(dt) {
    R.t += dt;
    G.clock += RIDE_RATE * dt;
    R.fall = Math.max(0, R.fall - dt);
    R.passT = Math.max(0, R.passT - dt);
    R.fumble = Math.max(0, R.fumble - dt);

    let target = 0;
    if (R.t < MOVE) target = 280 * Math.min(1, R.t / 0.7, (MOVE - R.t) / 0.7);
    R.speed = target;
    R.scroll += R.speed * dt;

    const ev = R.evs[R.seg];
    if (ev === 'curve') updateCurve(dt);
    else if (ev === 'insp') updateInspector(dt);

    if (!R.arrived && R.t >= MOVE) {
      R.arrived = true;
      if (isLastSeg()) {
        G.shake = 0.4;
        SFX.bad();
        toast('The tram is stuck on the bridge! Forgalmi akadály…', '#ff7b54');
        goto('stuck');
        return;
      }
      SFX.ding();
    }
    if (R.t >= SEG) {
      R.seg++;
      R.t = 0;
      R.res = null;
      R.held = 0;
      R.insp = null;
      R.arrived = false;
    }
  }

  function updateCurve(dt) {
    if (R.res) return;
    if (R.t >= CA0 && R.t < CA1 && isHeld()) R.held += dt;
    if (R.t >= CA1) {
      if (R.held >= (CA1 - CA0) * 0.7) {
        R.res = 'ok';
        toast('Nice balance! 💪', '#7CFC9A');
        SFX.good();
      } else {
        R.res = 'fail';
        R.fall = 1.2;
        G.falls++;
        G.stamina = Math.max(0, G.stamina - 20);
        G.shake = 0.3;
        toast(pick([
          'Oops! You fell onto a néni. −20 stamina',
          'Whoa! You hugged a stranger. −20 stamina',
          'You slid down the whole Combino. −20 stamina',
        ]), '#ff7b54');
        SFX.bad();
      }
    }
  }

  function updateInspector(dt) {
    if (!R.insp) R.insp = { x: W + 60, phase: 0, walking: true };
    const tx = 480 + 78;
    if (!R.res) {
      if (R.t < IARR) {
        R.insp.x = W + 60 + (tx - (W + 60)) * clamp((R.t - IA) / (IARR - IA), 0, 1);
        R.insp.walking = R.t >= IA;
      } else {
        R.insp.x = tx;
        R.insp.walking = false;
      }
      if (R.t >= IEND) {
        R.res = 'fail';
        G.clock += 120;
        G.fines++;
        G.shake = 0.2;
        toast('No pass shown! Fined & delayed +2:00', '#ff7b54');
        SFX.bad();
      }
    } else {
      R.insp.x -= 110 * dt;
      R.insp.walking = true;
    }
    if (R.insp.walking) R.insp.phase += dt * 9;
  }

  function rideTap() {
    if (R.evs[R.seg] !== 'insp' || R.res || R.fumble > 0) return;
    if (R.t >= IARR && R.t < IEND) {
      R.res = 'ok';
      R.passT = 1.2;
      toast('Student pass OK ✔ Köszönöm!', '#7CFC9A');
      SFX.good();
    } else if (R.t >= IA) {
      R.fumble = 0.5;
      toast('Wait until the inspector reaches you…', '#ffd23f');
    }
  }

  // ---------------------------------------------------------------- ride drawing
  function drawCityOutside(scroll, city) {
    const sky = ctx.createLinearGradient(0, 80, 0, 280);
    sky.addColorStop(0, '#9fd3f2');
    sky.addColorStop(1, '#f3e2bd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 78, W, 230);
    const off = scroll % city.loop;
    for (const b of city.list) {
      for (const base of [0, city.loop]) {
        const x = b.x - off + base;
        if (x > W || x + b.w < 0) continue;
        const top = 110 + b.top;
        ctx.fillStyle = b.c;
        ctx.fillRect(x, top, b.w, 280 - top);
        ctx.fillStyle = shade(b.c, 0.85);
        ctx.fillRect(x, top, b.w, 6);
        if (b.orn) ctx.fillRect(x, top + 40, b.w, 4);
        if (b.dome) { ctx.beginPath(); ctx.arc(x + b.w / 2, top, 22, Math.PI, 0); ctx.fill(); }
        ctx.fillStyle = '#6d7f8c';
        const cols = Math.max(2, Math.floor(b.w / 38));
        const gap = b.w / cols;
        for (let r = 0; r < 4; r++) {
          const wy = top + 16 + r * 36;
          if (wy > 250) break;
          for (let c = 0; c < cols; c++) ctx.fillRect(x + c * gap + gap * 0.3, wy, gap * 0.4, 20);
        }
      }
    }
    ctx.fillStyle = '#a7a39a';
    ctx.fillRect(0, 262, W, 14);
    // passing street lamps give a sense of speed
    ctx.strokeStyle = '#3b3b3b';
    ctx.lineWidth = 4;
    const lo = (scroll * 1.6) % 300;
    for (let x = -lo; x < W + 300; x += 300) line(x, 272, x, 150);
  }

  function drawRiverOutside(scroll) {
    const sky = ctx.createLinearGradient(0, 80, 0, 280);
    sky.addColorStop(0, '#9fd3f2');
    sky.addColorStop(1, '#f7e1b5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 78, W, 230);
    drawGellertHill(640 - (scroll * 0.05) % 400, 205, 0.7);
    ctx.fillStyle = '#3c7ea8';
    ctx.fillRect(0, 205, W, 80);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const x = (i * 97 - scroll * 0.3) % (W + 100);
      line(x < -50 ? x + W + 100 : x, 215 + (i % 4) * 15, (x < -50 ? x + W + 100 : x) + 40, 215 + (i % 4) * 15);
    }
    ctx.strokeStyle = '#415a4b';
    ctx.lineWidth = 6;
    line(0, 238, W, 238);
    ctx.lineWidth = 4;
    const po = (scroll * 1.2) % 60;
    for (let x = -po; x < W + 60; x += 60) line(x, 238, x, 285);
  }

  const WINDOWS = [[40, 250], [330, 300], [690, 230]];

  function drawTramInterior(led) {
    ctx.fillStyle = '#3d3f44';
    ctx.fillRect(0, 0, W, 78);
    ctx.fillStyle = '#d8d3c6';
    ctx.fillRect(0, 78, W, 22);
    ctx.fillRect(0, 272, W, 70);
    let px = 0;
    for (const [x, w] of WINDOWS) { ctx.fillRect(px, 100, x - px, 172); px = x + w; }
    ctx.fillRect(px, 100, W - px, 172);
    ctx.strokeStyle = '#8f8a7e';
    ctx.lineWidth = 5;
    for (const [x, w] of WINDOWS) { rr(x, 100, w, 172, 12); ctx.stroke(); }
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(0, 300, W, 8);
    const fg = ctx.createLinearGradient(0, 342, 0, H);
    fg.addColorStop(0, '#7a776f');
    fg.addColorStop(1, '#4b4945');
    ctx.fillStyle = fg;
    ctx.fillRect(0, 342, W, H - 342);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 360; y < H; y += 22) for (let x = (y / 22 % 2) * 11; x < W; x += 22) circle(x, y, 2);
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = 5;
    line(0, 90, W, 90);
    ctx.lineWidth = 3;
    for (let x = 60; x < W; x += 95) {
      line(x, 90, x, 112);
      ctx.beginPath();
      ctx.arc(x, 120, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 9;
    line(310, 78, 310, 470);
    line(655, 78, 655, 470);
    ctx.fillStyle = '#111';
    rr(290, 14, 380, 48, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,157,28,0.08)';
    rr(296, 20, 368, 36, 4);
    ctx.fill();
    text(led, 480, 38, led.length > 30 ? 16 : 19, '#ff9d1c', 'center', '700');
  }

  function drawRideScene(view, led, playerOpts) {
    const tilt = curveAmt() * 0.035 * (R.seg % 2 ? 1 : -1);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(tilt);
    ctx.translate(-W / 2, -H / 2);
    if (view === 'river') drawRiverOutside(R.scroll);
    else drawCityOutside(R.scroll, R.city);
    drawTramInterior(led);
    const c = curveAmt();
    for (const p of PASSENGERS) {
      drawPerson(p.x, 470, Object.assign({}, p, { lean: c * 0.12 * (R.seg % 2 ? 1 : -1) }));
    }
    drawPerson(480, 470, playerOpts);
    if (R.insp) {
      drawPerson(R.insp.x, 470, {
        s: 1.08, shirt: '#2d3436', pants: '#1e272e', skin: '#f1c27d', hair: '#555555',
        cap: '#2d3436', band: '#6c5ce7', run: R.insp.walking, phase: R.insp.phase,
        amp: R.insp.walking ? 0.6 : 0, flip: true,
      });
    }
    if (R.passT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, R.passT * 2);
      ctx.fillStyle = '#fff';
      rr(500, 318, 70, 44, 6);
      ctx.fill();
      ctx.fillStyle = '#1f6feb';
      ctx.fillRect(500, 318, 70, 12);
      text('DIÁK', 535, 344, 14, '#1f6feb');
      ctx.restore();
    }
    ctx.restore();
  }

  function playerStyle(extra) {
    return Object.assign({
      s: 1.1, shirt: '#1f6feb', pants: '#243447', skin: '#f1c27d', hair: '#4a2c17', bag: '#e4572e',
    }, extra);
  }

  function drawRide() {
    const last = isLastSeg();
    const nextStop = STOPS[R.seg + 1];
    const led = R.t < MOVE ? `Következik: ${nextStop}` : nextStop;
    const c = curveAmt();
    const held = isHeld();
    let lean = 0;
    if (R.fall > 0) lean = Math.sin(Math.PI * (1 - R.fall / 1.2)) * 1.1 * (R.seg % 2 ? 1 : -1);
    else if (c > 0) lean = c * (held ? 0.05 : 0.3) * (R.seg % 2 ? 1 : -1);
    drawRideScene(last && R.t > 0.8 ? 'river' : 'city', led, playerStyle({ lean, armUp: held && R.fall <= 0 }));

    const ev = R.evs[R.seg];
    if (ev === 'curve' && !R.res && R.t >= CW0) {
      const active = R.t >= CA0;
      const flash = Math.floor(titleT * 6) % 2 === 0;
      banner(active ? 'HOLD ON! (hold Space)' : '⚠ SHARP CURVE AHEAD: HOLD (Space)', active ? '#ffd23f' : (flash ? '#ff7b54' : '#ffd23f'));
      if (active) {
        const need = (CA1 - CA0) * 0.7;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        rr(380, 402, 200, 16, 8);
        ctx.fill();
        ctx.fillStyle = R.held >= need ? '#7CFC9A' : '#ffd23f';
        rr(380, 402, 200 * clamp(R.held / need, 0, 1), 16, 8);
        ctx.fill();
      }
    } else if (ev === 'insp' && !R.res && R.t >= IA) {
      const ready = R.t >= IARR;
      banner(ready ? 'TAP / SPACE NOW: show your pass!' : 'Jegyellenőr! Ticket inspector coming…', ready ? '#7CFC9A' : '#ffd23f');
    }
  }

  function banner(msg, color) {
    ctx.font = '800 26px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const w = ctx.measureText(msg).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    rr(W / 2 - w / 2, 356, w, 44, 12);
    ctx.fill();
    text(msg, W / 2, 379, 26, color, 'center', '800');
  }

  // ================================================================ STUCK
  let S;
  function initStuck() {
    S = { t: 0, green: false, timer: rand(0.9, 1.5), lock: 0, done: false, doneT: 0 };
  }
  function updateStuck(dt) {
    S.t += dt;
    G.clock += RIDE_RATE * dt;
    S.lock = Math.max(0, S.lock - dt);
    if (S.done) {
      S.doneT += dt;
      if (S.doneT > 0.6) goto('bridge');
      return;
    }
    S.timer -= dt;
    if (S.timer <= 0) {
      S.green = !S.green;
      S.timer = S.green ? 0.5 : rand(0.6, 1.4);
    }
  }
  function stuckTap() {
    if (S.done || S.lock > 0) return;
    if (S.green) {
      S.done = true;
      SFX.ding();
      toast('Doors open. RUN for it!', '#7CFC9A');
    } else {
      S.lock = 0.7;
      SFX.bad();
      toast('Not yet! Wait for green', '#ffd23f');
    }
  }
  function drawStuck() {
    drawRideScene('river', 'Forgalmi akadály · Traffic obstruction', playerStyle({ armUp: true }));
    // tram doors on the right
    const open = S.done ? clamp(S.doneT / 0.35, 0, 1) : 0;
    ctx.fillStyle = '#9fd3f2';
    ctx.fillRect(790, 100, 150, 370);
    ctx.fillStyle = '#b9b2a4';
    ctx.fillRect(790, 300, 150, 170);
    const pw = 75 * (1 - open * 0.85);
    ctx.fillStyle = 'rgba(40,60,70,0.75)';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 5;
    rr(790, 100, pw, 370, 4); ctx.fill(); ctx.stroke();
    rr(940 - pw, 100, pw, 370, 4); ctx.fill(); ctx.stroke();
    // door button
    const on = S.green || S.done;
    ctx.fillStyle = '#333';
    rr(738, 270, 40, 70, 8);
    ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(124,252,154,0.35)';
      circle(758, 305, 30);
    }
    ctx.fillStyle = on ? '#2ecc71' : '#e74c3c';
    circle(758, 305, 14);
    text('⇔', 758, 305, 14, '#fff');
    if (!S.done) banner(S.lock > 0 ? 'Not yet…' : 'TAP / SPACE when the door button turns GREEN', S.green ? '#7CFC9A' : '#fff');
  }

  // ================================================================ BRIDGE
  let B;
  const OBSTACLE_MSG = {
    pigeon: 'Galambok! Pigeons everywhere!',
    case: "A tourist's suitcase! Sorry!",
    barrier: 'Vágányzár! Track works barrier!',
  };

  function initBridge() {
    B = { x: 0, v: 0, y: 0, vy: 0, last: null, stumble: 0, boost: 0, obs: [], items: [], t: 0, crossed: false };
    let x = 16;
    while (x < BRIDGE_END - 8) {
      const type = pick(['pigeon', 'pigeon', 'case', 'barrier']);
      B.obs.push({ type, x, h: { pigeon: 0.45, case: 0.75, barrier: 0.95 }[type], hit: false, fly: 0, ph: rand(0, 6) });
      x += rand(11, 18);
    }
    B.obs.push({ type: 'pigeon', x: BRIDGE_END + 22, h: 0.45, hit: false, fly: 0, ph: 0 });

    const near = (px, d = 2.5) => B.obs.some(o => Math.abs(o.x - px) < d);
    const free = px => { while (near(px)) px += 1.5; return px; };
    // coin arcs over obstacles, coin rows in the gaps between them
    B.obs.forEach((o, i) => {
      if (Math.random() < 0.6) {
        for (let k = 0; k < 5; k++) B.items.push({ type: 'coin', x: o.x - 2.2 + k * 1.1, h: 1.2 + Math.sin(k / 4 * Math.PI) * 0.9 });
      }
      const nx = i + 1 < B.obs.length ? B.obs[i + 1].x : FINISH;
      if (nx - o.x > 9 && Math.random() < 0.7) {
        const mid = (o.x + nx) / 2;
        for (let k = -1; k <= 1; k++) B.items.push({ type: 'coin', x: mid + k * 1.1, h: 0.5 });
      }
    });
    B.items.push({ type: 'langos', x: free(70), h: 0.6 });
    B.items.push({ type: 'langos', x: free(150), h: 0.6 });
    B.items.push({ type: 'rudi', x: free(rand(35, 60)), h: 0.6 });
    B.items.push({ type: 'rudi', x: free(rand(115, 135)), h: 0.6 });
    B.items.push({ type: 'prof', x: free(rand(90, 180)), h: 2.1 });
    toast('Tap LEFT / RIGHT alternately to run!', '#ffd23f');
  }

  function bridgeStep(side) {
    if (B.stumble > 0) return;
    if (B.last === side) {
      B.stumble = 0.5;
      B.v *= 0.3;
      B.last = null;
      G.trips++;
      SFX.bad();
      toast('Tripped! Alternate LEFT / RIGHT', '#ffd23f');
      return;
    }
    B.last = side;
    B.v += G.stamina < 20 ? 0.9 : 1.4;
    G.stamina = Math.max(0, G.stamina - 0.7);
    SFX.step();
  }

  function bridgeJump() {
    if (B.y === 0 && B.vy === 0 && B.stumble <= 0) {
      B.vy = 9.2;
      SFX.jump();
    }
  }

  function collect(it) {
    const sx = PX + (it.x - B.x) * PPM, sy = GY - it.h * PPM;
    burst(sx, sy, it.type === 'coin' ? '#ffd23f' : '#ffffff', it.type === 'coin' ? 6 : 14);
    if (it.type === 'coin') {
      G.coins++;
      SFX.coin();
    } else if (it.type === 'langos') {
      G.stamina = Math.min(100, G.stamina + 35);
      SFX.power();
      toast('Lángos! +35 stamina', '#ffd23f');
    } else if (it.type === 'rudi') {
      B.boost = 4;
      SFX.power();
      toast('Túró Rudi power! SPEED BOOST', '#ff6b81');
    } else if (it.type === 'prof') {
      G.profLate = true;
      G.deadline += 120;
      SFX.power();
      toast('Text: "Prof is running late too" · +2:00!', '#7CFC9A');
    }
  }

  function updateBridge(dt) {
    B.t += dt;
    G.clock += RUN_RATE * dt;
    const maxV = B.boost > 0 ? 12 : (G.stamina < 20 ? 5 : 8.5);
    if (B.stumble > 0) {
      B.stumble -= dt;
      B.v = Math.max(0, B.v - 20 * dt);
    }
    if (B.boost > 0) {
      B.boost -= dt;
      if (B.stumble <= 0) B.v = Math.max(B.v, 7);
    }
    B.v -= B.v * 0.9 * dt;
    B.v = Math.min(B.v, maxV);
    B.x += B.v * dt;
    if (B.y > 0 || B.vy > 0) {
      B.vy -= 26 * dt;
      B.y += B.vy * dt;
      if (B.y <= 0) { B.y = 0; B.vy = 0; }
    }
    G.stamina = Math.min(100, G.stamina + 2.5 * dt);

    for (const o of B.obs) {
      o.ph += dt * 12;
      if (o.hit && o.type === 'pigeon') o.fly += dt;
      if (!o.hit && Math.abs(o.x - B.x) < 0.75 && B.y < o.h) {
        o.hit = true;
        B.stumble = 0.9;
        B.v = 0;
        G.trips++;
        G.shake = 0.25;
        SFX.bad();
        toast(OBSTACLE_MSG[o.type], '#ff7b54');
      }
      // pigeons scatter when you jump over them too
      if (!o.hit && o.type === 'pigeon' && Math.abs(o.x - B.x) < 1.2 && B.y >= o.h) o.hit = true;
    }
    for (const it of B.items) {
      if (!it.got && Math.abs(it.x - B.x) < 0.7 && Math.abs(B.y + 0.9 - it.h) < 0.9) {
        it.got = true;
        collect(it);
      }
    }
    if (!B.crossed && B.x >= BRIDGE_END) {
      B.crossed = true;
      toast('Buda side! BME is right there →', '#ffd23f');
    }
    if (B.x >= FINISH) {
      B.x = FINISH;
      goto('stairs');
    }
  }

  // ---------------------------------------------------------------- bridge drawing
  function drawGellertHill(cx, baseY, s) {
    ctx.fillStyle = '#6f9a74';
    ctx.beginPath();
    ctx.moveTo(cx - 420 * s, baseY);
    ctx.bezierCurveTo(cx - 250 * s, baseY - 60 * s, cx - 120 * s, baseY - 150 * s, cx, baseY - 155 * s);
    ctx.bezierCurveTo(cx + 120 * s, baseY - 150 * s, cx + 250 * s, baseY - 70 * s, cx + 460 * s, baseY);
    ctx.closePath();
    ctx.fill();
    // Citadella and the Liberty Statue on top
    ctx.fillStyle = '#8c8577';
    ctx.fillRect(cx - 40 * s, baseY - 168 * s, 80 * s, 16 * s);
    ctx.fillStyle = '#555';
    ctx.fillRect(cx - 3 * s, baseY - 215 * s, 6 * s, 50 * s);
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 215 * s);
    ctx.lineTo(cx - 14 * s, baseY - 226 * s);
    ctx.lineTo(cx + 14 * s, baseY - 230 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawTram(x0, bottom) {
    // Siemens Combino, facing right, x0 = left end in px
    const len = 32 * PPM, h = 3.3 * PPM, top = bottom - h;
    ctx.fillStyle = '#f5c400';
    rr(x0, top, len, h - 10, 10);
    ctx.fill();
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(x0, bottom - 38, len, 22);
    ctx.fillStyle = '#2f3b44';
    for (let m = 0; m < 5; m++) {
      const mx = x0 + m * len / 5;
      ctx.fillRect(mx + 20, top + 18, len / 5 - 40, 50);
      ctx.strokeStyle = '#b89400';
      ctx.lineWidth = 2;
      line(mx, top + 4, mx, bottom - 12);
    }
    ctx.fillStyle = '#222';
    rr(x0 + len - 34, top + 6, 30, 26, 4);
    ctx.fill();
    text('6', x0 + len - 19, top + 20, 20, '#ffd23f', 'center', '900');
    ctx.fillStyle = '#333';
    for (let w = 0; w < 6; w++) circle(x0 + 60 + w * (len - 120) / 5, bottom - 8, 9);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    line(x0 + len * 0.5, top, x0 + len * 0.5 + 30, top - 34);
    line(x0 + len * 0.5 + 30, top - 34, x0 + len * 0.5 + 70, top - 34);
  }

  function drawBME(sx) {
    // Main building (K épület) as a simplified neo-Renaissance facade
    const x0 = sx(222), x1 = sx(300), top = 120;
    if (x0 > W || x1 < 0) return;
    ctx.fillStyle = '#d9c49a';
    ctx.fillRect(x0, top, x1 - x0, GY - top);
    ctx.fillStyle = '#5b4a3a';
    ctx.beginPath();
    ctx.moveTo(x0 - 10, top);
    ctx.lineTo(x0 + 30, top - 40);
    ctx.lineTo(x1 - 30, top - 40);
    ctx.lineTo(x1 + 10, top);
    ctx.closePath();
    ctx.fill();
    for (const tx of [sx(236), sx(280)]) {
      ctx.fillStyle = '#cdb689';
      ctx.fillRect(tx - 45, top - 120, 90, 120);
      ctx.fillStyle = '#5b4a3a';
      ctx.beginPath();
      ctx.moveTo(tx - 55, top - 120);
      ctx.lineTo(tx, top - 200);
      ctx.lineTo(tx + 55, top - 120);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#44525c';
      ctx.fillRect(tx - 14, top - 100, 28, 50);
    }
    ctx.fillStyle = '#bfa87e';
    ctx.fillRect(x0, GY - 60, x1 - x0, 60);
    ctx.fillRect(x0, top + 6, x1 - x0, 12);
    ctx.fillStyle = '#44525c';
    for (let wx = 224; wx < 299; wx += 3.2) {
      const px = sx(wx);
      if (Math.abs(wx - FINISH) < 4) continue;
      for (const wy of [top + 40, top + 150]) {
        rr(px, wy, 44, 70, [22, 22, 2, 2]);
        ctx.fill();
      }
    }
    const dx = sx(FINISH);
    ctx.fillStyle = '#3b2b20';
    rr(dx - 40, GY - 150, 80, 150, [40, 40, 0, 0]);
    ctx.fill();
    text('BME', dx, top + 30, 26, '#5b4a3a', 'center', '900');
  }

  function drawBridgeWorld(camX, t) {
    const sx = wx => PX + (wx - camX) * PPM;
    const sky = ctx.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, '#8ec9ef');
    sky.addColorStop(1, '#f7e1b5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 340);
    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    circle(140, 90, 38);
    drawGellertHill(820 - camX * 3, 330, 1.1);
    // Pest skyline fading away on the left
    ctx.fillStyle = 'rgba(120,120,140,0.45)';
    for (let i = 0; i < 12; i++) {
      const bx = i * 60 - 300 - camX * 3;
      if (bx > -60 && bx < W) ctx.fillRect(bx, 290 - (i * 37 % 40), 50, 50 + (i * 37 % 40));
    }
    // Danube
    ctx.fillStyle = '#3c7ea8';
    ctx.fillRect(0, 330, W, H - 330);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    const wo = (camX * PPM * 0.35 + t * 25) % 120;
    for (let y = 350; y < H; y += 26) {
      for (let x = -wo + (y % 52 ? 60 : 0); x < W; x += 120) line(x, y, x + 36, y);
    }

    const endX = sx(BRIDGE_END);
    // piers and haunched girder under the deck
    ctx.fillStyle = '#4c5e53';
    for (let p = Math.floor((camX - 10) / 60) * 60; p < camX + 25; p += 60) {
      if (p > BRIDGE_END) break;
      const px = sx(p);
      ctx.fillRect(px - 22, GY + 30, 44, H - GY);
      ctx.fillStyle = '#56695c';
      ctx.beginPath();
      ctx.moveTo(px, GY + 30);
      ctx.quadraticCurveTo(px + 30 * PPM, GY + 62, Math.min(px + 60 * PPM, endX), GY + 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4c5e53';
    }
    if (endX > 0) {
      ctx.fillStyle = '#56695c';
      ctx.fillRect(0, GY, Math.min(W, endX), 32);
      ctx.fillStyle = '#6b6f73';
      ctx.fillRect(0, GY, Math.min(W, endX), 5);
    }
    if (endX < W) {
      ctx.fillStyle = '#9d9482';
      ctx.fillRect(endX, GY, W - endX, H - GY);
      ctx.fillStyle = '#bdb6a6';
      ctx.fillRect(endX, GY, W - endX, 8);
      ctx.fillStyle = '#7d7566';
      for (let y = GY + 24; y < H; y += 22) ctx.fillRect(endX, y, W - endX, 2);
    }
    drawBME(sx);
    // railing on the far side of the bridge
    ctx.strokeStyle = '#3f5147';
    ctx.lineWidth = 3;
    const rEnd = Math.min(W, endX);
    if (rEnd > 0) {
      line(0, GY - 45, rEnd, GY - 45);
      line(0, GY - 22, rEnd, GY - 22);
      for (let wx = Math.floor(camX - 8); wx < camX + 19 && wx <= BRIDGE_END; wx += 1.5) line(sx(wx), GY, sx(wx), GY - 45);
    }
    // lamps on the Buda embankment
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 4;
    for (let lx = BRIDGE_END + 6; lx < FINISH - 20; lx += 14) {
      const px = sx(lx);
      if (px < -20 || px > W + 20) continue;
      line(px, GY, px, GY - 150);
      ctx.fillStyle = '#ffe9a6';
      circle(px + 8, GY - 150, 7);
    }
    const tramX = sx(-34);
    if (tramX < W && tramX + 32 * PPM > 0) drawTram(tramX, GY + 2);
  }

  function drawItem(it, x, y, t) {
    const bob = Math.sin(t * 4 + it.x) * 3;
    y += bob;
    if (it.type === 'coin') {
      const w = Math.max(0.15, Math.abs(Math.cos(t * 4 + it.x)));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(w, 1);
      ctx.fillStyle = '#e6a700';
      circle(0, 0, 10);
      ctx.fillStyle = '#ffd23f';
      circle(0, 0, 7);
      ctx.restore();
    } else if (it.type === 'langos') {
      ctx.fillStyle = '#c98a3a';
      ctx.beginPath(); ctx.ellipse(x, y, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b25c';
      ctx.beginPath(); ctx.ellipse(x, y - 2, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); ctx.ellipse(x - 2, y - 3, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4d03f';
      circle(x + 5, y - 4, 3);
    } else if (it.type === 'rudi') {
      ctx.fillStyle = '#d7263d';
      rr(x - 16, y - 7, 32, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = -12; i <= 12; i += 6) circle(x + i, y + ((i / 6) % 2 ? 3 : -3), 2);
    } else if (it.type === 'prof') {
      ctx.fillStyle = 'rgba(124,252,154,0.35)';
      circle(x, y, 24);
      ctx.fillStyle = '#fff';
      rr(x - 17, y - 14, 34, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#1f6feb';
      ctx.fillRect(x - 17, y - 14, 34, 8);
      text('+2:00', x, y + 4, 11, '#1f6feb', 'center', '800');
    }
  }

  function drawObstacle(o, x, t) {
    if (o.type === 'pigeon') {
      for (const [dx, k] of [[-10, 0], [10, 1.7]]) {
        const fy = o.fly * 260, fx = o.fly * 120 * (k ? 1 : -0.5);
        const px = x + dx + fx, py = GY - 10 - fy;
        if (py < -30) continue;
        ctx.fillStyle = '#8a8f98';
        ctx.beginPath(); ctx.ellipse(px, py, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6b7079';
        circle(px + 9, py - 6, 5);
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(px + 13, py - 6, 4, 2);
        const flap = o.fly > 0 ? Math.sin(o.ph * 2) * 10 : Math.sin(o.ph * 0.3 + k) * 2;
        ctx.fillStyle = '#9aa0aa';
        ctx.beginPath();
        ctx.moveTo(px - 4, py - 2);
        ctx.lineTo(px - 14, py - 8 - flap);
        ctx.lineTo(px + 4, py - 3);
        ctx.fill();
      }
    } else if (o.type === 'case') {
      const h = o.h * PPM, w = 26;
      ctx.fillStyle = '#c0398b';
      rr(x - w / 2, GY - h, w, h - 4, 5);
      ctx.fill();
      ctx.strokeStyle = '#7a1f58';
      ctx.lineWidth = 3;
      line(x - 4, GY - h, x - 4, GY - h - 10);
      line(x + 4, GY - h, x + 4, GY - h - 10);
      line(x - 4, GY - h - 10, x + 4, GY - h - 10);
      ctx.fillStyle = '#ffd23f';
      circle(x - 5, GY - h / 2, 4);
      ctx.fillStyle = '#222';
      circle(x - 7, GY - 2, 3);
      circle(x + 7, GY - 2, 3);
    } else if (o.type === 'barrier') {
      const h = o.h * PPM;
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 4;
      line(x - 16, GY, x - 16, GY - h);
      line(x + 16, GY, x + 16, GY - h);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : '#e74c3c';
        ctx.fillRect(x - 22 + i * 11, GY - h, 11, 12);
      }
      ctx.fillStyle = '#f39c12';
      circle(x, GY - h - 5, 4);
    }
  }

  function drawBridge() {
    drawBridgeWorld(B.x, B.t);
    const sx = wx => PX + (wx - B.x) * PPM;
    for (const o of B.obs) {
      const x = sx(o.x);
      if (x > -60 && x < W + 60) drawObstacle(o, x, B.t);
    }
    for (const it of B.items) {
      if (it.got) continue;
      const x = sx(it.x);
      if (x > -40 && x < W + 40) drawItem(it, x, GY - it.h * PPM, B.t);
    }
    const py = GY - B.y * PPM;
    if (B.boost > 0) {
      ctx.strokeStyle = 'rgba(255,107,129,0.6)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const ly = py - 20 - i * 18, lo = (B.t * 600 + i * 50) % 80;
        line(PX - 40 - lo, ly, PX - 90 - lo, ly);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(PX, GY + 2, 20 - B.y * 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    drawPerson(PX, py, playerStyle({
      run: true, phase: B.x * 1.7, amp: B.y > 0 ? 0.4 : Math.min(1, B.v / 3),
      lean: B.stumble > 0 ? 0.7 : 0.08 + B.v / 70,
    }));
    drawStepButtons(B.last, true);
  }

  // ================================================================ STAIRS
  let St;
  const stairX = i => 140 + i * 32;
  const stairY = i => 480 - i * 14;

  function initStairs() {
    St = { step: 0, shown: 0, last: null, stumble: 0, t: 0, done: false, doneT: 0 };
    toast('Up the stairs! Keep alternating', '#ffd23f');
  }
  function updateStairs(dt) {
    St.t += dt;
    St.shown += (St.step - St.shown) * Math.min(1, dt * 14);
    St.stumble = Math.max(0, St.stumble - dt);
    if (St.done) {
      St.doneT += dt;
      if (St.doneT > 0.7) goto('result');
      return;
    }
    G.clock += RUN_RATE * dt;
  }
  function stairsStep(side) {
    if (St.done || St.stumble > 0) return;
    if (St.last === side) {
      St.step = Math.max(0, St.step - 1);
      St.stumble = 0.35;
      St.last = null;
      G.trips++;
      SFX.bad();
      toast('Slipped a step!', '#ff7b54');
      return;
    }
    St.last = side;
    St.step++;
    SFX.step();
    if (St.step >= STAIRS_N) {
      St.done = true;
      G.finish = G.clock;
    }
  }

  function doorClosed() {
    const t = G.finish || G.clock;
    return clamp((t - (G.deadline - 40)) / 40, 0, 1);
  }

  function drawStairsScene(showPlayer) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#8ec9ef');
    sky.addColorStop(1, '#f7e1b5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // facade
    ctx.fillStyle = '#d9c49a';
    ctx.fillRect(40, 30, W - 80, H);
    ctx.fillStyle = '#5b4a3a';
    ctx.fillRect(20, 20, W - 40, 22);
    ctx.fillStyle = '#bfa87e';
    ctx.fillRect(40, 42, W - 80, 36);
    text('BUDAPESTI MŰSZAKI EGYETEM', W / 2, 61, 22, '#5b4a3a', 'center', '800');
    ctx.fillStyle = '#44525c';
    for (let x = 80; x < W - 80; x += 110) {
      if (x > 620 && x < 820) continue;
      rr(x, 110, 50, 90, [25, 25, 2, 2]);
      ctx.fill();
    }
    ctx.fillStyle = '#cdb689';
    for (let x = 60; x < W - 40; x += 110) ctx.fillRect(x, 90, 12, H);
    // doorway at the top of the stairs
    const top = stairY(STAIRS_N);
    ctx.fillStyle = '#1b130d';
    rr(700, top - 130, 110, 130, [55, 55, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#f5e6b8';
    rr(706, top - 124, 98, 124, [49, 49, 0, 0]);
    ctx.fill();
    // professor holding the door
    const closed = doorClosed();
    drawPerson(790, top, {
      s: 1.05, shirt: '#6d4c41', pants: '#3e2723', skin: '#f1c27d', hair: '#e0e0e0', glasses: true, flip: true,
    });
    ctx.fillStyle = '#6b3f23';
    ctx.strokeStyle = '#3b2314';
    ctx.lineWidth = 3;
    rr(706, top - 124, 98 * closed, 124, [49, 0, 0, 0]);
    ctx.fill();
    if (closed > 0) ctx.stroke();
    text('K', 755, top - 145, 18, '#5b4a3a', 'center', '900');
    // staircase (solid mass, painted bottom-up)
    for (let i = 0; i < STAIRS_N; i++) {
      const x0 = stairX(i);
      ctx.fillStyle = i % 2 ? '#c9c2b2' : '#bdb5a3';
      ctx.fillRect(x0, stairY(i) - 14, 880 - x0, H);
      ctx.fillStyle = '#e2dccd';
      ctx.fillRect(x0, stairY(i) - 14, 880 - x0, 3);
    }
    ctx.fillStyle = '#9d9482';
    ctx.fillRect(0, stairY(0), stairX(0), H);
    if (showPlayer) {
      const s = St.shown;
      drawPerson(stairX(s) - 16, stairY(s), playerStyle({
        run: true, phase: s * Math.PI, amp: 0.8, lean: St.stumble > 0 ? -0.4 : 0.25,
      }));
    }
  }

  function drawStairs() {
    drawStairsScene(true);
    drawStepButtons(St.last, false);
  }

  // ================================================================ RESULT
  let Res;
  function initResult() {
    const early = G.deadline - G.finish;
    const made = early >= 0;
    const score = (made ? 1000 + Math.round(early * 5) : 0) + G.coins * 10;
    const newBest = score > best;
    if (newBest) { best = score; saveBest(best); }
    let quip;
    if (!made) quip = early > -120 ? 'The professor gave you The Look through the glass.' : "You'll be watching the lecture recording. Maybe.";
    else if (early > 180) quip = 'So early you got the front row seat. Nerd.';
    else if (early > 60) quip = 'Sat down just as the slides came up.';
    else quip = 'Slid in as the door closed. Classic BME.';
    Res = { t: 0, early, made, score, newBest, quip };
    if (made) SFX.good(); else SFX.bad();
  }

  function drawResult() {
    drawStairsScene(false);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    const k = clamp(Res.t * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(20,24,30,0.92)';
    rr(W / 2 - 300, 70, 600, 400, 18);
    ctx.fill();
    ctx.strokeStyle = Res.made ? '#7CFC9A' : '#ff7b54';
    ctx.lineWidth = 3;
    ctx.stroke();
    text(Res.made ? 'MADE IT! 🎓' : 'DOOR CLOSED 🚪', W / 2, 118, 42, Res.made ? '#7CFC9A' : '#ff7b54', 'center', '900');
    text(`Arrived ${fmtClock(G.finish)} · class at ${fmtClock(G.deadline).slice(0, 5)}${G.profLate ? ' (prof late)' : ''}`, W / 2, 170, 18, '#ddd', 'center', '600');
    text(Res.made ? `${fmtDur(Res.early)} early` : `${fmtDur(Res.early)} late`, W / 2, 210, 30, '#fff', 'center', '800');
    text(Res.quip, W / 2, 250, 17, '#ffd23f', 'center', '600');
    const stats = [['Coins', G.coins], ['Falls', G.falls], ['Fines', G.fines], ['Trips', G.trips]];
    stats.forEach(([label, v], i) => {
      const x = W / 2 - 210 + i * 140;
      text(String(v), x, 300, 28, '#fff', 'center', '800');
      text(label, x, 328, 14, '#aaa', 'center', '600');
    });
    text(`Score ${Res.score}`, W / 2, 378, 30, '#fff', 'center', '900');
    text(Res.newBest ? 'New best!' : `Best ${best}`, W / 2, 410, 16, Res.newBest ? '#7CFC9A' : '#aaa', 'center', '700');
    if (Res.t > 0.8) text('Tap or press Space to ride again', W / 2, 446, 16, Math.floor(titleT * 2) % 2 ? '#fff' : '#bbb', 'center', '600');
    ctx.restore();
  }

  // ================================================================ TITLE
  function drawTitle() {
    drawBridgeWorld(-6 + Math.sin(titleT * 0.3) * 3, titleT);
    drawPerson(PX, GY, playerStyle({ run: true, phase: titleT * 8, amp: 0.9, lean: 0.12 }));
    ctx.fillStyle = 'rgba(10,12,16,0.62)';
    rr(W / 2 - 330, 50, 660, 330, 20);
    ctx.fill();
    text('BRIDGE SPRINT', W / 2, 105, 56, '#f5c400', 'center', '900');
    text('Tram 4/6 · Budapest · Get to BME by 08:15', W / 2, 150, 20, '#fff', 'center', '600');
    const lines = [
      ['🚋', 'Ride the Combino: HOLD on sharp curves, TAP for the inspector'],
      ['🚪', 'Stuck on Petőfi híd? Tap when the door button turns green'],
      ['🏃', 'Run: alternate LEFT / RIGHT taps · tap the top half to JUMP'],
      ['🥯', 'Grab lángos (stamina), Túró Rudi (boost) and the +2:00 text'],
    ];
    lines.forEach(([icon, l], i) => {
      text(icon, W / 2 - 290, 200 + i * 34, 20, '#fff', 'center', '400');
      text(l, W / 2 - 268, 200 + i * 34, 17, '#ddd', 'left', '500');
    });
    text('Keyboard: ← → (or A D) run · Space hold / tap / jump · M mute', W / 2, 340, 15, '#bbb', 'center', '600');
    ctx.fillStyle = 'rgba(10,12,16,0.7)';
    rr(W / 2 - 190, 402, 380, 46, 23);
    ctx.fill();
    text('Tap or press Space to start', W / 2, 425, 24, Math.floor(titleT * 2) % 2 ? '#ffd23f' : '#fff', 'center', '800');
    if (best > 0) text(`Best score ${best}`, W / 2, 470, 16, '#fff', 'center', '600');
  }

  // ================================================================ shared drawing
  function drawPerson(x, y, o) {
    const s = o.s || 1, amp = o.amp === undefined ? (o.run ? 1 : 0) : o.amp;
    const sw = Math.sin(o.phase || 0) * 0.75 * amp;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.flip ? -s : s, s);
    ctx.rotate(o.lean || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const hipY = -46, shY = -84;
    limb(0, hipY, -sw, 46, 9, shade(o.pants));
    if (!o.armUp) limb(0, shY, sw * 0.9, 34, 7, shade(o.shirt));
    if (o.bag) {
      ctx.fillStyle = o.bag;
      rr(-24, -88, 14, 34, 5);
      ctx.fill();
    }
    ctx.fillStyle = o.shirt;
    rr(-12, -90, 24, 48, 9);
    ctx.fill();
    if (o.band) {
      ctx.fillStyle = o.band;
      ctx.fillRect(-12, -76, 24, 6);
    }
    limb(0, hipY, sw, 46, 9, o.pants);
    if (o.armUp) {
      ctx.strokeStyle = o.shirt;
      ctx.lineWidth = 7;
      line(4, shY, 12, shY - 40);
      ctx.fillStyle = o.skin;
      circle(12, shY - 42, 4.5);
    } else {
      limb(0, shY, -sw * 0.9, 34, 7, o.shirt, o.skin);
    }
    ctx.fillStyle = o.skin;
    circle(3, -102, 11);
    ctx.fillStyle = o.hair;
    ctx.beginPath();
    ctx.arc(3, -104, 11.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    if (o.cap) {
      ctx.fillStyle = o.cap;
      rr(-9, -119, 24, 9, 3);
      ctx.fill();
      rr(8, -113, 12, 4, 2);
      ctx.fill();
    }
    ctx.fillStyle = '#222';
    circle(9, -103, 1.6);
    if (o.glasses) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(5, -106, 7, 5);
    }
    ctx.restore();
  }

  function limb(x, y, a, len, w, color, hand) {
    const ex = x + Math.sin(a) * len, ey = y + Math.cos(a) * len;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    line(x, y, ex, ey);
    if (hand) {
      ctx.fillStyle = hand;
      circle(ex, ey, 4);
    }
  }

  function drawStepButtons(last, canJump) {
    for (const [side, x] of [['L', 90], ['R', W - 90]]) {
      const next = last !== side;
      ctx.globalAlpha = next ? 0.85 : 0.3;
      ctx.fillStyle = next ? '#ffd23f' : '#ffffff';
      circle(x, H - 80, 50);
      ctx.globalAlpha = 1;
      text(side === 'L' ? '◀ L' : 'R ▶', x, H - 88, 24, '#222', 'center', '900');
      text(side === 'L' ? '← or A' : '→ or D', x, H - 62, 13, '#222', 'center', '700');
    }
    text(canJump ? 'Alternate ← / → to run · Space or ↑ to jump (touch: tap top half)' : 'Alternate ← / → to climb',
      W / 2, H - 22, 15, 'rgba(255,255,255,0.85)', 'center', '600');
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(60, 200);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.6, color });
    }
  }

  function drawHUD() {
    const left = G.deadline - G.clock;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(12, 12, 220, 78, 12);
    ctx.fill();
    text(fmtClock(G.clock), 122, 40, 32, left < 0 ? '#ff5d5d' : left < 90 ? '#ffd23f' : '#fff', 'center', '800');
    text(`Class ${fmtClock(G.deadline).slice(0, 5)}${G.profLate ? ' · prof late!' : ''}`, 122, 72, 14, '#ccc', 'center', '600');

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(W - 232, 12, 220, 78, 12);
    ctx.fill();
    text('Stamina', W - 218, 32, 13, '#ccc', 'left', '600');
    ctx.fillStyle = '#333';
    rr(W - 218, 44, 190, 12, 6);
    ctx.fill();
    ctx.fillStyle = G.stamina < 20 ? '#ff5d5d' : '#7CFC9A';
    rr(W - 218, 44, 190 * G.stamina / 100, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    circle(W - 210, 74, 7);
    text(`${G.coins}`, W - 196, 74, 16, '#fff', 'left', '700');
    const where = state === 'ride' ? `${R.seg + 1}/${STOPS.length - 1} stops`
      : state === 'stuck' ? 'Petőfi híd' : state === 'bridge' ? `${Math.max(0, Math.round(FINISH - B.x))} m to BME` : 'K building';
    text(where, W - 26, 74, 14, '#ccc', 'right', '600');
  }

  function drawToasts() {
    toasts.forEach((tt, i) => {
      const a = tt.t < 0.15 ? tt.t / 0.15 : tt.t > 1.9 ? Math.max(0, (2.3 - tt.t) / 0.4) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '700 18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      const w = ctx.measureText(tt.msg).width + 30;
      const y = 120 + i * 40;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      rr(W / 2 - w / 2, y - 16, w, 32, 10);
      ctx.fill();
      text(tt.msg, W / 2, y, 18, tt.color, 'center', '700');
      ctx.restore();
    });
  }

  // ================================================================ loop
  function update(dt) {
    titleT += dt;
    toasts.forEach(t => { t.t += dt; });
    toasts = toasts.filter(t => t.t < 2.3);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);

    if (fade.dir === 1) {
      fade.a += dt * 3.5;
      if (fade.a >= 1) { fade.a = 1; enter(fade.next); fade.dir = -1; }
      return;
    }
    if (fade.dir === -1) {
      fade.a -= dt * 3.5;
      if (fade.a <= 0) { fade.a = 0; fade.dir = 0; }
    }
    if (G) G.shake = Math.max(0, G.shake - dt);
    switch (state) {
      case 'ride': updateRide(dt); break;
      case 'stuck': updateStuck(dt); break;
      case 'bridge': updateBridge(dt); break;
      case 'stairs': updateStairs(dt); break;
      case 'result': Res.t += dt; break;
    }
  }

  function render() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.save();
    if (G && G.shake > 0) ctx.translate(rand(-1, 1) * G.shake * 20, rand(-1, 1) * G.shake * 20);
    switch (state) {
      case 'title': drawTitle(); break;
      case 'ride': drawRide(); break;
      case 'stuck': drawStuck(); break;
      case 'bridge': drawBridge(); break;
      case 'stairs': drawStairs(); break;
      case 'result': drawResult(); break;
    }
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
      ctx.fillStyle = p.color;
      circle(p.x, p.y, 3);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (state !== 'title' && state !== 'result') drawHUD();
    drawToasts();
    if (!focused && state !== 'result') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      rr(W / 2 - 200, H - 60, 400, 34, 17);
      ctx.fill();
      text('Click the game to use the keyboard', W / 2, H - 43, 15, '#ffd23f', 'center', '700');
    }
    if (fade.a > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade.a})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Small hook for automated smoke tests; harmless in normal play.
  window.__bridgeSprint = { get state() { return state; }, get G() { return G; }, get B() { return B; } };
})();
