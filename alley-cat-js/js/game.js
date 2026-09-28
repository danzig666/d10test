'use strict';
// ---------------------------------------------------------------------------
// Game flow: title screen, lives/score/level bookkeeping, scene transitions,
// HUD and the fixed-timestep main loop.
// ---------------------------------------------------------------------------

const ROOM_NAMES = {
  cheese: 'THE CHEESE',
  fish: 'THE FISHBOWL',
  bird: 'THE BIRDCAGE',
  dog: 'THE BULLDOG',
  spider: 'THE HOUSEPLANT',
};

function loadHi() {
  try { return parseInt(localStorage.getItem('alleycat.hi') || '0', 10) || 0; } catch (e) { return 0; }
}
function saveHi(v) {
  try { localStorage.setItem('alleycat.hi', String(v)); } catch (e) { /* storage unavailable */ }
}

const game = {
  state: 'title',   // title | play | gameover
  scene: null,
  alley: null,
  score: 0,
  hi: loadHi(),
  lives: 4,
  level: 1,
  nextExtra: 10000,
  roomsDone: [],
  enteredFrom: null,
  banner: null,
  trans: null,
  paused: false,
  t: 0,

  get roomsNeeded() { return Math.min(3 + Math.floor((this.level - 1) / 2), 5); },

  newGame() {
    this.score = 0;
    this.lives = 4;
    this.level = 1;
    this.nextExtra = 10000;
    this.roomsDone = [];
    this.alley = new AlleyScene(this);
    this.alley.cat.inv = 2;
    this.alley.openTimer = 2.5;
    this.scene = this.alley;
    this.state = 'play';
    this.paused = false;
    this.showBanner('LEVEL 1', 'FIND THE OPEN WINDOWS');
    Sound.play('meow');
  },

  addScore(n) {
    this.score += n;
    if (this.score >= this.nextExtra) {
      this.nextExtra += 10000;
      this.lives = Math.min(this.lives + 1, 9);
      Sound.play('extra');
      this.showBanner('EXTRA LIFE!');
    }
    if (this.score > this.hi) this.hi = this.score;
  },

  showBanner(line1, line2 = '', dur = 2.2) { this.banner = { line1, line2, t: 0, dur }; },

  // Swap scenes behind a quick blinds-style wipe.
  transition(fn, after) {
    if (this.trans) return;
    this.trans = { t: 0, fn, after, swapped: false };
  },

  // Choose which room an opening window leads to, favouring ones not yet done.
  pickRoom() {
    const all = Object.keys(ROOM_TYPES);
    const fresh = all.filter((r) => !this.roomsDone.includes(r));
    return pick(fresh.length ? fresh : all);
  },

  enterRoom(type, win) {
    this.enteredFrom = win;
    Sound.play('meow');
    this.transition(() => {
      this.scene = new ROOM_TYPES[type](this);
      this.scene.type = type;
    }, () => {
      Sound.play('room');
      this.showBanner(ROOM_NAMES[type], this.roomHint(type));
    });
  },

  roomHint(type) {
    return {
      cheese: 'CATCH THE MICE',
      fish: 'EAT THE FISH - AVOID EELS',
      bird: 'FREE THE BIRD, THEN CATCH IT',
      dog: "DRINK THE MILK - DON'T WAKE HIM",
      spider: 'STOP THE SPIDERS',
    }[type];
  },

  roomComplete(room, bonus) {
    this.addScore(bonus);
    if (!this.roomsDone.includes(room.type)) this.roomsDone.push(room.type);
    if (this.roomsDone.length >= this.roomsNeeded) {
      this.transition(() => { this.scene = new LoveScene(this); }, () => this.showBanner('YOUR SWEETHEART', 'IS WAITING UP THERE!'));
    } else {
      const left = this.roomsNeeded - this.roomsDone.length;
      this.transition(() => this.backToAlley(), () => this.showBanner(`BONUS ${bonus}`, `${left} MORE ROOM${left > 1 ? 'S' : ''} TO GO`));
    }
  },

  sweptOut() {
    this.transition(() => this.backToAlley(), () => this.showBanner('SWEPT OUT!'));
  },

  backToAlley() {
    this.alley.returnFrom(this.enteredFrom);
    this.scene = this.alley;
  },

  catDied() {
    if (this.trans) return;
    this.lives--;
    if (this.lives <= 0) {
      this.transition(() => {
        this.state = 'gameover';
        this.scene = null;
        this.goT = 0;
        saveHi(this.hi);
      }, () => Sound.play('gameover'));
      return;
    }
    const where = this.scene.kind;
    this.transition(() => {
      if (where === 'love') this.scene = new LoveScene(this);
      else { this.alley.respawn(); this.scene = this.alley; }
    }, () => this.showBanner(`${this.lives} ${this.lives > 1 ? 'LIVES' : 'LIFE'} LEFT`));
  },

  loveComplete() {
    this.addScore(2000 * this.level);
    this.level++;
    this.roomsDone = [];
    saveHi(this.hi);
    this.transition(() => {
      this.alley = new AlleyScene(this);
      this.scene = this.alley;
    }, () => this.showBanner(`LEVEL ${this.level}`, 'THINGS GET FASTER...'));
  },

  update(dt) {
    this.t += dt;
    if (Input.pressed.mute) {
      Sound.muted = !Sound.muted;
      this.showBanner(Sound.muted ? 'SOUND OFF' : 'SOUND ON', '', 1);
    }

    if (this.trans) {
      const tr = this.trans;
      tr.t += dt;
      if (!tr.swapped && tr.t >= 0.3) {
        tr.swapped = true;
        tr.fn();
        if (tr.after) tr.after();
      }
      if (tr.t >= 0.6) this.trans = null;
      return;
    }

    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }

    if (this.state === 'title') {
      if (Input.anyStart()) this.newGame();
      return;
    }
    if (this.state === 'gameover') {
      this.goT += dt;
      if (this.goT > 1.2 && Input.anyStart()) { this.state = 'title'; this.titleT = 0; }
      return;
    }
    if (Input.pressed.pause) this.paused = !this.paused;
    if (this.paused) return;
    this.scene.update(dt);
  },

  // --- drawing -------------------------------------------------------------

  drawHud() {
    rect(0, 0, W, 12, 'k');
    text('SCORE', 2, 2, 'c');
    text(String(this.score).padStart(6, '0'), 34, 2, 'w');
    text('HI', 76, 2, 'c');
    text(String(this.hi).padStart(6, '0'), 90, 2, 'w');
    text('LV', 136, 2, 'c');
    text(String(this.level), 150, 2, 'w');
    // Room progress hearts.
    let x = 166;
    for (let i = 0; i < this.roomsNeeded; i++) {
      text(i < this.roomsDone.length ? '*' : '~', x, 2, 'm');
      x += 7;
    }
    // Lives.
    const shown = Math.min(this.lives, 7);
    for (let i = 0; i < shown; i++) drawSprite(SPR.life, W - 5 - i * 8, 9);
    hline(0, W, 11, 'm');
  },

  drawTitle() {
    const t = this.t;
    rect(0, 0, W, H, 'k');
    patRect(0, 0, W, 120, 'brick', 'm', 'k');
    rect(20, 18, 280, 58, 'k');
    frame(20, 18, 280, 58, 'w');
    frame(22, 20, 276, 54, 'm');
    sctext('ALLEY CAT', 28, 'c', 4);
    rect(0, 90, W, 13, 'k');
    ctext('JUMP INTO OPEN WINDOWS. WIN ROOMS. WIN HER HEART.', 93, 'w');
    ctext('A JAVASCRIPT REMAKE OF THE 1984 DOS CLASSIC', 64, 'w');
    // A cat strolling along the fence.
    rect(0, 120, W, 44, 'k');
    for (let x = 0; x < W; x += 8) rect(x, 124, 7, 40, 'c');
    rect(0, 122, W, 2, 'w');
    rect(0, 136, W, 2, 'm');
    const cx = ((t * 40) % (W + 40)) - 20;
    drawCatSprite(SPR.cat, cx, 122, 1, 'walk', t);
    const hx = W - (((t * 26) + 120) % (W + 40)) + 20;
    drawCatSprite(SPR.sweet, hx, 122, -1, 'walk', t);
    drawBow(hx - 5, 109);
    if (Math.abs(cx - hx) < 30) drawHeart((cx + hx) / 2, 100, 2, 'm');

    rect(0, 164, W, 36, 'k');
    ctext('ARROWS/WASD MOVE   UP/SPACE JUMP   DOWN DROP/DRINK', 168, 'c');
    ctext('P PAUSE   M SOUND', 178, 'c');
    if (Math.floor(t * 2) % 2) ctext('PRESS ENTER OR TAP TO PLAY', 190, 'w');
    else ctext(`HI SCORE ${String(this.hi).padStart(6, '0')}`, 190, 'm');
  },

  drawGameOver() {
    rect(0, 0, W, H, 'k');
    patRect(0, 0, W, H, 'dots', 'm', 'k');
    sctext('GAME OVER', 60, 'm', 3);
    sctext(`SCORE ${this.score}`, 100, 'w', 1);
    sctext(`HI SCORE ${this.hi}`, 114, 'c', 1);
    sctext(`YOU REACHED LEVEL ${this.level}`, 128, 'w', 1);
    if (this.goT > 1.2 && Math.floor(this.t * 2) % 2) sctext('PRESS ENTER', 160, 'w');
  },

  drawBanner() {
    const b = this.banner;
    if (!b) return;
    const y = 72;
    const w = Math.max(textWidth(b.line1, 2), textWidth(b.line2)) + 16;
    rect(160 - w / 2, y - 6, w, b.line2 ? 34 : 26, 'k');
    frame(160 - w / 2, y - 6, w, b.line2 ? 34 : 26, 'm');
    sctext(b.line1, y, 'w', 2);
    if (b.line2) sctext(b.line2, y + 18, 'c');
  },

  draw() {
    if (this.state === 'title') this.drawTitle();
    else if (this.state === 'gameover') this.drawGameOver();
    else {
      this.scene.draw();
      this.drawHud();
      this.drawBanner();
      if (this.paused) {
        rect(110, 90, 100, 20, 'k');
        frame(110, 90, 100, 20, 'w');
        ctext('PAUSED', 97, 'w');
      }
    }
    if (this.trans) {
      // Horizontal blinds closing then opening.
      const tr = this.trans;
      const p = tr.t < 0.3 ? tr.t / 0.3 : 1 - (tr.t - 0.3) / 0.3;
      const bh = Math.ceil(10 * clamp(p, 0, 1));
      for (let y = 0; y < H; y += 10) rect(0, y, W, bh, 'k');
    }
  },
};

// ---------------------------------------------------------------------------
// Main loop (fixed 60 Hz simulation).
// ---------------------------------------------------------------------------
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();

function frameLoop(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  let steps = 0;
  while (acc >= STEP && steps < 6) {
    game.update(STEP);
    Input.endStep();
    acc -= STEP;
    steps++;
  }
  game.draw();
  requestAnimationFrame(frameLoop);
}

screenCanvas.addEventListener('pointerdown', () => {
  Sound.unlock();
  if (game.state === 'title' || (game.state === 'gameover' && game.goT > 1.2)) Input.pressed.start = true;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') game.paused = true;
});

bindTouchButtons(document);
requestAnimationFrame(frameLoop);

// Small hook for automated tests and the curious.
window.AlleyCat = { game, Input, ROOM_TYPES };
