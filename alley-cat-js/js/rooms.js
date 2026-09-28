'use strict';
// ---------------------------------------------------------------------------
// Rooms behind the windows. Each has one task; finish it before the broom
// sweeps the cat back out into the alley.
// ---------------------------------------------------------------------------

const FLOOR = 186;
const CEIL = 22;

class RoomScene {
  constructor(game) {
    this.game = game;
    this.level = game.level;
    this.kind = 'room';
    this.t = 0;
    this.cat = new Cat(24, 60);
    this.cat.vy = 0;
    this.cat.ground = null;
    this.platforms = [plat(0, W, FLOOR, { id: 'floor', solid: true })];
    this.broomAt = Math.max(12, 30 - 2.5 * (this.level - 1));
    this.broom = null;
    this.done = false;
    this.doneT = 0;
    this.deadT = 0;
    this.swept = false;
    this.sweptT = 0;
    this.popups = [];
    this.caught = 0;
  }

  // Subclasses provide: title, goalLabel, need, setup(), step(dt), drawRoom(), drawFront()
  get progressText() { return `${this.goalLabel} ${this.caught}/${this.need}`; }

  popup(x, y, textStr) { this.popups.push({ x, y, text: textStr, t: 0 }); }

  score(n, x, y) {
    this.game.addScore(n);
    this.popup(x, y, String(n));
  }

  complete() {
    if (this.done) return;
    this.done = true;
    this.doneT = 0;
    Sound.play('done');
  }

  // True while the cat is somewhere the broom can't reach (e.g. in the fishbowl).
  safeFromBroom() { return false; }

  update(dt) {
    this.t += dt;
    this.popups = this.popups.filter((p) => (p.t += dt) < 1);
    const cat = this.cat;

    if (this.done) {
      this.doneT += dt;
      if (this.doneT > 2.2) {
        const timeBonus = Math.max(0, Math.round((this.broomAt - Math.min(this.t, this.broomAt)) * 10) * 10);
        this.game.roomComplete(this, 500 * this.level + timeBonus);
      }
      return;
    }

    if (this.swept) {
      this.sweptT += dt;
      cat.x += cat.vx * dt;
      cat.vy += GRAVITY * 0.5 * dt;
      cat.y += cat.vy * dt;
      cat.t += dt;
      this.broom.x += this.broom.dir * 40 * dt;
      if (this.sweptT > 1.3) this.game.sweptOut();
      return;
    }

    if (cat.dead) {
      cat.update(dt, this.platforms);
      this.deadT += dt;
      if (this.deadT > 1.6) this.game.catDied();
      return;
    }

    this.step(dt);
    if (this.done || cat.dead) return;

    // The broom.
    if (!this.broom && this.t >= this.broomAt) {
      const dir = cat.x > W / 2 ? 1 : -1;
      this.broom = { x: dir > 0 ? -20 : W + 20, dir, t: 0 };
      Sound.play('broom');
    }
    if (this.broom) {
      const b = this.broom;
      b.t += dt;
      const speed = 34 + 6 * this.level;
      const target = cat.x;
      if (Math.abs(target - b.x) > 2) b.dir = target > b.x ? 1 : -1;
      b.x += b.dir * speed * dt;
      if (Math.floor(b.t * 2) !== Math.floor((b.t - dt) * 2)) Sound.noise(0.2, { freq: 3000, vol: 0.05 });
      const box = { x: b.x - 9, y: FLOOR - 40, w: 18, h: 40 };
      if (!this.safeFromBroom() && overlap(cat.box, box)) {
        this.swept = true;
        this.sweptT = 0;
        cat.vx = b.dir * 180;
        cat.vy = -220;
        cat.dir = b.dir;
        cat.ground = null;
        Sound.play('swept');
      }
    }
  }

  // --- drawing -------------------------------------------------------------

  drawWalls() {
    rect(0, 12, W, H - 12, 'k');
    patRect(0, CEIL, W, FLOOR - CEIL, 'wallpaper', 'c', 'k');
    hline(0, W, CEIL - 1, 'm');
    hline(0, W, CEIL, 'w');
    // Skirting board and floorboards.
    rect(0, FLOOR - 4, W, 4, 'm');
    rect(0, FLOOR, W, H - FLOOR, 'k');
    hline(0, W, FLOOR, 'w');
    for (let x = 0; x < W; x += 20) px(x + ((x / 20) % 2) * 10, FLOOR + 5, 'm');
    for (let x = 5; x < W; x += 20) hline(x, x + 6, FLOOR + 10, 'm');
    // The window the cat came in through.
    rect(10, CEIL + 4, 28, 26, 'k');
    frame(10, CEIL + 4, 28, 26, 'w');
    vline(24, CEIL + 5, CEIL + 28, 'w');
    for (let i = 0; i < 5; i++) px(14 + i * 5, CEIL + 10 + (i % 2) * 7, 'c');
  }

  drawShelf(p, c = 'w') {
    rect(p.x1, p.y, p.x2 - p.x1, 3, c);
    rect(p.x1 + 3, p.y + 3, 2, 4, 'm');
    rect(p.x2 - 5, p.y + 3, 2, 4, 'm');
  }

  drawTable(x1, x2, y) {
    rect(x1, y, x2 - x1, 4, 'w');
    rect(x1 + 3, y + 4, 3, FLOOR - y - 4, 'm');
    rect(x2 - 6, y + 4, 3, FLOOR - y - 4, 'm');
    hline(x1 + 6, x2 - 7, y + 10, 'm');
  }

  drawHud() {
    rect(0, 12, W, 9, 'k');
    text(this.title, 2, 13, 'm');
    const prog = this.progressText;
    text(prog, 160 - textWidth(prog) / 2, 13, 'w');
    // Broom timer.
    const left = Math.max(0, 1 - this.t / this.broomAt);
    const bw = 50;
    frame(W - bw - 4, 13, bw + 2, 7, 'w');
    if (left > 0) rect(W - bw - 3, 14, Math.ceil(bw * left), 5, left < 0.25 && Math.floor(this.t * 6) % 2 ? 'm' : 'c');
    else if (Math.floor(this.t * 4) % 2) text('BROOM', W - bw + 3, 13, 'm');
  }

  draw() {
    this.drawWalls();
    this.drawRoom();
    if (this.broom) drawBroom(this.broom.x, FLOOR, this.broom.t, this.broom.dir);
    this.drawCat();
    if (this.drawFront) this.drawFront();
    for (const p of this.popups) stext(p.text, p.x - textWidth(p.text) / 2, p.y - p.t * 12, 'w');
    this.drawHud();
    if (this.done) {
      sctext('WELL DONE!', 90, Math.floor(this.doneT * 6) % 2 ? 'c' : 'w', 2);
    }
    if (this.swept && this.sweptT > 0.2) sctext('SHOO!', 90, 'm', 2);
  }

  drawCat() { this.cat.draw(); }
}

// ---------------------------------------------------------------------------
// 1. The cheese: mice poke out of holes; catch enough of them.
// ---------------------------------------------------------------------------
class CheeseRoom extends RoomScene {
  constructor(game) {
    super(game);
    this.title = 'CHEESE';
    this.goalLabel = 'MICE';
    this.need = Math.min(4 + this.level, 10);
    this.tiers = [
      { x1: 40, x2: 280, top: 150, bottom: FLOOR },
      { x1: 72, x2: 248, top: 116, bottom: 150 },
      { x1: 104, x2: 216, top: 82, bottom: 116 },
    ];
    this.tiers.forEach((tr, i) => this.platforms.push(plat(tr.x1 + 2, tr.x2 - 2, tr.top, { id: 'tier' + i })));
    this.platforms.push(plat(8, 50, 118, { id: 'shelfL' }));
    this.platforms.push(plat(270, 312, 118, { id: 'shelfR' }));
    // Holes sit at the bottom of each tier's face; a mouse stands on `y`.
    this.holes = [
      { x: 58, y: FLOOR }, { x: 118, y: FLOOR }, { x: 202, y: FLOOR }, { x: 262, y: FLOOR },
      { x: 90, y: 150 }, { x: 160, y: 150 }, { x: 230, y: 150 },
      { x: 128, y: 116 }, { x: 192, y: 116 },
    ];
    this.holes.forEach((h) => { h.busy = false; });
    this.mice = [];
    this.spawnT = 0.8;
    this.bg = makeLayer(W, H, () => this.drawCheese());
  }

  step(dt) {
    const cat = this.cat;
    cat.update(dt, this.platforms);
    this.spawnT -= dt;
    const maxMice = Math.min(2 + Math.floor(this.level / 2), 5);
    if (this.spawnT <= 0 && this.mice.length < maxMice) {
      this.spawnT = rand(0.5, 1.3);
      const free = this.holes.filter((h) => !h.busy);
      if (free.length) {
        const h = pick(free);
        h.busy = true;
        this.mice.push({ hole: h, x: h.x, y: h.y, state: 'peek', t: 0, dir: Math.random() < 0.5 ? -1 : 1, peek: Math.max(0.55, 1.3 - 0.08 * this.level) });
      }
    }
    for (const m of this.mice) {
      m.t += dt;
      if (m.state === 'peek' && m.t > m.peek) {
        m.t = 0;
        // Most mice scurry to a neighbouring hole on the same level.
        const same = this.holes.filter((h) => h !== m.hole && h.y === m.hole.y && !h.busy);
        if (same.length && Math.random() < 0.65) {
          m.state = 'run';
          m.target = pick(same);
          m.target.busy = true;
          m.hole.busy = false;
          m.dir = m.target.x > m.x ? 1 : -1;
        } else {
          m.state = 'hide';
        }
      } else if (m.state === 'run') {
        m.x += m.dir * (40 + 5 * this.level) * dt;
        if ((m.dir > 0 && m.x >= m.target.x) || (m.dir < 0 && m.x <= m.target.x)) {
          m.x = m.target.x;
          m.hole = m.target;
          m.state = 'hide';
          m.t = 0;
        }
      } else if (m.state === 'hide' && m.t > 0.25) {
        m.gone = true;
        m.hole.busy = false;
      }
      if (!m.gone && m.state !== 'hide' && !cat.dead && overlap(cat.box, { x: m.x - 4, y: m.y - 5, w: 8, h: 5 })) {
        m.gone = true;
        (m.target || m.hole).busy = false;
        m.hole.busy = false;
        this.caught++;
        this.score(100 * this.level, m.x, m.y - 10);
        Sound.play('catch');
        if (this.caught >= this.need) this.complete();
      }
    }
    this.mice = this.mice.filter((m) => !m.gone);
  }

  drawCheese() {
    for (const tr of this.tiers) {
      rect(tr.x1, tr.top, tr.x2 - tr.x1, tr.bottom - tr.top, 'w');
      hline(tr.x1, tr.x2 - 1, tr.top, 'c');
      vline(tr.x1, tr.top, tr.bottom - 1, 'c');
      vline(tr.x2 - 1, tr.top, tr.bottom - 1, 'c');
    }
    // Decorative holes.
    const deco = [[60, 164, 4, 3], [150, 170, 5, 3], [240, 166, 3, 2], [110, 128, 4, 3], [200, 132, 3, 2], [150, 96, 4, 3], [176, 104, 2, 2], [88, 176, 2, 2]];
    for (const [x, y, rx, ry] of deco) ellipse(x, y, rx, ry, 'm');
  }

  drawRoom() {
    for (const p of this.platforms) if (p.id.startsWith('shelf')) this.drawShelf(p);
    g.drawImage(this.bg, 0, 0);
    for (const h of this.holes) {
      ellipse(h.x, h.y - 4, 5, 4, 'k');
      hline(h.x - 5, h.x + 5, h.y - 1, 'k');
    }
  }

  drawFront() {
    for (const m of this.mice) {
      const f = SPR.mouse[Math.floor(m.t * 12) % 2];
      if (m.state === 'peek' || m.state === 'hide') {
        // Only the head shows at the hole.
        g.save();
        g.beginPath();
        g.rect(m.x - 5, m.y - 8, 10, 8);
        g.clip();
        drawSprite(f, m.x + m.dir * 2, m.y, m.dir < 0);
        g.restore();
      } else {
        drawSprite(f, m.x, m.y, m.dir < 0);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. The fishbowl: dive in, eat fish, avoid eels, come up before air runs out.
// ---------------------------------------------------------------------------
class FishRoom extends RoomScene {
  constructor(game) {
    super(game);
    this.title = 'FISHBOWL';
    this.goalLabel = 'FISH';
    this.need = Math.min(3 + this.level, 9);
    this.bowl = { cx: 160, cy: 150, rx: 60, ry: 36, rim: 124, surface: 130 };
    this.platforms.push(plat(44, 88, 160, { id: 'chair' }));
    this.platforms.push(plat(236, 300, 150, { id: 'shelf' }));
    this.platforms.push(plat(232, 312, 112, { id: 'shelf2' }));
    this.swimming = false;
    this.air = 1;
    this.grace = 0;
    this.bubbleT = 0;
    this.bubbles = [];
    this.fish = [];
    for (let i = 0; i < 4; i++) this.fish.push(this.newFish());
    this.eels = [];
    const nEels = Math.min(1 + Math.floor(this.level / 2), 3);
    for (let i = 0; i < nEels; i++) {
      this.eels.push({ x: rand(120, 200), y: rand(142, 176), dir: Math.random() < 0.5 ? -1 : 1, t: rand(0, 5), speed: 14 + 4 * this.level });
    }
  }

  newFish() {
    const b = this.bowl;
    return { x: rand(b.cx - 40, b.cx + 40), y: rand(b.surface + 10, b.cy + 24), dir: Math.random() < 0.5 ? -1 : 1, t: rand(0, 6), speed: rand(18, 30) + 3 * this.level, away: 0 };
  }

  // Inside the water (a half-ellipse below the surface), inset by `m` pixels.
  inWater(x, y, m = 0) {
    const b = this.bowl;
    if (y < b.surface + m) return false;
    const dx = (x - b.cx) / (b.rx - m), dy = (y - b.cy) / (b.ry - m);
    return dx * dx + dy * dy <= 1;
  }

  safeFromBroom() { return this.swimming; }

  get progressText() { return `${this.goalLabel} ${this.caught}/${this.need}`; }

  step(dt) {
    const cat = this.cat;
    const b = this.bowl;
    if (this.grace > 0) this.grace -= dt;

    if (!this.swimming) {
      const prevCy = cat.cy;
      cat.update(dt, this.platforms);
      this.air = Math.min(1, this.air + dt * 0.6);
      if (this.grace <= 0 && cat.airborne && cat.vy > 0 && prevCy < b.surface + 8 && this.inWater(cat.x, cat.cy)) {
        this.swimming = true;
        cat.ground = null;
        cat.vx = cat.dir * 30;
        cat.vy = 20;
        Sound.play('splash');
      }
    } else {
      // Paddle around freely.
      cat.t += dt;
      const ax = (Input.held.right ? 1 : 0) - (Input.held.left ? 1 : 0);
      const ay = (Input.held.down ? 1 : 0) - (Input.held.up ? 1 : 0);
      if (ax) cat.dir = ax;
      cat.vx += (ax * 60 - cat.vx) * Math.min(1, dt * 4);
      cat.vy += (ay * 50 + 6 - cat.vy) * Math.min(1, dt * 4);
      let nx = cat.x + cat.vx * dt;
      let ny = cat.y + cat.vy * dt;
      if (!this.inWater(nx, ny - 5, 6)) {
        if (this.inWater(nx, cat.y - 5, 6)) ny = cat.y;
        else if (this.inWater(cat.x, ny - 5, 6)) nx = cat.x;
        else { nx = cat.x; ny = cat.y; }
      }
      cat.x = nx;
      cat.y = ny;
      this.air -= dt * (0.085 + 0.012 * this.level);
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = rand(0.3, 0.7);
        this.bubbles.push({ x: cat.x + cat.dir * 8, y: cat.y - 8 });
        if (Math.random() < 0.4) Sound.play('bubble');
      }
      // Leap out from near the surface.
      if (Input.pressed.up && cat.cy <= b.surface + 12) {
        this.swimming = false;
        this.grace = 0.8;
        cat.vy = -JUMP_V * 1.1;
        cat.ground = null;
        Sound.play('jump');
      }
      if (this.air <= 0) {
        this.air = 0;
        this.swimming = false;
        cat.kill();
        return;
      }
    }

    for (const bb of this.bubbles) bb.y -= 20 * dt;
    this.bubbles = this.bubbles.filter((bb) => bb.y > b.surface);

    // Fish.
    for (const f of this.fish) {
      f.t += dt;
      if (f.respawn) {
        f.respawn -= dt;
        if (f.respawn <= 0) Object.assign(f, this.newFish(), { respawn: 0 });
        continue;
      }
      const near = this.swimming && Math.hypot(f.x - cat.x, f.y - cat.cy) < 30;
      if (near && f.away <= 0) { f.dir = f.x > cat.x ? 1 : -1; f.away = 0.8; }
      f.away -= dt;
      const sp = f.speed * (near ? 1.5 : 1);
      const nx = f.x + f.dir * sp * dt;
      const ny = f.y + Math.sin(f.t * 2) * 8 * dt;
      if (this.inWater(nx + f.dir * 5, ny, 4)) { f.x = nx; f.y = ny; } else { f.dir = -f.dir; }
      if (Math.random() < dt * 0.3) f.dir = -f.dir;
      if (this.swimming && overlap(cat.box, { x: f.x - 5, y: f.y - 2, w: 10, h: 5 })) {
        f.respawn = 1.2;
        this.caught++;
        this.score(150 * this.level, f.x, f.y - 8);
        Sound.play('eat');
        if (this.caught >= this.need) this.complete();
      }
    }

    // Electric eels.
    for (const e of this.eels) {
      e.t += dt;
      const nx = e.x + e.dir * e.speed * dt;
      if (this.inWater(nx + e.dir * 14, e.y, 4)) e.x = nx; else e.dir = -e.dir;
      e.y += Math.sin(e.t * 0.7) * 6 * dt;
      if (!this.inWater(e.x, e.y, 6)) e.y = clamp(e.y, b.surface + 8, b.cy + 24);
      if (this.swimming && !cat.dead) {
        for (let i = 0; i < 5; i++) {
          const sx = e.x - e.dir * i * 5;
          const sy = e.y + Math.sin(e.t * 6 + i) * 2;
          if (overlap(cat.box, { x: sx - 2, y: sy - 2, w: 4, h: 4 })) {
            this.swimming = false;
            Sound.play('shock');
            cat.kill();
            return;
          }
        }
      }
    }
  }

  drawRoom() {
    const b = this.bowl;
    this.drawShelf(this.platforms.find((p) => p.id === 'shelf'));
    this.drawShelf(this.platforms.find((p) => p.id === 'shelf2'));
    // Books on the upper shelf.
    for (let i = 0; i < 9; i++) rect(240 + i * 7, 112 - 12 - (i % 3) * 2, 5, 12 + (i % 3) * 2, i % 2 ? 'm' : 'w');
    // Chair.
    rect(44, 160, 44, 4, 'w');
    rect(44, 120, 4, 66, 'm');
    rect(84, 164, 4, 22, 'm');
    rect(48, 164, 3, 22, 'm');
    for (let y = 124; y < 160; y += 8) hline(44, 52, y, 'm');
    // Water inside the bowl.
    g.save();
    g.beginPath();
    g.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
    g.clip();
    rect(b.cx - b.rx, b.surface, b.rx * 2, b.ry * 2, 'k');
    patRect(b.cx - b.rx, b.surface, b.rx * 2, b.ry * 2, 'sparse', 'c', null);
    hline(b.cx - b.rx, b.cx + b.rx, b.surface, 'c');
    const wave = Math.floor(this.t * 4) % 4;
    for (let x = b.cx - b.rx + wave; x < b.cx + b.rx; x += 4) px(x, b.surface - 1, 'c');
    // Pebbles.
    for (let x = b.cx - 50; x < b.cx + 50; x += 5) px(x + (x % 3), b.cy + b.ry - 4 - (x % 2), 'm');
    g.restore();
  }

  drawFront() {
    const b = this.bowl;
    for (const f of this.fish) if (!f.respawn) drawSprite(FISH, f.x, f.y + 3, f.dir < 0);
    for (const e of this.eels) {
      const flash = Math.floor(e.t * 10) % 3 === 0 ? 'c' : 'w';
      for (let i = 0; i < 5; i++) {
        const sx = e.x - e.dir * i * 5;
        const sy = e.y + Math.sin(e.t * 6 + i) * 2;
        rect(sx - 2, sy - 1, 5, 3, flash);
      }
      px(e.x + e.dir * 2, e.y - 1, 'k');
    }
    for (const bb of this.bubbles) frame(bb.x - 1, bb.y - 1, 3, 3, 'w');
    // Glass drawn over everything inside it.
    g.save();
    g.beginPath();
    g.rect(0, b.rim, W, H);
    g.clip();
    ellipse(b.cx, b.cy, b.rx, b.ry, 'w', false);
    g.restore();
    const rimHalf = Math.round(b.rx * Math.sqrt(1 - Math.pow((b.rim - b.cy) / b.ry, 2)));
    hline(b.cx - rimHalf - 2, b.cx - rimHalf + 2, b.rim, 'w');
    hline(b.cx + rimHalf - 2, b.cx + rimHalf + 2, b.rim, 'w');
    // Glint.
    vline(b.cx + 40, b.cy - 16, b.cy - 6, 'w');
    // Air meter.
    if (this.swimming || this.air < 1) {
      text('AIR', 110, 26, 'w');
      frame(130, 26, 62, 7, 'w');
      const low = this.air < 0.3 && Math.floor(this.t * 6) % 2;
      rect(131, 27, Math.ceil(60 * this.air), 5, low ? 'm' : 'c');
    }
  }

  drawCat() {
    const cat = this.cat;
    if (this.swimming) {
      if (cat.inv > 0 && Math.floor(cat.inv * 12) % 2) return;
      drawSprite(SPR.swim[Math.floor(cat.t * 5) % 2], cat.x, cat.y - 1, cat.dir < 0);
    } else {
      cat.draw();
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The birdcage: knock it off the table, then catch the escaped bird.
// ---------------------------------------------------------------------------
class BirdRoom extends RoomScene {
  constructor(game) {
    super(game);
    this.title = 'BIRDCAGE';
    this.goalLabel = 'BIRD';
    this.need = 1;
    this.platforms.push(plat(16, 86, 150, { id: 'shelfA' }));
    this.platforms.push(plat(100, 168, 118, { id: 'shelfB' }));
    this.platforms.push(plat(24, 80, 86, { id: 'shelfC' }));
    this.platforms.push(plat(196, 292, 140, { id: 'table' }));
    this.platforms.push(plat(150, 206, 62, { id: 'lamp' }));
    this.cage = { x: 244, y: 140, state: 'table', vx: 0, vy: 0, rot: 0 };
    this.bird = null;
  }

  get progressText() {
    return this.bird ? 'CATCH THE BIRD!' : 'KNOCK OVER THE CAGE';
  }

  step(dt) {
    const cat = this.cat;
    cat.update(dt, this.platforms);
    const c = this.cage;
    if (c.state === 'table') {
      if (Math.random() < dt * 0.6) Sound.play('tweet');
      if (overlap(cat.box, { x: c.x - 14, y: c.y - 30, w: 28, h: 30 })) {
        c.state = 'falling';
        c.vx = cat.x < c.x ? 50 : -50;
        c.vy = -80;
        Sound.play('knock');
      }
    } else if (c.state === 'falling') {
      c.vy += GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += dt * 4 * Math.sign(c.vx);
      if (c.y >= FLOOR && c.vy > 0) {
        c.y = FLOOR;
        c.state = 'floor';
        Sound.play('crash');
        this.bird = { x: c.x, y: FLOOR - 16, tx: c.x, ty: 60, t: 0, speed: 52 + 8 * this.level, retarget: 0 };
        Sound.play('tweet');
      }
    }

    const b = this.bird;
    if (b) {
      b.t += dt;
      b.retarget -= dt;
      const dist = Math.hypot(b.x - cat.x, b.y - cat.cy);
      const arrived = Math.hypot(b.tx - b.x, b.ty - b.y) < 4;
      if (arrived || b.retarget <= 0 || (dist < 46 && b.retarget < 0.8)) {
        // Pick the candidate spot farthest from the cat (with a bit of luck).
        let best = null, bestD = -1;
        const tries = dist < 46 ? 4 : 2;
        for (let i = 0; i < tries; i++) {
          const p = { x: rand(20, 300), y: rand(40, 178) };
          const d = Math.hypot(p.x - cat.x, p.y - cat.cy) + rand(0, 40);
          if (d > bestD) { bestD = d; best = p; }
        }
        b.tx = best.x;
        b.ty = best.y;
        b.retarget = rand(1.2, 2.4);
        if (Math.random() < 0.3) Sound.play('tweet');
      }
      const ang = Math.atan2(b.ty - b.y, b.tx - b.x);
      b.x += Math.cos(ang) * b.speed * dt;
      b.y += Math.sin(ang) * b.speed * dt + Math.sin(b.t * 9) * 12 * dt;
      b.dir = Math.cos(ang) >= 0 ? 1 : -1;
      if (!cat.dead && overlap(cat.box, { x: b.x - 5, y: b.y - 6, w: 10, h: 6 })) {
        this.caught = 1;
        this.score(1000 * this.level, b.x, b.y - 10);
        this.bird = null;
        Sound.play('catch');
        this.complete();
      }
    }
  }

  drawRoom() {
    for (const p of this.platforms) {
      if (p.id.startsWith('shelf')) this.drawShelf(p);
    }
    // Plant pot and books as clutter.
    rect(30, 136, 12, 14, 'm');
    for (let i = 0; i < 4; i++) line(36, 136, 30 + i * 4, 124 + (i % 2) * 4, 'c');
    for (let i = 0; i < 6; i++) rect(106 + i * 8, 118 - 11 - (i % 2) * 2, 6, 11 + (i % 2) * 2, i % 2 ? 'w' : 'm');
    this.drawTable(196, 292, 140);
    // Hanging lamp shelf.
    vline(178, CEIL, 60, 'w');
    rect(150, 62, 56, 3, 'w');
    ellipse(178, 70, 10, 5, 'm');
  }

  drawCage(x, y, rot) {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.rotate(rot);
    g.fillStyle = COL.w;
    g.fillRect(-12, -2, 24, 2);
    for (let i = -10; i <= 10; i += 4) g.fillRect(i, -24, 1, 22);
    g.fillRect(-10, -25, 21, 1);
    g.fillRect(-6, -28, 13, 3);
    g.fillRect(-1, -32, 3, 4);
    g.fillStyle = COL.m;
    g.fillRect(-10, -12, 21, 1);
    g.restore();
  }

  drawFront() {
    const c = this.cage;
    if (c.state === 'floor') {
      this.drawCage(c.x, c.y, Math.PI / 2 * Math.sign(c.vx || 1));
    } else {
      this.drawCage(c.x, c.y, c.rot);
      if (c.state === 'table') drawSprite(BIRD[1], c.x, c.y - 6, false);
    }
    if (this.bird) {
      const b = this.bird;
      drawSprite(BIRD[Math.floor(b.t * 10) % 2], b.x, b.y, b.dir < 0);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. The sleeping bulldog: lap up every bowl of milk without waking him.
// ---------------------------------------------------------------------------
class DogRoom extends RoomScene {
  constructor(game) {
    super(game);
    this.title = 'BULLDOG';
    this.goalLabel = 'MILK';
    this.platforms.push(plat(14, 78, 150, { id: 'shelfL' }));
    this.platforms.push(plat(236, 300, 150, { id: 'shelfR' }));
    this.platforms.push(plat(122, 200, 118, { id: 'shelfM' }));
    this.platforms.push(plat(52, 104, 110, { id: 'shelfL2' }));
    this.bowls = [
      { x: 46, y: 150 }, { x: 268, y: 150 }, { x: 160, y: 118 },
      { x: 96, y: FLOOR }, { x: 226, y: FLOOR }, { x: 78, y: 110 },
    ].slice(0, Math.min(4 + Math.floor(this.level / 2), 6));
    this.bowls.forEach((b) => { b.milk = 1; });
    this.need = this.bowls.length;
    this.dog = { x: 160, home: 160, state: 'sleep', t: 0, noise: 0, dir: 1 };
    this.lapT = 0;
    this.zT = 0;
  }

  step(dt) {
    const cat = this.cat;
    const d = this.dog;
    // Holding Down over a bowl drinks it instead of dropping through the shelf.
    const bowl = this.bowls.find((b) => b.milk > 0 && cat.ground && Math.abs(cat.y - b.y) < 1 && Math.abs(cat.x - b.x) < 8);
    cat.noDrop = !!bowl;
    cat.frozen = !!bowl && Input.held.down;
    cat.update(dt, this.platforms);
    cat.frozen = false;

    const near = Math.abs(cat.x - d.x);
    if (d.state === 'sleep') {
      if (cat.landed) d.noise += 0.34 * Math.max(0, 1 - near / 150) * Math.min(1.4, cat.landVy / 220);
      if (cat.moving && cat.ground && cat.ground.id === 'floor' && near < 60) d.noise += dt * 0.2;
      d.noise += dt * 0.012 * this.level; // light sleeper at higher levels
      d.noise = Math.max(0, d.noise - dt * 0.05);
      if (d.noise >= 1) {
        d.state = 'awake';
        d.t = 0;
        Sound.play('bark');
      }
    } else if (d.state === 'awake') {
      d.t += dt;
      if (d.t > 0.6) {
        d.dir = cat.x > d.x ? 1 : -1;
        d.x = clamp(d.x + d.dir * (70 + 8 * this.level) * dt, 12, W - 12);
      }
      if (Math.floor(d.t * 1.5) !== Math.floor((d.t - dt) * 1.5)) Sound.play('bark');
      if (!cat.dead && cat.y > FLOOR - 6 && Math.abs(cat.x - d.x) < 14 && cat.vulnerable) {
        cat.kill();
        return;
      }
      if (d.t > 4 + 0.4 * this.level) { d.state = 'return'; d.t = 0; }
    } else if (d.state === 'return') {
      d.t += dt;
      d.dir = d.home > d.x ? 1 : -1;
      d.x += d.dir * 40 * dt;
      if (Math.abs(d.x - d.home) < 2) { d.x = d.home; d.state = 'sleep'; d.noise = 0; }
      if (!cat.dead && cat.y > FLOOR - 6 && Math.abs(cat.x - d.x) < 14 && cat.vulnerable) {
        cat.kill();
        return;
      }
    }

    if (bowl && Input.held.down && cat.ground) {
      bowl.milk -= dt / 1.1;
      this.lapT -= dt;
      if (this.lapT <= 0) { this.lapT = 0.15; Sound.play('lap'); }
      if (d.state === 'sleep') d.noise += dt * 0.08 * Math.max(0, 1 - Math.abs(bowl.x - d.x) / 100);
      if (bowl.milk <= 0) {
        bowl.milk = 0;
        this.caught++;
        this.score(200 * this.level, bowl.x, bowl.y - 14);
        Sound.play('gulp');
        if (this.caught >= this.need) this.complete();
      }
    }
    this.zT += dt;
  }

  drawRoom() {
    for (const p of this.platforms) if (p.id.startsWith('shelf')) this.drawShelf(p);
    // Rug and dog basket.
    rect(128, FLOOR - 2, 64, 2, 'w');
    hline(126, 193, FLOOR - 3, 'm');
    for (const b of this.bowls) {
      rect(b.x - 6, b.y - 4, 13, 4, 'c');
      hline(b.x - 7, b.x + 7, b.y - 5, 'c');
      if (b.milk > 0) hline(b.x - 5, b.x - 5 + Math.ceil(10 * b.milk), b.y - 5, 'w');
    }
  }

  drawFront() {
    const d = this.dog;
    if (d.state === 'sleep') {
      const stir = d.noise > 0.65 && Math.floor(this.t * 8) % 2;
      drawSprite(stir ? SPR.dogAwake : SPR.dogSleep, d.x, FLOOR, false);
      const zs = Math.floor(this.zT * 1.5) % 3;
      for (let i = 0; i <= zs; i++) text('Z', d.x + 10 + i * 5, FLOOR - 16 - i * 7, 'w');
    } else {
      drawSprite(SPR.dog[Math.floor(this.t * 10) % 2], d.x, FLOOR, d.dir < 0);
      if (d.state === 'awake' && d.t < 1) sctext('WOOF!', FLOOR - 32, 'w', 1, d.x);
    }
    // Noise meter.
    text('NOISE', 102, 26, 'w');
    frame(134, 26, 52, 7, 'w');
    const n = d.state === 'sleep' ? d.noise : 1;
    rect(135, 27, Math.ceil(50 * clamp(n, 0, 1)), 5, n > 0.65 ? 'm' : 'c');
    const cat = this.cat;
    const bowl = this.bowls.find((b) => b.milk > 0 && cat.ground && Math.abs(cat.y - b.y) < 1 && Math.abs(cat.x - b.x) < 8);
    if (bowl && !Input.held.down && Math.floor(this.t * 3) % 2) sctext('HOLD DOWN TO DRINK', 36, 'c');
  }
}

// ---------------------------------------------------------------------------
// 5. The houseplant: spiders creep down to eat it; stop enough of them.
// ---------------------------------------------------------------------------
class SpiderRoom extends RoomScene {
  constructor(game) {
    super(game);
    this.title = 'HOUSEPLANT';
    this.goalLabel = 'SPIDERS';
    this.need = Math.min(5 + this.level, 12);
    this.platforms.push(plat(116, 204, 150, { id: 'table' }));
    this.platforms.push(plat(30, 104, 118, { id: 'shelfL' }));
    this.platforms.push(plat(216, 290, 118, { id: 'shelfR' }));
    this.platforms.push(plat(64, 116, 84, { id: 'shelfL2' }));
    this.platforms.push(plat(204, 256, 84, { id: 'shelfR2' }));
    this.platforms.push(plat(138, 182, 56, { id: 'hook' }));
    this.leaves = [
      { x: 150, y: 120 }, { x: 170, y: 120 }, { x: 144, y: 112 }, { x: 176, y: 112 },
      { x: 154, y: 104 }, { x: 166, y: 104 }, { x: 160, y: 98 },
    ];
    this.leaves.forEach((l) => { l.alive = true; });
    this.spiders = [];
    this.spawnT = 1;
  }

  get progressText() {
    const left = this.leaves.filter((l) => l.alive).length;
    return `${this.goalLabel} ${this.caught}/${this.need} LEAVES ${left}`;
  }

  step(dt) {
    const cat = this.cat;
    cat.update(dt, this.platforms);
    this.spawnT -= dt;
    const max = Math.min(2 + Math.floor(this.level / 2), 5);
    if (this.spawnT <= 0 && this.spiders.length < max) {
      this.spawnT = Math.max(0.8, 2.4 - 0.2 * this.level) * rand(0.7, 1.3);
      const x = pick([rand(110, 140), rand(140, 180), rand(180, 210), rand(60, 110), rand(210, 260)]);
      this.spiders.push({ x, y: CEIL + 2, t: 0, speed: rand(9, 13) + 2.2 * this.level, pause: 0, state: 'down' });
    }
    for (const s of this.spiders) {
      s.t += dt;
      if (s.state === 'down') {
        if (s.pause > 0) s.pause -= dt;
        else {
          s.y += s.speed * dt;
          if (Math.random() < dt * 0.4) s.pause = rand(0.3, 0.9);
        }
        // Spiders not above the plant drift toward it on their thread.
        if (s.x < 140) s.x += dt * 6; else if (s.x > 180) s.x -= dt * 6;
        if (s.y >= 100 && Math.abs(s.x - 160) < 22) {
          const alive = this.leaves.filter((l) => l.alive);
          const leaf = alive.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0];
          if (leaf) leaf.alive = false;
          Sound.play('hiss');
          s.state = 'up';
          if (!this.leaves.some((l) => l.alive)) {
            this.popup(160, 90, 'THE PLANT IS GONE!');
            cat.kill();
            return;
          }
        }
      } else {
        s.y -= 40 * dt;
        if (s.y < CEIL) s.gone = true;
      }
      if (!s.gone && s.state === 'down' && !cat.dead && overlap(cat.box, { x: s.x - 4, y: s.y - 3, w: 8, h: 6 })) {
        s.gone = true;
        this.caught++;
        this.score(100 * this.level, s.x, s.y - 8);
        Sound.play('squish');
        if (this.caught >= this.need) this.complete();
      }
    }
    this.spiders = this.spiders.filter((s) => !s.gone);
  }

  drawRoom() {
    for (const p of this.platforms) {
      if (p.id.startsWith('shelf')) this.drawShelf(p);
    }
    // Hanging hook shelf.
    vline(142, CEIL, 56, 'w');
    vline(178, CEIL, 56, 'w');
    rect(138, 56, 44, 3, 'w');
    this.drawTable(116, 204, 150);
    // Pot and stems.
    rect(148, 134, 24, 16, 'm');
    rect(146, 132, 28, 3, 'w');
    for (const l of this.leaves) line(160, 132, l.x, l.y + 2, 'c');
  }

  drawFront() {
    for (const l of this.leaves) {
      if (l.alive) {
        ellipse(l.x, l.y, 4, 2, 'c');
        px(l.x, l.y, 'w');
      } else {
        px(l.x, l.y + 2, 'm');
      }
    }
    for (const s of this.spiders) {
      vline(s.x, CEIL + 1, s.y - 3, 'w');
      drawSprite(SPIDER[Math.floor(s.t * 6) % 2], s.x, s.y + 3);
    }
  }
}

const ROOM_TYPES = {
  cheese: CheeseRoom,
  fish: FishRoom,
  bird: BirdRoom,
  dog: DogRoom,
  spider: SpiderRoom,
};
