'use strict';
// ---------------------------------------------------------------------------
// The alley: street, trash cans, fence, clotheslines and a wall of windows.
// Neighbours open windows and throw junk; a bulldog patrols the street.
// Jumping through an open window takes the cat into one of the rooms.
// ---------------------------------------------------------------------------

const ALLEY = {
  ground: 192,
  canTop: 174,
  fenceTop: 148,
  lines: [116, 84, 52],
  windowCols: [36, 98, 160, 222, 284],
  canXs: [22, 92, 160, 228, 298],
};
// Each window row sits just above a walkable surface (fence or clothesline).
ALLEY.windowBases = [ALLEY.fenceTop, ...ALLEY.lines];

const LAUNDRY_SHAPES = {
  shirt: ['xxx.xxx', 'xxxxxxxxx', 'xxxxxxxxx', '..xxxxx..', '..xxxxx..', '..xxxxx..', '..xxxxx..'],
  sock: ['xx', 'xx', 'xx', 'xx', 'xxx', 'xxx'],
  pants: ['xxxxxxx', 'xxxxxxx', 'xxx.xxx', 'xx...xx', 'xx...xx', 'xx...xx', 'xx...xx', 'xx...xx'],
  towel: ['xxxxxxxxxxx', 'x.x.x.x.x.x', 'xxxxxxxxxxx', 'xxxxxxxxxxx', 'x.x.x.x.x.x', 'xxxxxxxxxxx'],
  dress: ['..xxx..', '..xxx..', '.xxxxx.', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx'],
};

function drawLaundry(shape, x, y, c) {
  const rows = LAUNDRY_SHAPES[shape];
  const w = Math.max(...rows.map((r) => r.length));
  const left = Math.round(x - w / 2);
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === 'x') px(left + i, y + j, c);
  });
  px(left + 1, y - 1, 'w'); // clothes-pegs
  px(left + w - 2, y - 1, 'w');
}

class AlleyScene {
  constructor(game) {
    this.game = game;
    this.kind = 'alley';
    this.cat = new Cat(20, ALLEY.ground);
    this.bg = makeLayer(W, H, () => this.drawStatic());
    this.windows = [];
    ALLEY.windowBases.forEach((base, row) => {
      ALLEY.windowCols.forEach((cx, col) => {
        this.windows.push({
          row, col, x: cx - 12, y: base - 30, w: 24, h: 18, base,
          state: 'closed', t: 0, dur: 0, thrower: null, room: null,
        });
      });
    });
    this.lines = ALLEY.lines.map((y, i) => ({
      y,
      dir: i % 2 ? -1 : 1,
      speed: 12 + i * 4,
      off: rand(0, 320),
      items: this.makeLaundry(),
    }));
    this.lids = ALLEY.canXs.map(() => ({ lift: 0, vy: 0 }));
    this.reset(true);
  }

  makeLaundry() {
    const items = [];
    let x = rand(0, 20);
    while (x < 300) {
      items.push({ x, shape: pick(Object.keys(LAUNDRY_SHAPES)), c: pick(['m', 'c', 'w']) });
      x += rand(34, 62);
    }
    return items;
  }

  // Clear hazards; used on a fresh life and when coming back from a room.
  reset(fresh) {
    this.objects = [];
    this.dog = null;
    this.dogWarn = 0;
    this.dogTimer = rand(6, 10);
    this.mouse = null;
    this.mouseTimer = rand(5, 10);
    this.openTimer = 1;
    this.deadT = 0;
    this.popups = [];
    for (const w of this.windows) {
      if (fresh || w.state !== 'closed') { w.state = 'closed'; w.t = 0; w.thrower = null; }
    }
  }

  get level() { return this.game.level; }

  respawn() {
    this.reset(false);
    this.cat.reset(20, ALLEY.ground);
    this.cat.inv = 2;
    this.openTimer = 2;
  }

  // Put the cat back outside the window it used to enter a room.
  returnFrom(win) {
    this.reset(false);
    const x = win ? win.x + win.w / 2 : 160;
    this.cat.reset(x, win ? win.base : ALLEY.fenceTop);
    this.cat.inv = 1.6;
  }

  platforms() {
    const lvl = 1 + (this.level - 1) * 0.12;
    const list = [plat(0, W, ALLEY.ground, { id: 'ground', solid: true })];
    ALLEY.canXs.forEach((x, i) => list.push(plat(x - 9, x + 9, ALLEY.canTop, { id: 'can' + i })));
    list.push(plat(0, W, ALLEY.fenceTop, { id: 'fence' }));
    this.lines.forEach((l, i) => list.push(plat(0, W, l.y, { id: 'line' + i, vx: l.dir * l.speed * lvl })));
    return list;
  }

  update(dt) {
    const cat = this.cat;
    const lvl = this.level;
    const plats = this.platforms();

    for (const l of this.lines) l.off = (l.off + l.dir * l.speed * (1 + (lvl - 1) * 0.12) * dt + 320) % 320;

    cat.update(dt, plats);
    if (cat.landed && cat.ground && cat.ground.id.startsWith('can')) {
      const i = +cat.ground.id.slice(3);
      this.lids[i].vy = -60;
      Sound.play('clang');
    }

    // Rattling trash-can lids.
    for (const lid of this.lids) {
      if (lid.lift > 0 || lid.vy < 0) {
        lid.vy += 400 * dt;
        lid.lift = Math.max(0, lid.lift - lid.vy * dt);
        if (lid.lift === 0) lid.vy = 0;
      } else if (Math.random() < dt * 0.05) {
        lid.vy = -45;
      }
    }

    this.updateWindows(dt);
    this.updateObjects(dt);
    this.updateDog(dt);
    this.updateMouse(dt);
    this.popups = this.popups.filter((p) => (p.t += dt) < 1);

    if (cat.dead) {
      this.deadT += dt;
      if (this.deadT > 1.6) this.game.catDied();
      return;
    }

    // Leap through an open window?
    if (cat.airborne) {
      for (const w of this.windows) {
        if (w.state !== 'open') continue;
        const inner = { x: w.x + 3, y: w.y + 3, w: w.w - 6, h: w.h - 6 };
        if (overlap(cat.box, inner)) {
          this.game.enterRoom(w.room, w);
          return;
        }
      }
    }
  }

  updateWindows(dt) {
    const lvl = this.level;
    const open = this.windows.filter((w) => w.state !== 'closed');
    this.openTimer -= dt;
    if (this.openTimer <= 0) {
      this.openTimer = rand(1.0, 2.8) / (1 + 0.15 * (lvl - 1));
      const maxOpen = Math.min(2 + Math.floor(lvl / 2), 6);
      const closed = this.windows.filter((w) => w.state === 'closed');
      if (open.length < maxOpen && closed.length) {
        const w = pick(closed);
        w.state = 'opening';
        w.t = 0;
        w.dur = rand(3.5, 6.5);
        w.room = this.game.pickRoom();
        w.thrower = Math.random() < Math.min(0.45 + 0.1 * lvl, 0.9)
          ? { t: 0, throws: lvl >= 3 && Math.random() < 0.5 ? 2 : 1, thrown: 0, junk: pick(Object.keys(JUNK)) }
          : null;
        Sound.play('window');
      }
    }

    for (const w of this.windows) {
      if (w.state === 'closed') continue;
      w.t += dt;
      if (w.state === 'opening' && w.t >= 0.35) { w.state = 'open'; w.t = 0; }
      else if (w.state === 'open') {
        const th = w.thrower;
        if (th) {
          th.t += dt;
          const throwAt = 0.9 + th.thrown * 0.8;
          if (th.thrown < th.throws && th.t >= throwAt) {
            th.thrown++;
            this.throwJunk(w, th.junk);
            th.junk = pick(Object.keys(JUNK));
          }
          if (th.thrown >= th.throws && th.t > throwAt + 0.6) w.thrower = null;
        }
        if (w.t >= w.dur) { w.state = 'closing'; w.t = 0; w.thrower = null; }
      } else if (w.state === 'closing' && w.t >= 0.35) {
        w.state = 'closed';
        w.t = 0;
      }
    }
  }

  throwJunk(w, type) {
    const cat = this.cat;
    const x = w.x + w.w / 2;
    const y = w.y + w.h / 2;
    const vy = -70;
    const gA = 260;
    const dy = Math.max(10, cat.cy - y);
    const t = (-vy + Math.sqrt(vy * vy + 2 * gA * dy)) / gA;
    const aim = cat.x + cat.vx * t * 0.6 + rand(-12, 12);
    const vx = clamp((aim - x) / t, -110, 110);
    this.objects.push({ x, y, vx, vy, g: gA, type, spin: 0 });
    Sound.play('throw');
  }

  updateObjects(dt) {
    const cat = this.cat;
    for (const o of this.objects) {
      o.vy += o.g * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.spin += dt;
      if (cat.vulnerable && overlap(cat.box, { x: o.x - 3, y: o.y - 3, w: 6, h: 6 })) {
        o.dead = true;
        cat.kill();
      }
      if (o.y > ALLEY.ground - 2 && !o.dead) {
        o.dead = true;
        Sound.play('crash');
      }
    }
    this.objects = this.objects.filter((o) => !o.dead && o.x > -10 && o.x < W + 10);
  }

  updateDog(dt) {
    const cat = this.cat;
    if (!this.dog) {
      this.dogTimer -= dt;
      if (this.dogTimer < 0.9 && !this.dogWarn) {
        this.dogWarn = cat.x > W / 2 ? -1 : 1; // dog comes from the far side
        Sound.play('bark');
      }
      if (this.dogTimer <= 0) {
        const dir = this.dogWarn || 1;
        this.dog = { x: dir > 0 ? -14 : W + 14, dir, t: 0, speed: 72 + 9 * (this.level - 1) };
        this.dogWarn = 0;
      }
      return;
    }
    const d = this.dog;
    d.t += dt;
    d.x += d.dir * d.speed * dt;
    if (cat.vulnerable && cat.y > ALLEY.ground - 4 && Math.abs(d.x - cat.x) < 14) {
      cat.kill();
      Sound.play('bark');
    }
    if (d.x < -30 || d.x > W + 30) {
      this.dog = null;
      this.dogTimer = rand(7, 14) / (1 + 0.12 * (this.level - 1));
    }
  }

  updateMouse(dt) {
    const cat = this.cat;
    if (!this.mouse) {
      this.mouseTimer -= dt;
      if (this.mouseTimer <= 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.mouse = { x: dir > 0 ? -6 : W + 6, dir, t: 0 };
      }
      return;
    }
    const m = this.mouse;
    m.t += dt;
    m.x += m.dir * 38 * dt;
    if (!cat.dead && overlap(cat.box, { x: m.x - 4, y: ALLEY.fenceTop - 4, w: 8, h: 4 })) {
      this.game.addScore(200);
      this.popups.push({ x: m.x, y: ALLEY.fenceTop - 10, text: '200', t: 0 });
      Sound.play('catch');
      this.mouse = null;
      this.mouseTimer = rand(8, 14);
      return;
    }
    if (m.x < -10 || m.x > W + 10) {
      this.mouse = null;
      this.mouseTimer = rand(8, 14);
    }
  }

  // --- drawing -------------------------------------------------------------

  drawStatic() {
    rect(0, 0, W, H, 'k');
    // Night sky strip with a moon.
    for (let i = 0; i < 18; i++) px(randi(0, W), randi(12, 16), pick(['w', 'c']));
    // Brick wall.
    patRect(0, 17, W, ALLEY.fenceTop - 17, 'brick', 'm', 'k');
    hline(0, W, 17, 'w');
    hline(0, W, 18, 'm');
    // Window recesses (the windows themselves are drawn live).
    for (const base of ALLEY.windowBases) {
      for (const cx of ALLEY.windowCols) {
        rect(cx - 14, base - 32, 28, 22, 'k');
        rect(cx - 15, base - 11, 30, 2, 'w'); // sill
      }
    }
    // Clothesline poles.
    for (const x of [1, W - 2]) { rect(x, 20, 1, ALLEY.fenceTop - 20, 'w'); }
    // Fence.
    rect(0, ALLEY.fenceTop, W, ALLEY.ground - ALLEY.fenceTop, 'k');
    for (let x = 0; x < W; x += 8) {
      rect(x, ALLEY.fenceTop + 2, 7, ALLEY.ground - ALLEY.fenceTop - 2, 'c');
      px(x + 3, ALLEY.fenceTop + 8, 'k');
      px(x + 3, ALLEY.fenceTop + 30, 'k');
    }
    rect(0, ALLEY.fenceTop, W, 2, 'w');
    rect(0, ALLEY.fenceTop + 12, W, 2, 'm');
    rect(0, ALLEY.fenceTop + 32, W, 2, 'm');
    // Street and kerb.
    rect(0, ALLEY.ground, W, H - ALLEY.ground, 'k');
    for (let x = 0; x < W; x += 12) rect(x, ALLEY.ground, 8, 1, 'w');
    for (let x = 6; x < W; x += 24) rect(x, ALLEY.ground + 4, 10, 1, 'm');
  }

  drawWindow(w) {
    const { x, y } = w;
    const inner = { x: x + 2, y: y + 2, w: w.w - 4, h: w.h - 4 };
    // How far the lower sash is raised (0 closed .. 1 open).
    let open = 0;
    if (w.state === 'opening') open = w.t / 0.35;
    else if (w.state === 'open') open = 1;
    else if (w.state === 'closing') open = 1 - w.t / 0.35;
    open = clamp(open, 0, 1);

    frame(x, y, w.w, w.h, 'w');
    frame(x + 1, y + 1, w.w - 2, w.h - 2, 'w');
    // Upper sash (always there).
    const half = Math.floor(inner.h / 2);
    rect(inner.x, inner.y, inner.w, half, 'c');
    vline(inner.x + inner.w / 2, inner.y, inner.y + half - 1, 'w');
    // Curtains.
    rect(inner.x, inner.y, 3, half, 'm');
    rect(inner.x + inner.w - 3, inner.y, 3, half, 'm');
    // Lower opening.
    const gap = Math.round(open * (inner.h - half));
    rect(inner.x, inner.y + half, inner.w, inner.h - half, 'c');
    if (gap > 0) {
      rect(inner.x, inner.y + half, inner.w, gap, 'k');
      hline(inner.x, inner.x + inner.w - 1, inner.y + half + gap - 1, 'w');
    }
    vline(inner.x + inner.w / 2, inner.y + half + gap, inner.y + inner.h - 1, 'w');
    hline(inner.x, inner.x + inner.w - 1, inner.y + half, 'w');

    if (w.state === 'open') {
      // Glowing interior hint and the neighbour.
      if (open === 1 && !w.thrower) {
        if (Math.floor(w.t * 3) % 2) px(inner.x + inner.w / 2 + 3, inner.y + half + 4, 'c');
      }
      if (w.thrower) this.drawNeighbour(w, inner, half);
    }
  }

  drawNeighbour(w, inner, half) {
    const th = w.thrower;
    const cx = inner.x + inner.w / 2;
    const rise = Math.min(1, th.t / 0.4);
    const top = inner.y + inner.h - Math.round(rise * 12);
    g.save();
    g.beginPath();
    g.rect(inner.x, inner.y, inner.w, inner.h);
    g.clip();
    ellipse(cx, top + 4, 4, 4, 'w');
    rect(cx - 4, top - 1, 9, 3, 'm'); // hair / cap
    px(cx - 2, top + 3, 'k');
    px(cx + 2, top + 3, 'k');
    hline(cx - 1, cx + 1, top + 6, 'k');
    rect(cx - 6, top + 9, 13, 6, 'c');
    // Arm winding up before each throw.
    const phase = (th.t - 0.5 - th.thrown * 0.8);
    if (phase > 0 && phase < 0.5 && th.thrown < th.throws) {
      rect(cx + 5, top + 1, 2, 8, 'w');
      drawSprite(JUNK[th.junk], cx + 6, top + 2);
    }
    g.restore();
  }

  drawCans() {
    ALLEY.canXs.forEach((x, i) => {
      const top = ALLEY.canTop;
      rect(x - 8, top + 2, 17, ALLEY.ground - top - 2, 'w');
      for (let y = top + 5; y < ALLEY.ground - 2; y += 4) hline(x - 8, x + 8, y, 'm');
      vline(x - 8, top + 2, ALLEY.ground - 1, 'c');
      const lift = Math.round(this.lids[i].lift);
      rect(x - 9, top - lift, 19, 2, 'c');
      rect(x - 2, top - 2 - lift, 5, 2, 'w');
    });
  }

  draw() {
    g.drawImage(this.bg, 0, 0);
    for (const w of this.windows) this.drawWindow(w);

    // Clotheslines with moving laundry.
    for (const l of this.lines) {
      hline(0, W, l.y, 'w');
      for (const it of l.items) {
        const x = (it.x + l.off) % 320;
        drawLaundry(it.shape, x, l.y + 1, it.c);
        if (x > W - 12) drawLaundry(it.shape, x - 320, l.y + 1, it.c);
      }
    }

    this.drawCans();

    if (this.mouse) {
      const m = this.mouse;
      drawSprite(SPR.mouseWhite[Math.floor(m.t * 10) % 2], m.x, ALLEY.fenceTop, m.dir < 0);
    }

    for (const o of this.objects) {
      const s = JUNK[o.type];
      const flipX = Math.floor(o.spin * 8) % 2 === 1;
      const flipY = Math.floor(o.spin * 8 + 1) % 4 >= 2;
      drawSprite(s, o.x, o.y + s.h / 2, flipX, flipY);
    }

    if (this.dog) {
      const d = this.dog;
      drawSprite(SPR.dog[Math.floor(d.t * 10) % 2], d.x, ALLEY.ground, d.dir < 0);
    } else if (this.dogWarn) {
      const x = this.dogWarn > 0 ? 4 : W - 10;
      if (Math.floor(this.dogTimer * 8) % 2) stext('!', x, ALLEY.ground - 14, 'm');
    }

    this.cat.draw();

    for (const p of this.popups) stext(p.text, p.x - 8, p.y - p.t * 10, 'c');
  }
}
