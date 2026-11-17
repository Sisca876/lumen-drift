// The actors: the lantern skiff, the void creatures, the Hollow Moon,
// starlight shards and enemy orbs — state, movement and drawing.

import { WORLD, PLAYER_TUNING, ENEMY_DEFS, BOSS_DEF, PALETTE } from './config.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }

// Pre-rendered radial glow sprite, tinted per color at first use.
const glowCache = new Map();
export function glowSprite(color) {
  if (glowCache.has(color)) return glowCache.get(color);
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color + 'aa');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 96, 96);
  glowCache.set(color, c);
  return c;
}

function drawGlow(ctx, x, y, radius, color, alpha = 0.8) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = WORLD.w / 2;
    this.y = WORLD.h - 170;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.hearts = PLAYER_TUNING.maxHearts;
    this.maxHearts = PLAYER_TUNING.maxHearts;
    this.light = PLAYER_TUNING.lightMax;
    this.lightMax = PLAYER_TUNING.lightMax;
    this.beamSputtered = false;
    this.dashTime = 0;
    this.dashCd = 0;
    this.dashDir = { x: 1, y: 0 };
    this.invuln = 0;
    this.shield = false; // Ember Guard: absorbs one hit per night
    this.afterimages = [];
    this.ribbon = []; // light ribbon trail
    this.aimAngle = -Math.PI / 2;
    this.upgrades = {
      damage: 1, bounces: 0, width: 1, speed: 1,
      magnet: 1, dashCd: 1, chain: 1, lightCap: 1,
    };
    this.bobPhase = 0;
    this.drawScale = 1; // the title screen shows the skiff larger
  }

  get radius() { return PLAYER_TUNING.radius; }

  lanternPos() {
    return { x: this.x + Math.cos(this.aimAngle) * 6, y: this.y - 26 * this.drawScale + Math.sin(this.bobPhase) * 2 };
  }

  startDash(dir) {
    if (this.dashCd > 0 || this.dashTime > 0) return false;
    this.dashTime = PLAYER_TUNING.dashTime;
    this.dashCd = PLAYER_TUNING.dashCooldown * this.upgrades.dashCd;
    this.dashDir = dir;
    this.invuln = Math.max(this.invuln, PLAYER_TUNING.dashTime + 0.12);
    return true;
  }

  update(dt, input, t) {
    this.bobPhase += dt * 2.2;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);

    const ax = input.axis();
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.dashDir.x * PLAYER_TUNING.dashSpeed;
      this.vy = this.dashDir.y * PLAYER_TUNING.dashSpeed;
      this.afterimages.push({ x: this.x, y: this.y, angle: this.angle, life: 0.3, maxLife: 0.3 });
    } else {
      const speed = PLAYER_TUNING.speed * this.upgrades.speed;
      this.vx += ax.x * PLAYER_TUNING.accel * dt;
      this.vy += ax.y * PLAYER_TUNING.accel * dt;
      const damp = Math.exp(-PLAYER_TUNING.friction * dt);
      this.vx *= damp;
      this.vy *= damp;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > speed) { this.vx = (this.vx / sp) * speed; this.vy = (this.vy / sp) * speed; }
    }
    this.x = clamp(this.x + this.vx * dt, 30, WORLD.w - 30);
    this.y = clamp(this.y + this.vy * dt, 92, WORLD.h - 26);

    if (Math.hypot(this.vx, this.vy) > 30) this.angle = Math.atan2(this.vy, this.vx);
    this.aimAngle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);

    // Light ribbon: keep the last ~0.5s of lantern positions.
    this.ribbon.unshift({ x: this.x, y: this.y - 24 });
    if (this.ribbon.length > 26) this.ribbon.pop();
    for (const g of this.afterimages) g.life -= dt;
    this.afterimages = this.afterimages.filter((g) => g.life > 0);
  }

  draw(ctx, t) {
    // Afterimages (dash ghosts).
    for (const g of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = (g.life / g.maxLife) * 0.4;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      drawSkiffShape(ctx, '#67e8f9');
      ctx.restore();
    }
    // Light ribbon trailing the lantern.
    if (this.ribbon.length > 3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = this.ribbon.length - 1; i >= 1; i--) {
        const f = 1 - i / this.ribbon.length;
        ctx.globalAlpha = f * 0.35;
        ctx.strokeStyle = i % 2 ? '#fcd34d' : '#67e8f9';
        ctx.lineWidth = 1 + f * 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.ribbon[i].x, this.ribbon[i].y);
        ctx.lineTo(this.ribbon[i - 1].x, this.ribbon[i - 1].y);
        ctx.stroke();
      }
      ctx.restore();
    }
    const bob = Math.sin(this.bobPhase) * 2.5;
    const blink = this.invuln > 0 && Math.floor(t * 14) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.scale(this.drawScale, this.drawScale);
    if (blink) ctx.globalAlpha = 0.45;
    // Lantern glow + reflection shimmer on the water.
    drawGlow(ctx, 0, -26, 64, '#fcd34d', 0.55);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.ellipse(0, 34, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Hull, rocked gently by the sea.
    ctx.rotate(Math.sin(this.bobPhase * 0.7) * 0.05 + clamp(this.vx / 900, -0.2, 0.2));
    drawSkiffShape(ctx, '#7c5a3a');
    // Mast + lantern.
    ctx.strokeStyle = '#5b4326';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -30);
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -30, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(0, -30, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shield ring.
    if (this.shield) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.arc(this.x, this.y + bob, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawSkiffShape(ctx, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-24, -2);
  ctx.quadraticCurveTo(-14, 12, 0, 13);
  ctx.quadraticCurveTo(14, 12, 24, -2);
  ctx.quadraticCurveTo(12, 2, 0, 2);
  ctx.quadraticCurveTo(-12, 2, -24, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a8e6f0';
  ctx.beginPath();
  ctx.moveTo(-20, -2);
  ctx.quadraticCurveTo(0, 5, 20, -2);
  ctx.quadraticCurveTo(0, 0, -20, -2);
  ctx.closePath();
  ctx.fill();
}

export class Enemy {
  constructor(type, x, y, hpScale = 1) {
    const def = ENEMY_DEFS[type];
    this.type = type;
    this.def = def;
    this.x = x;
    this.y = y;
    this.hp = def.hp * hpScale;
    this.maxHp = this.hp;
    this.radius = def.radius;
    this.speed = def.speed;
    this.flash = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.shootTimer = rand(1.2, 2.4);
    this.chargeState = 'roam'; // darter: roam -> telegraph -> charge
    this.chargeTimer = 0;
    this.chargeDir = { x: 0, y: 0 };
    this.beamAcc = 0;
    this.spawnT = 0;
    this.dead = false;
    // Some of the tide is drawn to the Lantern Spire's light instead of the
    // skiff: jellies drift toward it most of all. (Title-screen jellies get
    // a stub game with no spire, so they always chase the title target.)
    const spireOdds = { jelly: 0.6, darter: 0.2, shooter: 0.25, weaver: 0.2 };
    this.targetSpire = Math.random() < (spireOdds[type] || 0);
  }

  update(dt, player, game) {
    this.spawnT += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.wobble += dt * 3;
    const focus = (this.targetSpire && game && game.spire) ? game.spire : player;
    const dx = focus.x - this.x;
    const dy = focus.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (this.type === 'jelly') {
      const wob = Math.sin(this.wobble) * 0.5;
      this.x += (nx * this.speed + -ny * wob * 30) * dt;
      this.y += (ny * this.speed + nx * wob * 30) * dt;
    } else if (this.type === 'darter') {
      if (this.chargeState === 'roam') {
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
        this.chargeTimer += dt;
        if (this.chargeTimer > 1.6 && dist < 420) {
          this.chargeState = 'telegraph';
          this.chargeTimer = 0;
        }
      } else if (this.chargeState === 'telegraph') {
        this.chargeTimer += dt;
        this.chargeDir = { x: nx, y: ny };
        if (this.chargeTimer > 0.55) { this.chargeState = 'charge'; this.chargeTimer = 0; }
      } else {
        this.x += this.chargeDir.x * this.speed * 4.6 * dt;
        this.y += this.chargeDir.y * this.speed * 4.6 * dt;
        this.chargeTimer += dt;
        if (this.chargeTimer > 0.42) { this.chargeState = 'roam'; this.chargeTimer = 0; }
      }
    } else if (this.type === 'shooter') {
      // Keep a firing ring around the player.
      const want = 330;
      const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      const orbit = 0.5;
      this.x += (nx * toward * this.speed + -ny * orbit * this.speed * 0.7) * dt;
      this.y += (ny * toward * this.speed + nx * orbit * this.speed * 0.7) * dt;
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && dist < 560) {
        game.spawnEnemyBullet(this.x, this.y, nx, ny, 190);
        this.shootTimer = rand(2.0, 2.8);
      }
    } else if (this.type === 'weaver') {
      const sway = Math.sin(this.wobble * 0.7) * 60;
      this.x += (nx * this.speed + -ny * sway * 0.6) * dt;
      this.y += (ny * this.speed * 0.7 + nx * sway * 0.4) * dt;
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && dist < 520) {
        const base = Math.atan2(ny, nx);
        for (const off of [-0.3, 0, 0.3]) {
          game.spawnEnemyBullet(this.x, this.y, Math.cos(base + off), Math.sin(base + off), 165);
        }
        this.shootTimer = rand(2.4, 3.1);
      }
    }
    this.x = clamp(this.x, 24, WORLD.w - 24);
    this.y = clamp(this.y, 96, WORLD.h - 24);
  }

  draw(ctx, t) {
    const spawnScale = Math.min(1, this.spawnT * 3);
    const pulse = 1 + Math.sin(this.wobble * 1.4) * 0.07;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(spawnScale * pulse, spawnScale * pulse);
    drawGlow(ctx, 0, 0, this.radius * 2.1, this.def.color, 0.5);
    if (this.flash > 0) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.type === 'jelly') drawJelly(ctx, this, t);
    else if (this.type === 'darter') drawDarter(ctx, this, t);
    else if (this.type === 'shooter') drawShooter(ctx, this, t);
    else drawWeaver(ctx, this, t);
    ctx.restore();
    // Health pip for hurt enemies.
    if (this.hp < this.maxHp) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 8, 31, 0.7)';
      ctx.fillRect(this.x - 18, this.y - this.radius - 12, 36, 5);
      ctx.fillStyle = this.def.color;
      ctx.fillRect(this.x - 18, this.y - this.radius - 12, 36 * (this.hp / this.maxHp), 5);
      ctx.restore();
    }
  }
}

function drawJelly(ctx, e, t) {
  const c = e.def;
  // Trailing tentacles.
  ctx.strokeStyle = c.color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.8;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 7, 6);
    ctx.quadraticCurveTo(
      i * 9 + Math.sin(t * 3 + i) * 6, 20,
      i * 7 + Math.sin(t * 3 + i * 2) * 9, 32,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Bell.
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.arc(0, 0, e.radius, Math.PI, 0);
  ctx.quadraticCurveTo(e.radius * 0.7, 8, 0, 8);
  ctx.quadraticCurveTo(-e.radius * 0.7, 8, -e.radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.core;
  ctx.beginPath();
  ctx.arc(0, -4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -8, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDarter(ctx, e, t) {
  const c = e.def;
  const telegraph = e.chargeState === 'telegraph';
  ctx.rotate(Math.atan2(e.chargeDir.y, e.chargeDir.x) || 0);
  if (telegraph) {
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(120, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.core;
  ctx.beginPath();
  ctx.arc(2, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(5, -2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawShooter(ctx, e, t) {
  const c = e.def;
  ctx.fillStyle = c.color;
  // Spiked ring.
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.8;
    const r1 = e.radius + 5;
    const r2 = e.radius - 4;
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a + 0.39) * r2, Math.sin(a + 0.39) * r2);
  }
  ctx.fill();
  ctx.fillStyle = c.core;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawWeaver(ctx, e, t) {
  const c = e.def;
  // Three orbiting petals.
  for (let i = 0; i < 3; i++) {
    const a = t * 1.4 + (i / 3) * Math.PI * 2;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 16, Math.sin(a) * 16, 10, 6, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = c.core;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-2, -2, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

export class Boss {
  constructor() {
    this.x = WORLD.w / 2;
    this.y = 210;
    this.hp = BOSS_DEF.hp;
    this.maxHp = BOSS_DEF.hp;
    this.radius = BOSS_DEF.radius;
    this.flash = 0;
    this.t = 0;
    this.attackTimer = 1.6;
    this.spiralAngle = 0;
    this.phase = 1;
    this.beamAcc = 0;
    this.dead = false;
    this.dying = 0; // death cinematic timer
  }

  update(dt, player, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    const frac = this.hp / this.maxHp;
    this.phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    // Slow menacing drift.
    this.x = WORLD.w / 2 + Math.sin(this.t * 0.32) * 240;
    this.y = 205 + Math.sin(this.t * 0.5) * 26;

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      const speed = this.phase === 3 ? 0.85 : this.phase === 2 ? 1.05 : 1.3;
      const roll = Math.random();
      if (roll < 0.42) {
        // Spiral burst.
        const arms = 3 + this.phase;
        for (let i = 0; i < arms; i++) {
          const a = this.spiralAngle + (i / arms) * Math.PI * 2;
          game.spawnEnemyBullet(this.x, this.y, Math.cos(a), Math.sin(a), 150);
        }
        this.spiralAngle += 0.55;
        this.attackTimer = speed * 0.55;
      } else if (roll < 0.75) {
        // Aimed fan at the skiff.
        const base = Math.atan2(player.y - this.y, player.x - this.x);
        for (const off of [-0.35, -0.17, 0, 0.17, 0.35]) {
          game.spawnEnemyBullet(this.x, this.y, Math.cos(base + off), Math.sin(base + off), 210);
        }
        this.attackTimer = speed * 1.1;
      } else {
        // Summon jellies from the dark.
        for (let i = 0; i < 2 + (this.phase === 3 ? 1 : 0); i++) {
          game.spawnEnemy('jelly', this.x + rand(-90, 90), this.y + rand(30, 80));
        }
        this.attackTimer = speed * 1.7;
      }
    }
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawGlow(ctx, 0, 0, this.radius * 2.4, PALETTE.bossGlow, 0.6);
    // Halo ring.
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 14]);
    ctx.lineDashOffset = -t * 22;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // The moon body.
    const grad = ctx.createRadialGradient(-30, -34, 10, 0, 0, this.radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, PALETTE.bossSkin);
    grad.addColorStop(1, '#aab3d6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    // Craters.
    ctx.fillStyle = PALETTE.bossCrater;
    ctx.globalAlpha = 0.55;
    const craters = [[-38, -22, 16], [30, -38, 11], [42, 26, 18], [-18, 40, 12], [8, 4, 8]];
    for (const [cx, cy, r] of craters) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Hollow eyes — the face of the void.
    ctx.fillStyle = '#1e1040';
    ctx.beginPath();
    ctx.ellipse(-26, -12, 12, 17, 0, 0, Math.PI * 2);
    ctx.ellipse(26, -12, 12, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e879f9';
    ctx.beginPath();
    ctx.arc(-26, -12, 4.5, 0, Math.PI * 2);
    ctx.arc(26, -12, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Hollow mouth.
    ctx.fillStyle = '#1e1040';
    ctx.beginPath();
    ctx.ellipse(0, 34, 20, 11 + Math.sin(t * 1.8) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

export class Shard {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = rand(-90, 90);
    this.vy = rand(-120, -30);
    this.life = 7;
    this.phase = Math.random() * Math.PI * 2;
    this.dead = false;
  }

  update(dt, player, magnetRadius) {
    this.life -= dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < magnetRadius) {
      const pull = 620 * (1 - dist / (magnetRadius + 40));
      this.vx += (dx / (dist || 1)) * pull * dt * 4;
      this.vy += (dy / (dist || 1)) * pull * dt * 4;
    }
    this.vx *= Math.exp(-2.4 * dt);
    this.vy *= Math.exp(-2.4 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.phase += dt * 4;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const blink = this.life < 1.5 && Math.floor(this.life * 8) % 2 === 0;
    if (blink) return;
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.phase) * 2);
    drawGlow(ctx, 0, 0, 22, '#fcd34d', 0.7);
    ctx.rotate(this.phase * 0.4);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(2.6, -2.6);
    ctx.lineTo(9, 0);
    ctx.lineTo(2.6, 2.6);
    ctx.lineTo(0, 9);
    ctx.lineTo(-2.6, 2.6);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-2.6, -2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// A wild lantern: dark until the starlance beam touches it. Lighting one
// feeds the spire and pays starlight.
export class WildLantern {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 30; // beam touch distance
    this.lit = false;
    this.phase = Math.random() * Math.PI * 2;
    this.flash = 0;
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 2);
  }

  draw(ctx, t) {
    const bob = Math.sin(t * 1.2 + this.phase) * 4;
    const y = this.y + bob;
    ctx.save();
    ctx.translate(this.x, y);
    if (this.lit) {
      drawGlow(ctx, 0, 0, 54 + this.flash * 26, '#fcd34d', 0.75);
      // Lit ring.
      ctx.strokeStyle = 'rgba(252, 211, 77, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Beckoning dashed ring so the player knows it wants light.
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.4)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -t * 14;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Paper lantern body.
    ctx.fillStyle = this.lit ? '#fde68a' : '#3f4a6b';
    ctx.strokeStyle = this.lit ? '#b45309' : '#5b6b94';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = this.lit ? 'rgba(180, 83, 9, 0.5)' : 'rgba(91, 107, 148, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, -5, 9, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 5, 9, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Cap + tassel.
    ctx.fillStyle = this.lit ? '#92400e' : '#2b3352';
    ctx.fillRect(-5, -17, 10, 4);
    ctx.strokeStyle = this.lit ? '#f59e0b' : '#4b5878';
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, 21);
    ctx.stroke();
    if (this.lit) {
      // Flame heart.
      const flick = 1 + Math.sin(t * 9 + this.phase) * 0.15;
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.ellipse(0, -1, 3.4 * flick, 5 * flick, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Cold ember.
      ctx.fillStyle = 'rgba(253, 230, 138, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// The Lantern Spire: the arena's anchor and the thing the voyage defends.
// A crystal tower crowned with a great lantern; the reef-light ring around
// its base shows how much light the spire has left.
export function drawSpire(ctx, spire, lightFrac, t) {
  const { x, y } = spire;
  const flick = 1 + Math.sin(t * 7) * 0.08 + Math.sin(t * 13.7) * 0.05;
  const flash = spire.flash || 0;
  ctx.save();
  ctx.translate(x, y);
  // Halo.
  drawGlow(ctx, 0, -58, 120 * flick, lightFrac > 0.3 ? '#fcd34d' : '#f87171', 0.5 + flash * 0.4);
  // Reef-light ring around the base.
  ctx.strokeStyle = 'rgba(5, 8, 31, 0.8)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 34, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = lightFrac > 0.3 ? '#fcd34d' : '#f87171';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 34, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, lightFrac));
  ctx.stroke();
  // Water ripple.
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 44, 52 + Math.sin(t * 1.4) * 3, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Stone base.
  ctx.fillStyle = '#2b3352';
  ctx.strokeStyle = '#5b6b94';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-34, 44);
  ctx.lineTo(-26, 16);
  ctx.lineTo(26, 16);
  ctx.lineTo(34, 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Rune marks on the base.
  ctx.fillStyle = lightFrac > 0.3 ? 'rgba(252, 211, 77, 0.8)' : 'rgba(248, 113, 113, 0.8)';
  for (const rx of [-18, 0, 18]) {
    ctx.beginPath();
    ctx.arc(rx, 30, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Crystal column.
  const grad = ctx.createLinearGradient(0, -56, 0, 20);
  grad.addColorStop(0, '#a5f3fc');
  grad.addColorStop(0.5, '#22d3ee');
  grad.addColorStop(1, '#155e75');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-13, 18);
  ctx.lineTo(-8, -48);
  ctx.lineTo(0, -60);
  ctx.lineTo(8, -48);
  ctx.lineTo(13, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Inner light vein.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(0, -50);
  ctx.stroke();
  // The great lantern: cage + flame.
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-14, -76, 28, 6);
  ctx.fillRect(-14, -52, 28, 5);
  ctx.fillStyle = lightFrac > 0.3 ? '#fde68a' : '#7f1d1d';
  ctx.beginPath();
  ctx.ellipse(0, -64, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.ellipse(0, -64, 4.5 * flick, 6.5 * flick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(146, 64, 14, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-12, -74);
  ctx.lineTo(-12, -54);
  ctx.moveTo(12, -74);
  ctx.lineTo(12, -54);
  ctx.stroke();
  // Crown spike.
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -76);
  ctx.lineTo(0, -86);
  ctx.stroke();
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(0, -88, 3, 0, Math.PI * 2);
  ctx.fill();
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 58 + (1 - flash) * 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export class EnemyBullet {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 7;
    this.life = 6;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -20 || this.x > WORLD.w + 20 || this.y < 60 || this.y > WORLD.h + 20) {
      this.dead = true;
    }
  }

  draw(ctx, t) {
    ctx.save();
    drawGlow(ctx, this.x, this.y, 24, '#d946ef', 0.75);
    ctx.fillStyle = '#3b0764';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.voidOrb;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f0abfc';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
