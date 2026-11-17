// The night sea: gradient sky, painted nebula, three parallax star layers,
// a distant moon, and an animated glowing sea with travelling wave crests.

import { WORLD, SEA_Y, PALETTE } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Background {
  constructor() {
    this.t = 0;
    this.reef = 0;
    const rng = mulberry32(20261117);
    this.layers = [];
    for (let l = 0; l < 3; l++) {
      const stars = [];
      const count = [90, 60, 36][l];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: rng() * WORLD.w,
          y: rng() * (SEA_Y - 40),
          r: [1, 1.5, 2.2][l] * (0.7 + rng() * 0.7),
          tw: rng() * Math.PI * 2,
          speed: [4, 9, 16][l],
        });
      }
      this.layers.push(stars);
    }
    // Nebula blobs, painted once to an offscreen canvas.
    this.nebula = document.createElement('canvas');
    this.nebula.width = WORLD.w;
    this.nebula.height = SEA_Y;
    const nctx = this.nebula.getContext('2d');
    const blobs = [
      { x: 210, y: 130, r: 190, c: 'rgba(168, 85, 247, 0.20)' },
      { x: 1060, y: 90, r: 170, c: 'rgba(45, 212, 191, 0.16)' },
      { x: 640, y: 60, r: 230, c: 'rgba(96, 165, 250, 0.14)' },
      { x: 880, y: 210, r: 130, c: 'rgba(240, 171, 252, 0.13)' },
    ];
    for (const b of blobs) {
      const g = nctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = g;
      nctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    // Sea sparkles: fixed positions, animated alpha.
    this.sparkles = [];
    for (let i = 0; i < 70; i++) {
      this.sparkles.push({
        x: rng() * WORLD.w,
        y: SEA_Y + 14 + rng() * (WORLD.h - SEA_Y - 24),
        tw: rng() * Math.PI * 2,
        r: 1 + rng() * 1.8,
      });
    }
    this.skyGrad = null;
    this.seaGrad = null;
  }

  setReef(reef) { this.reef = reef; this.skyGrad = null; this.seaGrad = null; }

  update(dt) { this.t += dt; }

  draw(ctx) {
    const { w, h } = WORLD;
    if (!this.skyGrad) {
      this.skyGrad = ctx.createLinearGradient(0, 0, 0, SEA_Y);
      this.skyGrad.addColorStop(0, PALETTE.skyTop);
      this.skyGrad.addColorStop(0.6, PALETTE.skyMid);
      this.skyGrad.addColorStop(1, PALETTE.skyHorizon);
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, w, SEA_Y + 2);
    ctx.drawImage(this.nebula, 0, 0);

    // Distant moon with a soft halo.
    ctx.save();
    const mx = 1090;
    const my = 84;
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
    halo.addColorStop(0, 'rgba(254, 243, 199, 0.5)');
    halo.addColorStop(0.35, 'rgba(254, 243, 199, 0.14)');
    halo.addColorStop(1, 'rgba(254, 243, 199, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 90, my - 90, 180, 180);
    ctx.fillStyle = '#fdf6d8';
    ctx.beginPath();
    ctx.arc(mx, my, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 190, 230, 0.5)';
    ctx.beginPath();
    ctx.arc(mx - 10, my - 6, 7, 0, Math.PI * 2);
    ctx.arc(mx + 9, my + 9, 5, 0, Math.PI * 2);
    ctx.arc(mx + 12, my - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Parallax starfield with twinkle.
    for (let l = 0; l < this.layers.length; l++) {
      for (const s of this.layers[l]) {
        const x = (s.x + this.t * s.speed) % (w + 20) - 10;
        const a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 1.7 + s.tw));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#eef2ff';
        ctx.beginPath();
        ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // The sea: deep gradient + three travelling sine crests + sparkles.
    if (!this.seaGrad) {
      this.seaGrad = ctx.createLinearGradient(0, SEA_Y, 0, h);
      this.seaGrad.addColorStop(0, PALETTE.seaMid);
      this.seaGrad.addColorStop(0.35, PALETTE.seaDeep);
      this.seaGrad.addColorStop(1, '#081c33');
    }
    ctx.fillStyle = this.seaGrad;
    ctx.fillRect(0, SEA_Y, w, h - SEA_Y);

    const crest = (amp, len, speed, yOff, color, alpha, width) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 14) {
        const y = SEA_Y + yOff + Math.sin(x / len + this.t * speed) * amp
          + Math.sin(x / (len * 0.37) + this.t * speed * 1.6) * amp * 0.4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    crest(5, 190, 1.1, 8, '#5eead4', 0.55, 2.5);
    crest(7, 130, 0.8, 34, '#2dd4bf', 0.4, 2);
    crest(6, 240, 1.4, 62, '#99f6e4', 0.3, 2);
    crest(8, 110, 0.6, 96, '#14b8a6', 0.28, 2);

    // Horizon glow line where sky meets sea.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(0, SEA_Y - 10, 0, SEA_Y + 26);
    hg.addColorStop(0, 'rgba(125, 211, 252, 0)');
    hg.addColorStop(0.5, 'rgba(125, 211, 252, 0.35)');
    hg.addColorStop(1, 'rgba(125, 211, 252, 0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, SEA_Y - 10, w, 36);
    for (const s of this.sparkles) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 2.1 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.seaSpark;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
