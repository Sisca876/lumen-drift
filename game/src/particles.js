// Particles, shockwave rings and floating damage numbers.
// Everything here is additive glow: the game reads brighter when it is busy.

function rand(a, b) { return a + Math.random() * (b - a); }

export class Particles {
  constructor() {
    this.list = [];
    this.rings = [];
    this.texts = [];
  }

  burst(x, y, { colors, count = 18, speed = 260, life = 0.7, size = 4, drag = 2.6, gravity = 0 }) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * rand(0.25, 1);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * rand(0.5, 1.15),
        maxLife: life,
        size: size * rand(0.6, 1.5),
        color: colors[(Math.random() * colors.length) | 0],
        drag, gravity,
      });
    }
  }

  // A directed spray (beam impacts, muzzle sparks).
  spray(x, y, angle, { colors, count = 10, speed = 320, life = 0.45, size = 3.5, spread = 0.6 }) {
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread, spread);
      const s = speed * rand(0.4, 1);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * rand(0.6, 1.2),
        maxLife: life,
        size: size * rand(0.6, 1.4),
        color: colors[(Math.random() * colors.length) | 0],
        drag: 3.2, gravity: 0,
      });
    }
  }

  // Slow ambient motes rising off the sea.
  mote(x, y, color) {
    this.list.push({
      x, y, vx: rand(-8, 8), vy: rand(-34, -14),
      life: rand(1.4, 2.6), maxLife: 2.6, size: rand(1.5, 3),
      color, drag: 0.1, gravity: -6,
    });
  }

  ring(x, y, color, maxR = 90, life = 0.5, width = 4) {
    this.rings.push({ x, y, color, maxR, life, maxLife: life, width });
  }

  text(x, y, str, color = '#fef3c7', size = 18) {
    // Keep floating text out from under the HUD panels: clamp into the open
    // arena, so a "LANTERN LIT" at the arena's edge never hides behind the
    // CHART circle or the side panels.
    const cx = Math.max(200, Math.min(1080, x));
    const cy = Math.max(150, Math.min(624, y));
    // Stack texts that would pile onto one anchor (the spire under attack):
    // each live neighbour pushes the new text one slot higher, so every
    // line stays readable instead of printing over the last one.
    let slot = 0;
    for (const t of this.texts) {
      if (Math.abs(t.x - cx) < 80 && Math.abs(t.y - cy) < 26) slot++;
    }
    slot = Math.min(slot, 3);
    this.texts.push({ x: cx + rand(-8, 8), y: cy - slot * 22, str, color, size, life: 0.9, maxLife: 0.9 });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 46 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxR * (0.15 + 0.85 * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `800 ${t.size}px "Trebuchet MS", "Segoe UI", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(5, 8, 31, 0.85)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }
}
