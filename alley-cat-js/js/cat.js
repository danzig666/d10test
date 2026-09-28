'use strict';
// ---------------------------------------------------------------------------
// The player's cat: walking, jumping and landing on one-way platforms.
// Position is (x = centre, y = feet).
// ---------------------------------------------------------------------------

const GRAVITY = 640;
const JUMP_V = 232;   // peaks at ~42px, enough to hop one "storey"
const WALK_V = 78;
const MAX_FALL = 330;

class Cat {
  constructor(x = 160, y = 192) { this.reset(x, y); }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = 1;
    this.ground = null;
    this.dropId = null;
    this.dropT = 0;
    this.t = 0;
    this.dead = false;
    this.deadT = 0;
    this.inv = 0;
    this.frozen = false;
    this.noDrop = false;
    this.landed = false;
    this.landVy = 0;
    this.moving = false;
  }

  get box() { return { x: this.x - 6, y: this.y - 10, w: 12, h: 10 }; }
  get cy() { return this.y - 5; }
  get airborne() { return !this.ground; }
  get vulnerable() { return !this.dead && this.inv <= 0; }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.vy = -180;
    this.ground = null;
    Sound.play('die');
  }

  // Find the platform directly under the cat's feet.
  support(platforms) {
    for (const p of platforms) {
      if (Math.abs(p.y - this.y) < 0.5 && this.x >= p.x1 - 3 && this.x <= p.x2 + 3) return p;
    }
    return null;
  }

  update(dt, platforms) {
    this.t += dt;
    this.landed = false;
    if (this.dead) {
      this.deadT += dt;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      return;
    }
    if (this.inv > 0) this.inv -= dt;

    const move = this.frozen ? 0 : (Input.held.right ? 1 : 0) - (Input.held.left ? 1 : 0);
    this.vx = move * WALK_V;
    this.moving = move !== 0;
    if (move) this.dir = move;

    if (this.ground) {
      // Conveyor platforms (clotheslines, moving heart rows) carry the cat.
      this.x += this.ground.vx * dt;
      if (!this.frozen && Input.pressed.up) {
        this.vy = -JUMP_V;
        this.ground = null;
        Sound.play('jump');
      } else if (!this.frozen && !this.noDrop && Input.pressed.down && !this.ground.solid) {
        this.dropId = this.ground.id;
        this.dropT = 0.22;
        this.vy = 30;
        this.ground = null;
      }
    }

    this.x = clamp(this.x + this.vx * dt, 6, W - 6);
    if (this.dropT > 0 && (this.dropT -= dt) <= 0) this.dropId = null;

    if (this.ground) {
      const p = this.support(platforms);
      if (p) { this.ground = p; this.y = p.y; } else { this.ground = null; this.vy = 0; }
    }

    if (!this.ground) {
      const prevY = this.y;
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      this.y += this.vy * dt;
      if (this.vy >= 0) {
        let best = null;
        for (const p of platforms) {
          if (p.id === this.dropId) continue;
          if (prevY <= p.y + 0.01 && this.y >= p.y && this.x >= p.x1 - 2 && this.x <= p.x2 + 2) {
            if (!best || p.y < best.y) best = p;
          }
        }
        if (best) {
          this.landVy = this.vy;
          this.y = best.y;
          this.vy = 0;
          this.ground = best;
          this.landed = true;
          if (this.landVy > 120) Sound.play('land');
        }
      }
    }
  }

  draw(set = SPR.cat) {
    if (this.inv > 0 && !this.dead && Math.floor(this.inv * 12) % 2) return;
    const state = this.dead || this.ground === null ? 'air' : this.moving ? 'walk' : 'stand';
    if (this.dead) drawSprite(set.stand, this.x, this.y, this.dir < 0, true);
    else drawCatSprite(set, this.x, this.y, this.dir, state, this.t);
  }
}
