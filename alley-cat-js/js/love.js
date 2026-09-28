'use strict';
// ---------------------------------------------------------------------------
// The sweetheart stage: climb the drifting rows of hearts past rival toms
// and reach her balcony before time runs out. Winning ends the level.
// ---------------------------------------------------------------------------

const LOVE = {
  floor: 190,
  rows: [162, 134, 106, 78],
  balcony: 50,
};

class LoveScene {
  constructor(game) {
    this.game = game;
    this.kind = 'love';
    this.level = game.level;
    this.t = 0;
    this.timeLimit = Math.max(30, 50 - 3 * (this.level - 1));
    this.cat = new Cat(16, LOVE.floor);
    this.cat.inv = 1;
    this.won = false;
    this.wonT = 0;
    this.deadT = 0;
    this.knockT = 0;
    this.sparks = [];
    this.rows = LOVE.rows.map((y, i) => {
      const segs = [];
      let x = rand(0, 20);
      while (x < 300) {
        const len = randi(36, 60) - Math.min(12, this.level * 2);
        if (x + len > 320) break;
        segs.push({ a: x, len });
        x += len + randi(30, 48);
      }
      const speed = (14 + 3 * this.level + i * 3) * (i % 2 ? -1 : 1);
      return { y, segs, off: rand(0, 320), speed };
    });
    // Rival toms patrol individual segments.
    this.rivals = [];
    const n = Math.min(1 + this.level, 7);
    for (let k = 0; k < n; k++) {
      const r = 1 + (k % 3);
      const row = this.rows[r];
      const seg = row.segs[k % row.segs.length];
      this.rivals.push({ row: r, seg, u: rand(6, seg.len - 6), dir: Math.random() < 0.5 ? -1 : 1, t: rand(0, 3), hissT: 0 });
    }
    this.hearts = [];
    for (let i = 0; i < 24; i++) this.hearts.push({ x: rand(0, W), y: rand(14, H), s: rand(4, 12), c: pick(['m', 'm', 'c']) });
    Sound.play('love');
  }

  platforms() {
    const list = [
      plat(0, W, LOVE.floor, { id: 'floor', solid: true }),
      plat(130, 190, LOVE.balcony, { id: 'balcony' }),
    ];
    this.rows.forEach((row, ri) => {
      row.segs.forEach((s, si) => {
        const a = ((s.a + row.off) % 320 + 320) % 320;
        const b = a + s.len;
        const id = `r${ri}s${si}`;
        if (b <= 320) list.push(plat(a, b, row.y, { id, vx: row.speed }));
        else {
          list.push(plat(a, 320, row.y, { id, vx: row.speed }));
          list.push(plat(0, b - 320, row.y, { id, vx: row.speed }));
        }
      });
    });
    return list;
  }

  rivalX(rv) {
    const row = this.rows[rv.row];
    return (((rv.seg.a + rv.u + row.off) % 320) + 320) % 320;
  }

  update(dt) {
    const cat = this.cat;
    this.t += dt;
    for (const h of this.hearts) { h.y -= h.s * dt; if (h.y < 12) { h.y = H; h.x = rand(0, W); } }
    this.sparks = this.sparks.filter((s) => { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt; return s.t < 1.5; });

    if (this.won) {
      this.wonT += dt;
      this.cat.x += clamp(154 - this.cat.x, -60 * dt, 60 * dt);
      if (Math.random() < dt * 20) {
        this.sparks.push({ x: 160 + rand(-10, 10), y: LOVE.balcony - 14, vx: rand(-50, 50), vy: rand(-80, -30), t: 0, c: pick(['m', 'w', 'c']) });
      }
      if (this.wonT > 3.2) this.game.loveComplete();
      return;
    }

    for (const row of this.rows) row.off = (row.off + row.speed * dt + 320) % 320;
    const plats = this.platforms();

    if (this.knockT > 0) {
      this.knockT -= dt;
      cat.frozen = true;
    }
    cat.update(dt, plats);
    cat.frozen = false;

    if (cat.dead) {
      this.deadT += dt;
      if (this.deadT > 1.6) this.game.catDied();
      return;
    }

    for (const rv of this.rivals) {
      rv.t += dt;
      rv.u += rv.dir * (18 + 3 * this.level) * dt;
      if (rv.u < 5) { rv.u = 5; rv.dir = 1; }
      if (rv.u > rv.seg.len - 5) { rv.u = rv.seg.len - 5; rv.dir = -1; }
      const rx = this.rivalX(rv);
      const ry = this.rows[rv.row].y;
      const dx = ((rx - cat.x + 480) % 320) - 160;
      if (cat.vulnerable && this.knockT <= 0 && Math.abs(dx) < 11 && Math.abs(ry - cat.y) < 9) {
        // Knocked off the row: tumble down to the rows below.
        this.knockT = 0.5;
        cat.ground = null;
        cat.vy = 60;
        cat.dropId = `r${rv.row}s${this.rows[rv.row].segs.indexOf(rv.seg)}`;
        cat.dropT = 0.4;
        cat.inv = 1.2;
        cat.x = clamp(cat.x + (dx > 0 ? -10 : 10), 6, W - 6);
        Sound.play('hiss');
      }
    }

    if (cat.ground && cat.ground.id === 'balcony') {
      this.won = true;
      this.wonT = 0;
      Sound.play('love');
      return;
    }

    if (this.t >= this.timeLimit) {
      cat.kill();
    }
  }

  draw() {
    rect(0, 12, W, H - 12, 'k');
    for (const h of this.hearts) drawHeart(Math.round(h.x), Math.round(h.y), 1, h.c);
    // Moon.
    ellipse(290, 30, 9, 9, 'w');
    ellipse(286, 28, 8, 8, 'k');
    // Balcony and the sweetheart.
    rect(126, LOVE.balcony, 68, 3, 'w');
    for (let x = 128; x < 192; x += 6) vline(x, LOVE.balcony + 3, LOVE.balcony + 12, 'm');
    hline(126, 193, LOVE.balcony + 12, 'w');
    const sweetY = LOVE.balcony;
    drawSprite(SPR.sweet.stand, 170, sweetY, true);
    drawBow(175, sweetY - 13);
    if (!this.won && Math.floor(this.t * 2) % 2) drawHeart(170, sweetY - 20, 1, 'm');

    // Heart rows.
    for (const p of this.platforms()) {
      if (!p.id.startsWith('r')) continue;
      for (let x = p.x1; x < p.x2; x += 8) {
        const w = Math.min(8, p.x2 - x);
        if (w >= 7) drawHeart(x + 4, p.y + 3, 2, 'm');
        else rect(x, p.y, w, 3, 'm');
      }
      hline(p.x1, p.x2 - 1, p.y, 'w');
    }
    hline(0, W, LOVE.floor, 'w');
    patRect(0, LOVE.floor + 1, W, H - LOVE.floor - 1, 'checker', 'm', 'k');

    for (const rv of this.rivals) {
      const x = this.rivalX(rv);
      const y = this.rows[rv.row].y;
      for (const ox of [0, -320, 320]) {
        if (x + ox > -10 && x + ox < W + 10) drawCatSprite(SPR.rival, x + ox, y, rv.dir, 'walk', rv.t);
      }
    }

    if (this.won) {
      const bounce = Math.abs(Math.sin(this.wonT * 6)) * 3;
      drawSprite(SPR.cat.stand, this.cat.x, this.cat.y - bounce, false);
      for (const s of this.sparks) drawHeart(Math.round(s.x), Math.round(s.y), 1, s.c);
      sctext('LOVE AT FIRST SIGHT!', 90, Math.floor(this.wonT * 5) % 2 ? 'm' : 'w', 1);
    } else {
      this.cat.draw();
    }

    // HUD strip.
    rect(0, 12, W, 9, 'k');
    text('SWEETHEART', 2, 13, 'm');
    const left = Math.max(0, Math.ceil(this.timeLimit - this.t));
    const tt = `TIME ${left}`;
    text(tt, W - textWidth(tt) - 2, 13, left <= 5 && Math.floor(this.t * 4) % 2 ? 'm' : 'w');
    if (this.t < 2.5 && !this.won) sctext('REACH YOUR SWEETHEART!', 110, 'w');
  }
}
