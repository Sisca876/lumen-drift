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
    // Reef silhouettes: two jagged ridgelines rising out of the sea at the
    // horizon, generated once so the skyline never shimmers.
    this.ridges = [];
    for (let layer = 0; layer < 2; layer++) {
      const pts = [];
      const base = SEA_Y + (layer === 0 ? 2 : 16);
      const peak = layer === 0 ? 46 : 26;
      let x = -20;
      while (x < WORLD.w + 40) {
        const wSeg = 50 + rng() * 90;
        pts.push({ x, y: base - rng() * peak });
        x += wSeg;
      }
      this.ridges.push({ pts, base, color: layer === 0 ? '#232c5e' : '#1a2148', drift: layer === 0 ? 3 : 6 });
    }
    // Ambient sky lanterns: tiny paper lanterns drifting far above the sea,
    // pulsing warm. Decoration only — the gameplay lanterns are bigger and
    // ringed, so the two never read the same.
    this.skyLanterns = [];
    for (let i = 0; i < 6; i++) {
      this.skyLanterns.push({
        x: rng() * WORLD.w,
        y: 110 + rng() * 190,
        speed: 4 + rng() * 6,
        tw: rng() * Math.PI * 2,
        s: 0.7 + rng() * 0.5,
      });
    }
    // Sea fireflies: drifting plankton motes, half in the air above the
    // water and half glowing just under its surface. They wander slowly and
    // pulse, so the night always feels alive even between waves.
    this.plankton = [];
    const planktonColors = ['#5eead4', '#fcd34d', '#c4b5fd', '#a7f3d0'];
    for (let i = 0; i < 46; i++) {
      const inSea = i % 2 === 0;
      this.plankton.push({
        x: rng() * WORLD.w,
        y: inSea ? SEA_Y + 20 + rng() * (WORLD.h - SEA_Y - 30) : 100 + rng() * (SEA_Y - 130),
        r: 1 + rng() * 1.7,
        tw: rng() * Math.PI * 2,
        drift: 3 + rng() * 7,
        bob: 4 + rng() * 8,
        color: planktonColors[(rng() * planktonColors.length) | 0],
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

    // Thin aurora ribbons: slow undulating bands of teal and violet light.
    for (let i = 0; i < 2; i++) {
      const baseY = 56 + i * 52;
      const amp = 16 + i * 8;
      const color = i === 0 ? '45, 212, 191' : '167, 139, 250';
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= w; x += 24) {
        ctx.lineTo(x, baseY + Math.sin(x / 260 + this.t * 0.24 + i * 2.1) * amp);
      }
      for (let x = w; x >= 0; x -= 24) {
        ctx.lineTo(x, baseY + 26 + Math.sin(x / 220 + this.t * 0.2 + i * 2.1 + 1) * amp);
      }
      ctx.closePath();
      const ag = ctx.createLinearGradient(0, baseY - amp, 0, baseY + 30 + amp);
      ag.addColorStop(0, `rgba(${color}, 0)`);
      ag.addColorStop(0.5, `rgba(${color}, ${0.13 - i * 0.03})`);
      ag.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = ag;
      ctx.fill();
      ctx.restore();
    }

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

    // The moon, clean and phased: full over the Shallow Gleam, gibbous over
    // the Drowned Choir, crescent over the Hollow Deep. The shadow is a
    // sky-toned disc, so no grey smudge ever sits on the lit face.
    ctx.save();
    const mx = 1090;
    const my = 84;
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
    halo.addColorStop(0, 'rgba(254, 243, 199, 0.5)');
    halo.addColorStop(0.35, 'rgba(254, 243, 199, 0.14)');
    halo.addColorStop(1, 'rgba(254, 243, 199, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 90, my - 90, 180, 180);
    const moonGrad = ctx.createRadialGradient(mx - 8, my - 10, 4, mx, my, 30);
    moonGrad.addColorStop(0, '#fffdf0');
    moonGrad.addColorStop(0.7, '#fdf6d8');
    moonGrad.addColorStop(1, '#efe6bd');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(mx, my, 30, 0, Math.PI * 2);
    ctx.fill();
    // Whisper-soft craters, drawn before the phase shadow covers them.
    ctx.fillStyle = 'rgba(201, 194, 168, 0.28)';
    ctx.beginPath();
    ctx.arc(mx - 10, my - 6, 5, 0, Math.PI * 2);
    ctx.arc(mx + 9, my + 9, 3.6, 0, Math.PI * 2);
    ctx.arc(mx + 11, my - 12, 3, 0, Math.PI * 2);
    ctx.fill();
    const phaseShift = [0, 16, 34][this.reef] || 0;
    if (phaseShift > 0) {
      const shadow = ctx.createLinearGradient(mx, my - 30, mx, my + 30);
      shadow.addColorStop(0, 'rgba(26, 37, 96, 0.96)');
      shadow.addColorStop(1, 'rgba(43, 58, 147, 0.96)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(mx + phaseShift, my, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Ambient sky lanterns drifting far above the sea.
    for (const l of this.skyLanterns) {
      const lx = (l.x + this.t * l.speed) % (w + 30) - 15;
      const ly = l.y + Math.sin(this.t * 0.5 + l.tw) * 8;
      const pulse = 0.55 + 0.35 * Math.sin(this.t * 1.6 + l.tw);
      ctx.save();
      ctx.globalAlpha = pulse;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22 * l.s);
      lg.addColorStop(0, 'rgba(252, 211, 77, 0.55)');
      lg.addColorStop(1, 'rgba(252, 211, 77, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(lx - 22 * l.s, ly - 22 * l.s, 44 * l.s, 44 * l.s);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(lx, ly, 5 * l.s, 7 * l.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Reef silhouettes rising out of the sea at the horizon.
    for (const ridge of this.ridges) {
      const off = (this.t * ridge.drift) % 60;
      ctx.fillStyle = ridge.color;
      ctx.beginPath();
      ctx.moveTo(-20 - off, ridge.base + 20);
      for (const p of ridge.pts) ctx.lineTo(p.x - off, p.y);
      ctx.lineTo(WORLD.w + 40 - off, ridge.base + 20);
      ctx.closePath();
      ctx.fill();
      // A few coral glimmers on the near ridge.
      if (ridge.drift === 6) {
        ctx.fillStyle = 'rgba(45, 212, 191, 0.5)';
        for (let i = 0; i < ridge.pts.length; i += 3) {
          const p = ridge.pts[i];
          ctx.beginPath();
          ctx.arc(p.x - off, p.y + 8, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

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
    crest(4, 300, 1.8, 128, '#99f6e4', 0.22, 1.5);
    crest(9, 90, 0.5, 150, '#0d9488', 0.2, 2);

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

    // Sea fireflies: drifting, pulsing plankton over the whole night.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.plankton) {
      const x = (m.x + this.t * m.drift) % (w + 20) - 10;
      const y = m.y + Math.sin(this.t * 0.6 + m.tw) * m.bob;
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 1.9 + m.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, m.r * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
