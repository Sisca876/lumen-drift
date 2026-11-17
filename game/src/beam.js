// Prism surfing: the starlance beam. A ray from the skiff's lantern travels
// toward the aim, reflects off prism buoys, and burns everything it touches.
// Reflected segments hit harder — chaining reflections is the whole game.

import { WORLD, BEAM_TUNING, PALETTE, BUOY_LAYOUTS } from './config.js';

function len(x, y) { return Math.hypot(x, y); }

// Ray vs circle: returns the smallest positive t, or null.
function rayCircle(ox, oy, dx, dy, cx, cy, r, maxT) {
  const lx = cx - ox;
  const ly = cy - oy;
  const tca = lx * dx + ly * dy;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly - tca * tca;
  if (d2 > r * r) return null;
  const t = tca - Math.sqrt(Math.max(0, r * r - d2));
  if (t < 0 || t > maxT) return null;
  return t;
}

// Distance from point to segment, for beam damage tests.
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return len(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return len(px - (x1 + t * dx), py - (y1 + t * dy));
}

export class PrismBuoy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 26;
    this.phase = Math.random() * Math.PI * 2;
    this.flash = 0; // lights up when the beam kisses it
    this.spin = 0;
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.spin += dt * 0.6;
  }

  bobY(t) { return this.y + Math.sin(t * 1.3 + this.phase) * 5; }
}

export function createBuoys(reefIndex) {
  return BUOY_LAYOUTS[reefIndex % BUOY_LAYOUTS.length].map((p) => new PrismBuoy(p.x, p.y));
}

// Trace the beam. Returns { points, bounces, hitBuoys } where points[0] is the
// lantern and each later point is a reflection or the beam's end.
export function traceBeam(origin, dir, buoys, maxBounces, t) {
  const points = [{ x: origin.x, y: origin.y }];
  const hitBuoys = [];
  let px = origin.x;
  let py = origin.y;
  let dx = dir.x;
  let dy = dir.y;
  let remaining = BEAM_TUNING.maxLength;
  let lastBuoy = null;

  for (let seg = 0; seg <= maxBounces; seg++) {
    let best = null;
    for (const b of buoys) {
      if (b === lastBuoy) continue;
      const by = b.bobY(t);
      const hit = rayCircle(px, py, dx, dy, b.x, by, b.radius, remaining);
      if (hit !== null && (best === null || hit < best.t)) best = { t: hit, buoy: b, by };
    }
    // Arena edge: the beam fades out at the world bounds.
    let tEdge = remaining;
    if (dx > 0) tEdge = Math.min(tEdge, (WORLD.w - px) / dx);
    if (dx < 0) tEdge = Math.min(tEdge, (0 - px) / dx);
    if (dy > 0) tEdge = Math.min(tEdge, (WORLD.h - py) / dy);
    if (dy < 0) tEdge = Math.min(tEdge, (0 - py) / dy);
    tEdge = Math.max(0, tEdge);

    if (best && best.t <= tEdge) {
      const hx = px + dx * best.t;
      const hy = py + dy * best.t;
      points.push({ x: hx, y: hy });
      hitBuoys.push(best.buoy);
      // Reflect the direction about the surface normal at the hit point.
      let nx = hx - best.buoy.x;
      let ny = hy - best.by;
      const nl = len(nx, ny) || 1;
      nx /= nl; ny /= nl;
      const dot = dx * nx + dy * ny;
      dx = dx - 2 * dot * nx;
      dy = dy - 2 * dot * ny;
      const dl = len(dx, dy) || 1;
      dx /= dl; dy /= dl;
      px = hx + dx * 3;
      py = hy + dy * 3;
      remaining -= best.t;
      lastBuoy = best.buoy;
      if (remaining <= 0) break;
    } else {
      points.push({ x: px + dx * tEdge, y: py + dy * tEdge });
      break;
    }
  }
  return { points, bounces: hitBuoys.length, hitBuoys };
}

// Pick the most photogenic beam direction: most reflections, longest path,
// most creatures in the way. Used by the title-screen demo beam and by the
// maker's screenshot setups so the starlance always bends beautifully.
export function findBestBeamDir(origin, buoys, maxBounces, t, targets = []) {
  let best = null;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const trace = traceBeam(origin, dir, buoys, maxBounces, t);
    let score = trace.bounces * 30;
    let length = 0;
    for (let s = 0; s < trace.points.length - 1; s++) {
      length += Math.hypot(trace.points[s + 1].x - trace.points[s].x, trace.points[s + 1].y - trace.points[s].y);
    }
    score += Math.min(length, 1500) / 150;
    // Reward a real bend at each prism: a reflection that retraces its own
    // path reads as one straight line, a bent one reads as prism surfing.
    for (let s = 1; s < trace.points.length - 1; s++) {
      const inX = trace.points[s].x - trace.points[s - 1].x;
      const inY = trace.points[s].y - trace.points[s - 1].y;
      const outX = trace.points[s + 1].x - trace.points[s].x;
      const outY = trace.points[s + 1].y - trace.points[s].y;
      const il = Math.hypot(inX, inY) || 1;
      const ol = Math.hypot(outX, outY) || 1;
      const dot = Math.abs((inX * outX + inY * outY) / (il * ol));
      score += (1 - dot) * 22;
      score += Math.min(ol, 400) / 40; // and a reflected segment with somewhere to go
    }
    // Hitting something matters most of all — especially after a reflection.
    for (const tg of targets) {
      for (let s = 0; s < trace.points.length - 1; s++) {
        if (distToSegment(tg.x, tg.y, trace.points[s].x, trace.points[s].y, trace.points[s + 1].x, trace.points[s + 1].y) < tg.radius + 30) {
          score += 60 + (s >= 1 ? 40 : 0);
          break;
        }
      }
    }
    if (dir.y < 0) score += 2; // prefer skyward beams for composition
    if (!best || score > best.score) best = { dir, score, trace };
  }
  return best;
}

// A wobbling polyline for one beam segment: energy shimmer, not a dead line.
function wobblePoints(a, b, t, seed) {
  const out = [];
  const segs = 7;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = len(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  for (let i = 0; i <= segs; i++) {
    const f = i / segs;
    const wob = Math.sin(t * 26 + seed * 3.1 + f * 9) * 2.4 * Math.sin(f * Math.PI);
    out.push({ x: a.x + dx * f + nx * wob, y: a.y + dy * f + ny * wob });
  }
  return out;
}

function strokeThrough(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

export function drawBeam(ctx, trace, width, t, colorShift) {
  const pts = trace.points;
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const passes = [
    { w: width * 3.1, color: colorShift ? PALETTE.beamAlt : PALETTE.beamGlow, alpha: 0.13 },
    { w: width * 1.7, color: PALETTE.beamMid, alpha: 0.38 },
    { w: width * 0.8, color: PALETTE.beamCore, alpha: 0.95 },
  ];
  for (const pass of passes) {
    ctx.globalAlpha = pass.alpha;
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = pass.w;
    for (let s = 0; s < pts.length - 1; s++) {
      strokeThrough(ctx, wobblePoints(pts[s], pts[s + 1], t, s));
    }
  }
  // Reflection bursts: bright stars where the beam kisses a prism.
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const r = 13 + Math.sin(t * 9 + i) * 2.5;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.3, 'rgba(253,230,138,0.55)');
    g.addColorStop(1, 'rgba(253,230,138,0)');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    drawStar(ctx, p.x, p.y, r, 4, 0.45);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawStar(ctx, x, y, r, points = 4, inner = 0.45) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// The buoys themselves: floating crystal prisms on a ripple ring.
export function drawBuoy(ctx, buoy, t) {
  const y = buoy.bobY(t);
  const pulse = 1 + buoy.flash * 0.5 + Math.sin(t * 2 + buoy.phase) * 0.06;
  ctx.save();
  ctx.translate(buoy.x, y);
  // Ripple ring on the water.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 30, 34, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Glow.
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 52 * pulse);
  g.addColorStop(0, `rgba(165, 243, 252, ${0.5 + buoy.flash * 0.4})`);
  g.addColorStop(1, 'rgba(165, 243, 252, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 52 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Crystal: rotating diamond with facets.
  ctx.rotate(Math.sin(buoy.spin) * 0.16);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = 1;
  const grad = ctx.createLinearGradient(0, -26, 0, 26);
  grad.addColorStop(0, '#ecfeff');
  grad.addColorStop(0.45, '#67e8f9');
  grad.addColorStop(1, '#0e7490');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(15, 0);
  ctx.lineTo(0, 26);
  ctx.lineTo(-15, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(0, 26);
  ctx.moveTo(-15, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
