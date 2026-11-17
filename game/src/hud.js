// Every screen the player reads: the dense in-game HUD, the title screen,
// the relic choice, victory, game over and pause. One frame must tell the
// whole game: goal, danger, progress, controls and score.

import { WORLD, PALETTE, REEFS, reefForNight, BOSS_DEF, gradeForMultiplier, ENEMY_DEFS } from './config.js';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

export function panel(ctx, x, y, w, h, r = 10) {
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function text(ctx, str, x, y, { size = 16, color = '#fef3c7', align = 'left', weight = 700, alpha = 1, outline = true } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(5, 8, 31, 0.85)';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function heart(ctx, x, y, filled, size = 11) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? '#fb7185' : 'rgba(251, 113, 133, 0.25)';
  ctx.strokeStyle = filled ? '#fecdd3' : 'rgba(254, 205, 211, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.85);
  ctx.bezierCurveTo(-size * 1.3, -size * 0.1, -size * 0.7, -size, 0, -size * 0.35);
  ctx.bezierCurveTo(size * 0.7, -size, size * 1.3, -size * 0.1, 0, size * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, fill, back = 'rgba(5, 8, 31, 0.75)') {
  ctx.save();
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- top bar ---

export function drawTopBar(ctx, game) {
  const p = game.player;
  // Left: hull hearts + light meter.
  text(ctx, 'SKIFF', 18, 16, { size: 12, color: '#a5f3fc', weight: 800 });
  for (let i = 0; i < p.maxHearts; i++) heart(ctx, 30 + i * 24, 34, i < p.hearts);
  text(ctx, 'LIGHT', 18, 58, { size: 12, color: '#fde68a', weight: 800 });
  const lightFrac = p.light / p.lightMax;
  bar(ctx, 62, 50, 150, 13, lightFrac, p.beamSputtered ? '#f87171' : '#fcd34d');
  text(ctx, `${Math.ceil(p.light)} / ${Math.ceil(p.lightMax)}`, 220, 57, { size: 12, color: '#fef3c7' });

  // Center: night, reef, pips, boss bar, WIN/LOSE.
  const cx = WORLD.w / 2;
  const nightLabel = game.endless ? `ENDLESS NIGHT ${game.night}` : `NIGHT ${game.night} / 8`;
  text(ctx, nightLabel, cx, 20, { size: 24, color: '#fef3c7', align: 'center', weight: 800 });
  const reef = REEFS[reefForNight(Math.min(game.night, 8))];
  text(ctx, reef.name, cx, 40, { size: 12, color: '#a5f3fc', align: 'center', weight: 800 });
  // Progress pips.
  for (let i = 0; i < 8; i++) {
    const px = cx - 84 + i * 24;
    ctx.save();
    ctx.fillStyle = i < game.night - 1 ? '#fcd34d' : i === game.night - 1 ? '#fef3c7' : 'rgba(254,243,199,0.25)';
    ctx.beginPath();
    ctx.arc(px, 56, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (game.boss && !game.boss.dead) {
    const bw = 430;
    const bx = cx - bw / 2;
    text(ctx, BOSS_DEF.name, cx, 78, { size: 15, color: '#f0abfc', align: 'center', weight: 800 });
    bar(ctx, bx, 88, bw, 12, game.boss.hp / game.boss.maxHp, '#c084fc');
    text(ctx, BOSS_DEF.phases[game.boss.phase - 1], cx, 110, { size: 11, color: '#e9d5ff', align: 'center', weight: 600 });
  } else {
    // WIN / LOSE row.
    const wy = 78;
    ctx.save();
    ctx.font = `800 12px ${FONT}`;
    ctx.textBaseline = 'middle';
    const winStr = game.night >= 8 ? 'WIN  sink the Hollow Moon' : 'WIN  clear the night · survive to dawn';
    const loseStr = 'LOSE  hull reaches 0 hearts';
    ctx.textAlign = 'right';
    const ww = ctx.measureText(winStr).width + 18;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.beginPath();
    ctx.roundRect(cx - ww - 8, wy - 10, ww, 20, 10);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bbf7d0';
    ctx.fillText(winStr, cx - 17, wy);
    ctx.textAlign = 'left';
    const lw = ctx.measureText(loseStr).width + 18;
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.6)';
    ctx.beginPath();
    ctx.roundRect(cx + 8, wy - 10, lw, 20, 10);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fecdd3';
    ctx.fillText(loseStr, cx + 17, wy);
    ctx.restore();
  }

  // Right: chain, score, best, starlight.
  const rx = WORLD.w - 18;
  text(ctx, `CHAIN ×${game.chain}`, rx, 18, { size: 15, color: '#67e8f9', align: 'right', weight: 800 });
  text(ctx, 'SCORE', rx, 38, { size: 11, color: '#a5f3fc', align: 'right', weight: 800 });
  text(ctx, game.score.toLocaleString(), rx, 54, { size: 22, color: '#fef3c7', align: 'right', weight: 800 });
  text(ctx, `BEST ${game.best.toLocaleString()}`, rx, 72, { size: 11, color: '#cbd5e1', align: 'right' });
  text(ctx, `✦ ${game.starlight}`, rx, 90, { size: 14, color: '#fde68a', align: 'right', weight: 800 });
}

// ------------------------------------------------------------- side panels ---

export function drawIncomingPanel(ctx, game) {
  const x = 14;
  const y = 118;
  const w = 172;
  const counts = game.director.incomingCounts(game);
  const left = game.director.totalLeft(game);
  const rows = Object.keys(ENEMY_DEFS).filter((k) => counts[k] > 0);
  const h = 34 + rows.length * 24 + (game.boss && !game.boss.dead ? 26 : 0) + 76;
  panel(ctx, x, y, w, h);
  text(ctx, 'INCOMING', x + 12, y + 16, { size: 13, color: '#fef3c7', weight: 800 });
  text(ctx, `${left} LEFT`, x + w - 12, y + 16, { size: 12, color: '#67e8f9', align: 'right', weight: 800 });
  let ry = y + 40;
  if (game.boss && !game.boss.dead) {
    text(ctx, '●', x + 14, ry, { size: 14, color: '#e9d5ff' });
    text(ctx, 'Hollow Moon', x + 30, ry, { size: 13, color: '#f0abfc' });
    text(ctx, 'BOSS', x + w - 12, ry, { size: 12, color: '#f0abfc', align: 'right', weight: 800 });
    ry += 26;
  }
  for (const key of rows) {
    const def = ENEMY_DEFS[key];
    text(ctx, '●', x + 14, ry, { size: 14, color: def.color });
    text(ctx, def.name, x + 30, ry, { size: 13, color: '#e2e8f0' });
    text(ctx, `${counts[key]}`, x + w - 12, ry, { size: 13, color: '#fef3c7', align: 'right', weight: 800 });
    ry += 24;
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.3)';
  ctx.beginPath();
  ctx.moveTo(x + 12, ry + 2);
  ctx.lineTo(x + w - 12, ry + 2);
  ctx.stroke();
  ctx.restore();
  const next = game.night < 8
    ? `NEXT: Night ${game.night + 1} — ${REEFS[reefForNight(Math.min(game.night + 1, 8))].name.toLowerCase()}`
    : game.endless ? 'NEXT: the tide never ends' : 'NEXT: THE HOLLOW MOON';
  text(ctx, next, x + 12, ry + 18, { size: 11, color: '#a5f3fc', weight: 600 });
  const reef = REEFS[reefForNight(Math.min(game.night, 8))];
  wrapText(ctx, reef.flavor, x + 12, ry + 34, w - 24, 11, '#94a3b8');
}

export function drawRelicsPanel(ctx, game) {
  const x = WORLD.w - 186;
  const y = 118;
  const w = 172;
  const relics = game.relics;
  const h = 34 + Math.max(1, relics.length) * 24 + 8;
  panel(ctx, x, y, w, h);
  text(ctx, 'RELICS', x + 12, y + 16, { size: 13, color: '#fef3c7', weight: 800 });
  text(ctx, `${relics.length} HELD`, x + w - 12, y + 16, { size: 12, color: '#fcd34d', align: 'right', weight: 800 });
  if (relics.length === 0) {
    text(ctx, 'none yet —', x + 12, y + 40, { size: 12, color: '#94a3b8', weight: 600 });
    text(ctx, 'clear a night', x + 12, y + 58, { size: 12, color: '#94a3b8', weight: 600 });
    return;
  }
  let ry = y + 40;
  for (const r of relics) {
    text(ctx, r.glyph, x + 14, ry, { size: 14, color: r.color });
    text(ctx, r.name, x + 32, ry, { size: 13, color: '#e2e8f0' });
    ry += 24;
  }
}

function wrapText(ctx, str, x, y, maxW, size, color) {
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const words = str.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillStyle = color;
      ctx.fillText(line, x, ly);
      line = word;
      ly += 14;
    } else line = test;
  }
  ctx.fillStyle = color;
  ctx.fillText(line, x, ly);
  ctx.restore();
}

// ------------------------------------------------------------ bottom chrome ---

export const HINTS = [
  ['WASD', 'MOVE'],
  ['LMB', 'STARLANCE'],
  ['SHIFT', 'DASH'],
  ['P', 'PAUSE'],
  ['M', 'SOUND'],
];

export function hintChipRects() {
  const rects = [];
  let x = 14;
  const y = WORLD.h - 44;
  for (let i = 0; i < HINTS.length; i++) {
    const [key] = HINTS[i];
    const w = key.length * 9 + 62 + (i === HINTS.length - 1 ? 16 : 0);
    rects.push({ x, y, w, h: 30 });
    x += w + 8;
  }
  return rects;
}

export function soundChipRect() {
  // The last hint chip; clicking it toggles sound.
  return hintChipRects()[HINTS.length - 1];
}

export function drawHints(ctx, muted) {
  const rects = hintChipRects();
  ctx.save();
  ctx.textBaseline = 'middle';
  for (let i = 0; i < HINTS.length; i++) {
    const [key, label] = HINTS[i];
    const { x, y, w } = rects[i];
    ctx.fillStyle = 'rgba(9, 13, 46, 0.78)';
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 30, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = `800 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(key, x + 10, y + 15);
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(label, x + 10 + key.length * 9 + 8, y + 15);
    if (i === HINTS.length - 1) {
      ctx.fillStyle = muted ? '#f87171' : '#4ade80';
      ctx.beginPath();
      ctx.arc(x + w - 12, y + 15, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawComboGauge(ctx, game) {
  const w = 190;
  const x = WORLD.w - w - 14;
  const y = WORLD.h - 78;
  panel(ctx, x, y, w, 64);
  const m = game.multiplier;
  text(ctx, 'COMBO', x + 12, y + 14, { size: 11, color: '#a5f3fc', weight: 800 });
  text(ctx, `×${m}`, x + 12, y + 38, { size: 26, color: m >= 4 ? '#fcd34d' : '#fef3c7', weight: 800 });
  // Grade seal.
  const gx = x + w - 30;
  const gy = y + 28;
  ctx.save();
  ctx.fillStyle = m >= 6 ? '#fcd34d' : m >= 4 ? '#67e8f9' : 'rgba(148, 163, 184, 0.5)';
  ctx.beginPath();
  ctx.arc(gx, gy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, gradeForMultiplier(m), gx, gy + 1, { size: 20, color: '#0b1035', align: 'center', weight: 800, outline: false });
  ctx.restore();
  // Combo timer.
  bar(ctx, x + 66, y + 44, w - 100, 7, game.comboTimer / game.comboWindow, '#f472b6');
  text(ctx, `${game.comboShards} shards`, x + 66, y + 28, { size: 11, color: '#e9d5ff', weight: 600 });
}

export function drawDashPip(ctx, game, tip) {
  const cx = WORLD.w / 2;
  const y = WORLD.h - 30;
  const p = game.player;
  const ready = p.dashCd <= 0;
  const label = ready ? '◆ DASH READY' : `◆ dash ${p.dashCd.toFixed(1)}s`;
  ctx.save();
  ctx.globalAlpha = ready ? 1 : 0.6;
  ctx.fillStyle = 'rgba(9, 13, 46, 0.78)';
  ctx.strokeStyle = ready ? 'rgba(103, 232, 249, 0.6)' : 'rgba(103, 232, 249, 0.25)';
  ctx.beginPath();
  ctx.roundRect(cx - 82, y - 13, 164, 26, 13);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  text(ctx, label, cx, y, { size: 12, color: ready ? '#67e8f9' : '#94a3b8', align: 'center', weight: 800 });
  if (tip) text(ctx, tip, cx, y - 26, { size: 12, color: '#cbd5e1', align: 'center', weight: 600 });
}

export function drawBanner(ctx, banner) {
  if (!banner) return;
  const age = banner.age / banner.life;
  const alpha = age < 0.12 ? age / 0.12 : age > 0.75 ? (1 - age) / 0.25 : 1;
  const scale = age < 0.15 ? 0.8 + (age / 0.15) * 0.2 : 1;
  ctx.save();
  ctx.translate(WORLD.w / 2, 168);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.font = `800 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(5, 8, 31, 0.9)';
  ctx.strokeText(banner.main, 0, 0);
  ctx.fillStyle = banner.color || '#fef3c7';
  ctx.fillText(banner.main, 0, 0);
  if (banner.sub) {
    ctx.font = `700 16px ${FONT}`;
    ctx.lineWidth = 5;
    ctx.strokeText(banner.sub, 0, 32);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(banner.sub, 0, 32);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ menus ---

export function drawButton(ctx, rect, label, { hot = false, sub = null, disabled = false } = {}) {
  ctx.save();
  ctx.globalAlpha = disabled ? 0.45 : 1;
  ctx.fillStyle = hot ? 'rgba(252, 211, 77, 0.92)' : 'rgba(9, 13, 46, 0.85)';
  ctx.strokeStyle = hot ? '#fef3c7' : 'rgba(103, 232, 249, 0.55)';
  ctx.lineWidth = hot ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.stroke();
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 - (sub ? 8 : 0), {
    size: 19, color: hot ? '#0b1035' : '#fef3c7', align: 'center', weight: 800, outline: !hot,
  });
  if (sub) {
    text(ctx, sub, rect.x + rect.w / 2, rect.y + rect.h / 2 + 16, {
      size: 12, color: hot ? '#3b2f0b' : '#a5f3fc', align: 'center', weight: 600, outline: false,
    });
  }
  ctx.restore();
}

export function titleLayout() {
  return { start: { x: WORLD.w / 2 - 190, y: 512, w: 380, h: 56 } };
}

export function drawTitleScreen(ctx, game, t, mouse) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 31, 0.42)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.restore();
  const cx = WORLD.w / 2;
  // Title with layered glow.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 84px ${FONT}`;
  ctx.shadowColor = 'rgba(252, 211, 77, 0.8)';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#fef3c7';
  ctx.fillText('LUMEN DRIFT', cx, 128);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.5)';
  ctx.strokeText('LUMEN DRIFT', cx, 128);
  ctx.restore();
  text(ctx, 'a lantern voyage across the night sea', cx, 172, { size: 20, color: '#a5f3fc', align: 'center', weight: 600, outline: false });
  text(ctx, 'Surf the glow. Bend the beam. Outlast the dark.', cx, 198, { size: 15, color: '#e2e8f0', align: 'center', weight: 600 });

  // Reef chips.
  const reefs = ['I · THE SHALLOW GLEAM', 'II · THE DROWNED CHOIR', 'III · THE HOLLOW DEEP'];
  let rx = cx - 330;
  for (const r of reefs) {
    ctx.save();
    ctx.fillStyle = 'rgba(9, 13, 46, 0.8)';
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.4)';
    ctx.beginPath();
    ctx.roundRect(rx, 222, 212, 30, 15);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, r, rx + 106, 237, { size: 12, color: '#e2e8f0', align: 'center', weight: 800 });
    rx += 224;
  }

  // How it plays.
  panel(ctx, cx - 330, 272, 660, 128);
  text(ctx, 'HOW PRISM SURFING WORKS', cx, 292, { size: 13, color: '#fcd34d', align: 'center', weight: 800 });
  const lines = [
    'Hold LMB / SPACE — fire the starlance beam from your lantern.',
    'Bend it through PRISM BUOYS: reflected light hits harder and builds CHAIN.',
    'Gather ✦ starlight to raise your COMBO. Dash through danger with SHIFT.',
    'Survive 8 nights across 3 reefs — then sink THE HOLLOW MOON.',
  ];
  lines.forEach((line, i) => text(ctx, line, cx, 316 + i * 21, { size: 14, color: '#e2e8f0', align: 'center', weight: 600 }));

  // Goal + controls row.
  panel(ctx, cx - 330, 412, 660, 44);
  text(ctx, 'WIN  clear 8 nights      LOSE  hull reaches 0      MOVE  WASD      BEAM  LMB      DASH  SHIFT', cx, 434, { size: 13, color: '#fef3c7', align: 'center', weight: 700 });

  const layout = titleLayout();
  const hot = pointIn(mouse, layout.start) || Math.sin(t * 3) > 0;
  drawButton(ctx, layout.start, 'SET SAIL', { hot, sub: 'click or press ENTER' });
  text(ctx, `BEST  ${game.best.toLocaleString()}`, cx, 596, { size: 14, color: '#cbd5e1', align: 'center', weight: 700 });
  text(ctx, 'sound on recommended · M to mute · no downloads, no sign-up', cx, 620, { size: 12, color: '#94a3b8', align: 'center', weight: 600, outline: false });
}

export function relicLayout() {
  const w = 250;
  const h = 250;
  const gap = 30;
  const total = w * 3 + gap * 2;
  const x0 = (WORLD.w - total) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y: 250, w, h }));
}

export function drawRelicChoice(ctx, game, mouse) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 31, 0.66)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.restore();
  const cx = WORLD.w / 2;
  text(ctx, `NIGHT ${game.night} CLEARED`, cx, 118, { size: 22, color: '#67e8f9', align: 'center', weight: 800 });
  text(ctx, 'DAWN BREAKS — CHOOSE A RELIC', cx, 156, { size: 34, color: '#fef3c7', align: 'center', weight: 800 });
  text(ctx, 'one blessing for the voyage ahead · click a card or press 1 · 2 · 3', cx, 188, { size: 14, color: '#cbd5e1', align: 'center', weight: 600 });
  const rects = relicLayout();
  game.relicChoices.forEach((relic, i) => {
    const r = rects[i];
    const hot = pointIn(mouse, r);
    ctx.save();
    ctx.fillStyle = hot ? 'rgba(30, 41, 100, 0.95)' : 'rgba(9, 13, 46, 0.92)';
    ctx.strokeStyle = hot ? relic.color : 'rgba(103, 232, 249, 0.4)';
    ctx.lineWidth = hot ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, `[ ${i + 1} ]`, r.x + r.w / 2, r.y + 26, { size: 12, color: '#94a3b8', align: 'center', weight: 800 });
    text(ctx, relic.glyph, r.x + r.w / 2, r.y + 78, { size: 52, color: relic.color, align: 'center', weight: 800 });
    text(ctx, relic.name, r.x + r.w / 2, r.y + 132, { size: 19, color: '#fef3c7', align: 'center', weight: 800 });
    wrapTextCenter(ctx, relic.desc, r.x + 22, r.y + 166, r.w - 44, 14, '#cbd5e1');
  });
  text(ctx, `SCORE ${game.score.toLocaleString()}  ·  ✦ ${game.starlight}  ·  NEXT: NIGHT ${game.night + 1}`, cx, 540, { size: 14, color: '#e2e8f0', align: 'center', weight: 700 });
}

function wrapTextCenter(ctx, str, x, y, maxW, size, color) {
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  lines.push(line);
  lines.forEach((l, i) => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(5, 8, 31, 0.85)';
    ctx.strokeText(l, x + maxW / 2, y + i * 20);
    ctx.fillStyle = color;
    ctx.fillText(l, x + maxW / 2, y + i * 20);
  });
  ctx.restore();
}

export function victoryLayout() {
  return {
    endless: { x: WORLD.w / 2 - 330, y: 520, w: 310, h: 56 },
    again: { x: WORLD.w / 2 + 20, y: 520, w: 310, h: 56 },
  };
}

export function drawVictory(ctx, game, mouse) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 31, 0.55)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.restore();
  const cx = WORLD.w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 52px ${FONT}`;
  ctx.shadowColor = 'rgba(252, 211, 77, 0.9)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#fef3c7';
  ctx.fillText('DAWN BREAKS', cx, 130);
  ctx.restore();
  text(ctx, 'THE HOLLOW MOON SINKS · THE REEFS REMEMBER YOUR LIGHT', cx, 172, { size: 16, color: '#a5f3fc', align: 'center', weight: 800 });
  panel(ctx, cx - 300, 210, 600, 240);
  const stats = [
    ['FINAL SCORE', game.score.toLocaleString()],
    ['BEST', game.best.toLocaleString()],
    ['NIGHTS SURVIVED', `${game.night}`],
    ['STARLIGHT GATHERED', `✦ ${game.starlight}`],
    ['HIGHEST COMBO', `×${game.maxMultiplier}`],
    ['RELICS HELD', `${game.relics.length}`],
  ];
  stats.forEach(([label, value], i) => {
    const y = 238 + i * 34;
    text(ctx, label, cx - 268, y, { size: 14, color: '#94a3b8', weight: 800 });
    text(ctx, value, cx + 268, y, { size: 17, color: '#fef3c7', align: 'right', weight: 800 });
  });
  const layout = victoryLayout();
  drawButton(ctx, layout.endless, 'SAIL ON — ENDLESS', { hot: pointIn(mouse, layout.endless), sub: 'harder nights, forever' });
  drawButton(ctx, layout.again, 'PLAY AGAIN', { hot: pointIn(mouse, layout.again), sub: 'fresh voyage from night 1' });
  text(ctx, 'press ENTER for endless · R to restart', cx, 606, { size: 13, color: '#94a3b8', align: 'center', weight: 600, outline: false });
}

export function gameOverLayout() {
  return {
    retry: { x: WORLD.w / 2 - 330, y: 500, w: 310, h: 56 },
    title: { x: WORLD.w / 2 + 20, y: 500, w: 310, h: 56 },
  };
}

export function drawGameOver(ctx, game, mouse) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 31, 0.68)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.restore();
  const cx = WORLD.w / 2;
  text(ctx, 'THE LANTERN GOES DARK', cx, 150, { size: 48, color: '#fda4af', align: 'center', weight: 800 });
  text(ctx, `the void keeps night ${game.night} — but the tide brings every lantern home`, cx, 192, { size: 15, color: '#e2e8f0', align: 'center', weight: 600 });
  panel(ctx, cx - 300, 226, 600, 200);
  const stats = [
    ['SCORE', game.score.toLocaleString()],
    ['BEST', game.best.toLocaleString()],
    ['NIGHT REACHED', `${game.night} / 8`],
    ['STARLIGHT GATHERED', `✦ ${game.starlight}`],
    ['HIGHEST COMBO', `×${game.maxMultiplier}`],
  ];
  stats.forEach(([label, value], i) => {
    const y = 254 + i * 36;
    text(ctx, label, cx - 268, y, { size: 14, color: '#94a3b8', weight: 800 });
    text(ctx, value, cx + 268, y, { size: 17, color: '#fef3c7', align: 'right', weight: 800 });
  });
  const layout = gameOverLayout();
  drawButton(ctx, layout.retry, 'TRY AGAIN', { hot: pointIn(mouse, layout.retry), sub: 'press ENTER' });
  drawButton(ctx, layout.title, 'BACK TO TITLE', { hot: pointIn(mouse, layout.title), sub: 'press T' });
}

export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 31, 0.6)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.restore();
  text(ctx, 'BECALMED', WORLD.w / 2, 300, { size: 44, color: '#fef3c7', align: 'center', weight: 800 });
  text(ctx, 'press P or ESC to keep sailing', WORLD.w / 2, 344, { size: 16, color: '#a5f3fc', align: 'center', weight: 600 });
}

export function pointIn(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
