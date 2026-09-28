'use strict';
// ---------------------------------------------------------------------------
// Low-level engine: 320x200 CGA-style screen, pixel font, sprites, input and
// PC-speaker style sound. Everything else in the game builds on these.
// ---------------------------------------------------------------------------

const W = 320;
const H = 200;

// CGA palette 1, high intensity: the classic black / cyan / magenta / white.
const COL = { k: '#000000', c: '#55ffff', m: '#ff55ff', w: '#ffffff' };

const screenCanvas = document.getElementById('screen');
screenCanvas.width = W;
screenCanvas.height = H;
let g = screenCanvas.getContext('2d');
g.imageSmoothingEnabled = false;

// Run a drawing function against an offscreen canvas and return the canvas.
function makeLayer(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const prev = g;
  g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  try { fn(); } finally { g = prev; }
  return c;
}

function color(c) { return COL[c] || c; }

function rect(x, y, w, h, c) {
  g.fillStyle = color(c);
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function px(x, y, c) { rect(x, y, 1, 1, c); }

function hline(x1, x2, y, c) { rect(Math.min(x1, x2), y, Math.abs(x2 - x1) + 1, 1, c); }

function vline(x, y1, y2, c) { rect(x, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1, c); }

function line(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  g.fillStyle = color(c);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function frame(x, y, w, h, c) {
  hline(x, x + w - 1, y, c);
  hline(x, x + w - 1, y + h - 1, c);
  vline(x, y, y + h - 1, c);
  vline(x + w - 1, y, y + h - 1, c);
}

// Filled or outlined ellipse, drawn with horizontal spans so it stays crisp.
function ellipse(cx, cy, rx, ry, c, fill = true) {
  g.fillStyle = color(c);
  let prevDx = null;
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    const y = Math.round(cy + dy);
    if (fill) {
      g.fillRect(Math.round(cx - dx), y, dx * 2 + 1, 1);
    } else {
      const from = prevDx === null ? 0 : Math.min(prevDx, dx);
      const run = Math.max(1, dx - from);
      g.fillRect(Math.round(cx - dx), y, run, 1);
      g.fillRect(Math.round(cx + dx - run + 1), y, run, 1);
    }
    prevDx = dx;
  }
}

// 2-colour ordered patterns (anchored to the canvas origin, like CGA dithering).
const patternCache = {};
function pattern(name, c1, c2) {
  const key = name + c1 + c2;
  if (patternCache[key]) return patternCache[key];
  const defs = {
    checker: ['ab', 'ba'],
    sparse: ['abbb', 'bbbb', 'bbab', 'bbbb'],
    dots: ['abbbbbbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbabbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb'],
    hstripe: ['a', 'b'],
    brick: [
      'aaaaaaaaaaaaaaaa',
      'bbbbbbbabbbbbbbb',
      'bbbbbbbabbbbbbbb',
      'bbbbbbbabbbbbbbb',
      'aaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbba',
      'bbbbbbbbbbbbbbba',
      'bbbbbbbbbbbbbbba',
    ],
    wallpaper: [
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbabbbbbbbb',
      'bbbbbbabababbbbb',
      'bbbbbbbabbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'abbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbb',
    ],
  };
  const rows = defs[name];
  const cv = document.createElement('canvas');
  cv.width = rows[0].length;
  cv.height = rows.length;
  const cx = cv.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const cc = ch === 'a' ? c1 : c2;
      if (cc) { cx.fillStyle = color(cc); cx.fillRect(x, y, 1, 1); }
    });
  });
  patternCache[key] = cv;
  return cv;
}

function patRect(x, y, w, h, name, c1, c2) {
  g.fillStyle = g.createPattern(pattern(name, c1, c2), 'repeat');
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ---------------------------------------------------------------------------
// 5x7 pixel font (drawn for this project). Each glyph is 7 rows of 5 bits.
// ---------------------------------------------------------------------------
const GLYPHS = {
  A: [0x0e, 0x11, 0x11, 0x11, 0x1f, 0x11, 0x11], B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e], D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f], F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e], J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d], R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e], T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a], X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x11, 0x0a, 0x04, 0x04, 0x04], Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e], 1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  2: [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f], 3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02], 5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e], 7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e], 9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0x0c, 0x0c], ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04], '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0], '-': [0, 0, 0, 0x1f, 0, 0, 0],
  '/': [0, 0x01, 0x02, 0x04, 0x08, 0x10, 0], "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02], ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0], '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02], '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  '*': [0, 0x0a, 0x1f, 0x1f, 0x0e, 0x04, 0], // heart
  '~': [0, 0x0a, 0x15, 0x11, 0x0a, 0x04, 0], // hollow heart
  '#': [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
};

const glyphCache = {};
function glyph(ch, c) {
  const key = ch + c;
  if (glyphCache[key]) return glyphCache[key];
  const bits = GLYPHS[ch] || GLYPHS['?'];
  const cv = document.createElement('canvas');
  cv.width = 5;
  cv.height = 7;
  const cx = cv.getContext('2d');
  cx.fillStyle = color(c);
  bits.forEach((row, y) => {
    for (let x = 0; x < 5; x++) if (row & (0x10 >> x)) cx.fillRect(x, y, 1, 1);
  });
  glyphCache[key] = cv;
  return cv;
}

function textWidth(str, scale = 1) { return str.length * 6 * scale - scale; }

function text(str, x, y, c = 'w', scale = 1) {
  str = String(str).toUpperCase();
  x = Math.round(x); y = Math.round(y);
  for (let i = 0; i < str.length; i++) {
    g.drawImage(glyph(str[i], c), x + i * 6 * scale, y, 5 * scale, 7 * scale);
  }
}

function ctext(str, y, c = 'w', scale = 1, cx = W / 2) {
  text(str, Math.round(cx - textWidth(String(str), scale) / 2), y, c, scale);
}

// Text with a 1px black shadow/outline so it reads over busy backgrounds.
function stext(str, x, y, c = 'w', scale = 1) {
  text(str, x + scale, y + scale, 'k', scale);
  text(str, x, y, c, scale);
}

function sctext(str, y, c = 'w', scale = 1, cx = W / 2) {
  stext(str, Math.round(cx - textWidth(String(str), scale) / 2), y, c, scale);
}

// ---------------------------------------------------------------------------
// Sprites: ASCII art rows -> canvas (plus a mirrored copy).
// '.' is transparent; other characters index COL (optionally remapped).
// ---------------------------------------------------------------------------
function makeSprite(rows, remap = {}) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const build = (flip) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext('2d');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return;
        const cc = remap[ch] || ch;
        cx.fillStyle = color(cc);
        cx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
      });
    });
    return cv;
  };
  return { w, h, img: build(false), flipped: build(true) };
}

// Draw a sprite with its bottom-centre at (x, y), which is how most actors
// in the game are positioned (x = centre, y = feet).
function drawSprite(s, x, y, faceLeft = false, upsideDown = false) {
  const left = Math.round(x - s.w / 2);
  const top = Math.round(y - s.h);
  const img = faceLeft ? s.flipped : s.img;
  if (upsideDown) {
    g.save();
    g.translate(left, top + s.h);
    g.scale(1, -1);
    g.drawImage(img, 0, 0);
    g.restore();
  } else {
    g.drawImage(img, left, top);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let platformIds = 0;
// A one-way platform the cat can stand on. `solid` platforms (floors) can't
// be dropped through; `vx` makes it a conveyor that carries the cat along.
function plat(x1, x2, y, opts = {}) {
  return Object.assign({ id: 'p' + platformIds++, x1, x2, y, vx: 0, solid: false }, opts);
}

// ---------------------------------------------------------------------------
// Input: keyboard + on-screen touch buttons, mapped to abstract actions.
// ---------------------------------------------------------------------------
const Input = {
  held: {},
  pressed: {},
  keyMap: {
    ArrowLeft: 'left', KeyA: 'left', Numpad4: 'left',
    ArrowRight: 'right', KeyD: 'right', Numpad6: 'right',
    ArrowUp: 'up', KeyW: 'up', Space: 'up', Numpad8: 'up',
    ArrowDown: 'down', KeyS: 'down', Numpad2: 'down',
    Enter: 'start', NumpadEnter: 'start',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute',
  },
  press(action) {
    if (!this.held[action]) this.pressed[action] = true;
    this.held[action] = true;
    Sound.unlock();
  },
  release(action) { this.held[action] = false; },
  endStep() { this.pressed = {}; },
  anyStart() { return this.pressed.start || this.pressed.up; },
};

window.addEventListener('keydown', (e) => {
  const a = Input.keyMap[e.code];
  if (!a) return;
  e.preventDefault();
  if (e.code === 'Space') Input.press('start');
  Input.press(a);
});
window.addEventListener('keyup', (e) => {
  const a = Input.keyMap[e.code];
  if (!a) return;
  e.preventDefault();
  if (e.code === 'Space') Input.release('start');
  Input.release(a);
});
window.addEventListener('blur', () => { Input.held = {}; });

function bindTouchButtons(root) {
  root.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    const down = (e) => { e.preventDefault(); btn.classList.add('on'); Input.press(action); };
    const up = (e) => { e.preventDefault(); btn.classList.remove('on'); Input.release(action); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });
}

// ---------------------------------------------------------------------------
// Sound: square-wave beeps in the spirit of the PC speaker.
// ---------------------------------------------------------------------------
const Sound = {
  ac: null,
  muted: false,
  noiseBuf: null,
  unlock() {
    if (!this.ac) {
      try {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ac.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ac.destination);
        const len = this.ac.sampleRate * 0.5;
        this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) {
        this.ac = null;
      }
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },
  tone(freq, dur, opts = {}) {
    if (!this.ac || this.muted) return;
    const { type = 'square', vol = 0.08, to = null, delay = 0 } = opts;
    const t0 = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const gn = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.setValueAtTime(vol, t0 + dur * 0.8);
    gn.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(gn);
    gn.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  noise(dur, opts = {}) {
    if (!this.ac || this.muted) return;
    const { vol = 0.08, delay = 0, freq = 1200 } = opts;
    const t0 = this.ac.currentTime + delay;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const gn = this.ac.createGain();
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(f);
    f.connect(gn);
    gn.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  },
  // notes: array of [midi | null, beats]
  melody(notes, bpm = 240, opts = {}) {
    const beat = 60 / bpm;
    let t = opts.delay || 0;
    for (const [n, b] of notes) {
      if (n !== null) this.tone(440 * Math.pow(2, (n - 69) / 12), beat * b * 0.9, { delay: t, vol: opts.vol || 0.06 });
      t += beat * b;
    }
  },
  play(name) {
    switch (name) {
      case 'jump': this.tone(260, 0.09, { to: 620, vol: 0.05 }); break;
      case 'land': this.tone(140, 0.03, { vol: 0.04 }); break;
      case 'clang': this.tone(1400, 0.05, { vol: 0.04 }); this.tone(900, 0.08, { delay: 0.05, vol: 0.04 }); break;
      case 'meow': this.tone(520, 0.12, { to: 900, type: 'triangle', vol: 0.12 }); this.tone(900, 0.2, { to: 420, type: 'triangle', delay: 0.12, vol: 0.12 }); break;
      case 'catch': this.melody([[76, 0.5], [79, 0.5], [84, 1]], 900); break;
      case 'eat': this.tone(700, 0.04); this.tone(1000, 0.06, { delay: 0.05 }); break;
      case 'die': this.tone(700, 0.9, { to: 60, vol: 0.08 }); break;
      case 'bark': this.noise(0.08, { freq: 400, vol: 0.2 }); this.tone(170, 0.08, { vol: 0.07, to: 120 }); this.noise(0.08, { freq: 400, vol: 0.2, delay: 0.16 }); this.tone(170, 0.08, { vol: 0.07, to: 120, delay: 0.16 }); break;
      case 'crash': this.noise(0.15, { freq: 2500, vol: 0.12 }); break;
      case 'throw': this.tone(900, 0.12, { to: 300, vol: 0.03 }); break;
      case 'window': this.tone(180, 0.15, { to: 240, vol: 0.03, type: 'sawtooth' }); break;
      case 'broom': this.noise(0.3, { freq: 3000, vol: 0.12 }); this.noise(0.3, { freq: 3000, vol: 0.1, delay: 0.35 }); break;
      case 'swept': this.tone(300, 0.5, { to: 1500, vol: 0.06 }); break;
      case 'splash': this.noise(0.3, { freq: 1500, vol: 0.18 }); break;
      case 'bubble': this.tone(600, 0.04, { to: 1200, type: 'sine', vol: 0.05 }); break;
      case 'shock': this.tone(60, 0.4, { type: 'sawtooth', vol: 0.12 }); this.noise(0.4, { freq: 5000, vol: 0.08 }); break;
      case 'lap': this.tone(1200, 0.02, { vol: 0.03 }); break;
      case 'gulp': this.tone(400, 0.06, { to: 200 }); this.tone(900, 0.06, { delay: 0.08 }); break;
      case 'squish': this.noise(0.06, { freq: 800, vol: 0.15 }); this.tone(300, 0.05, { to: 80 }); break;
      case 'hiss': this.noise(0.4, { freq: 6000, vol: 0.12 }); break;
      case 'tick': this.tone(1800, 0.02, { vol: 0.03 }); break;
      case 'knock': this.noise(0.05, { freq: 500, vol: 0.2 }); this.tone(200, 0.1, { to: 90 }); break;
      case 'tweet': this.tone(2200, 0.05, { to: 3000, type: 'sine', vol: 0.06 }); this.tone(2400, 0.05, { to: 3200, type: 'sine', vol: 0.06, delay: 0.08 }); break;
      case 'extra': this.melody([[72, 1], [76, 1], [79, 1], [84, 1], [79, 1], [84, 2]], 700); break;
      case 'room': // short jaunty sting when entering a room
        this.melody([[67, 1], [72, 1], [76, 1], [72, 1], [79, 2]], 600); break;
      case 'done':
        this.melody([[72, 1], [72, 1], [76, 1], [79, 2], [76, 1], [79, 3]], 520); break;
      case 'love':
        this.melody([[76, 2], [79, 1], [84, 3], [83, 1], [81, 1], [79, 2], [76, 1], [77, 1], [79, 4]], 420); break;
      case 'gameover':
        this.melody([[67, 2], [66, 2], [65, 2], [64, 6]], 260); break;
      case 'title':
        // An original swing-feel tune.
        this.melody([
          [60, 1], [64, 1], [67, 1], [69, 2], [67, 1], [64, 2],
          [65, 1], [69, 1], [72, 1], [74, 2], [72, 1], [69, 2],
          [67, 1], [64, 1], [60, 1], [62, 1], [64, 1], [65, 1], [67, 4],
        ], 360); break;
    }
  },
};
