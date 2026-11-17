// Tuning, palette, reef and night definitions for Lumen Drift.
// One place for every number a designer would tweak.

export const WORLD = { w: 1280, h: 720 };
export const SEA_Y = 556; // where the glowing sea begins

export const PALETTE = {
  skyTop: '#1a2560',
  skyMid: '#2b3a93',
  skyHorizon: '#4a63c4',
  seaDeep: '#0e3a55',
  seaMid: '#146c84',
  seaGlow: '#2dd4bf',
  seaSpark: '#a7f3d0',
  gold: '#fcd34d',
  starlight: '#fde68a',
  cream: '#fef3c7',
  ink: '#0b1035',
  beamCore: '#ffffff',
  beamMid: '#fde68a',
  beamGlow: '#67e8f9',
  beamAlt: '#f0abfc',
  jelly: '#c4b5fd',
  jellyCore: '#8b5cf6',
  darter: '#fda4af',
  darterCore: '#f43f5e',
  shooter: '#f0abfc',
  shooterCore: '#d946ef',
  weaver: '#99f6e4',
  weaverCore: '#14b8a6',
  voidOrb: '#e879f9',
  bossSkin: '#e8ecf7',
  bossCrater: '#8b93b8',
  bossGlow: '#c084fc',
  danger: '#fb7185',
  good: '#4ade80',
  panel: 'rgba(9, 13, 46, 0.78)',
  panelEdge: 'rgba(103, 232, 249, 0.45)',
};

export const PLAYER_TUNING = {
  radius: 17,
  speed: 315,
  accel: 2400,
  friction: 5.2,
  maxHearts: 5,
  dashTime: 0.17,
  dashSpeed: 980,
  dashCooldown: 1.5,
  invulnTime: 1.25,
  lightMax: 100,
  lightDrain: 26, // per second while the beam fires
  lightRegen: 24, // per second while resting
  lightRefire: 30, // energy needed to restart a sputtered beam
  magnetRadius: 90,
};

export const BEAM_TUNING = {
  maxLength: 1500,
  baseBounces: 2,
  baseWidth: 9,
  baseDps: 34,
  tickEvery: 0.1,
  reflectBonus: 0.55, // extra damage per reflection segment
  chainWindow: 5, // seconds a prism chain stays alive
};

export const COMBO_TUNING = {
  window: 4.5, // seconds before the combo meter drains
  shardsPerStep: 5, // shards to raise the multiplier one step
  maxMultiplier: 8,
};

// The voyage: 8 nights across 3 reefs. Each night lists what the tide brings.
export const REEFS = [
  { name: 'THE SHALLOW GLEAM', nights: [1, 2, 3], flavor: 'calm water, curious jellies, kind light', water: '#146c84', glow: '#2dd4bf' },
  { name: 'THE DROWNED CHOIR', nights: [4, 5, 6], flavor: 'the choir sings backwards here — keep moving', water: '#3b2d7a', glow: '#a78bfa' },
  { name: 'THE HOLLOW DEEP', nights: [7, 8], flavor: 'dark water, old light, something vast asleep', water: '#1c2450', glow: '#67e8f9' },
];

export const NIGHTS = [
  { night: 1, jelly: 5, darter: 0, shooter: 0, weaver: 0, spawnGap: 1.15 },
  { night: 2, jelly: 6, darter: 2, shooter: 0, weaver: 0, spawnGap: 1.05 },
  { night: 3, jelly: 5, darter: 3, shooter: 1, weaver: 0, spawnGap: 0.95 },
  { night: 4, jelly: 4, darter: 2, shooter: 3, weaver: 0, spawnGap: 0.9 },
  { night: 5, jelly: 3, darter: 3, shooter: 3, weaver: 2, spawnGap: 0.85 },
  { night: 6, jelly: 4, darter: 4, shooter: 3, weaver: 3, spawnGap: 0.8 },
  { night: 7, jelly: 4, darter: 4, shooter: 4, weaver: 4, spawnGap: 0.75 },
  { night: 8, jelly: 0, darter: 0, shooter: 0, weaver: 0, boss: true, spawnGap: 1.0 },
];

export const ENEMY_DEFS = {
  jelly: { name: 'Gloom Jelly', hp: 14, speed: 62, radius: 22, score: 50, color: PALETTE.jelly, core: PALETTE.jellyCore, contact: 1 },
  darter: { name: 'Rift Darter', hp: 10, speed: 96, radius: 16, score: 60, color: PALETTE.darter, core: PALETTE.darterCore, contact: 1 },
  shooter: { name: 'Hollow Spitter', hp: 20, speed: 52, radius: 20, score: 80, color: PALETTE.shooter, core: PALETTE.shooterCore, contact: 1 },
  weaver: { name: 'Choir Weaver', hp: 26, speed: 58, radius: 22, score: 110, color: PALETTE.weaver, core: PALETTE.weaverCore, contact: 1 },
};

export const BOSS_DEF = {
  name: 'THE HOLLOW MOON',
  hp: 950,
  radius: 92,
  score: 2500,
  phases: [
    'phase 1 of 3 · the tide answers slowly',
    'phase 2 of 3 · the moon remembers every light it ate',
    'phase 3 of 3 · hollow fury — the dark between stars',
  ],
};

// Prism buoy layouts, one per reef. Buoys bend the starlance beam.
export const BUOY_LAYOUTS = [
  [ // reef 1 — open triangle pair, easy first chains
    { x: 330, y: 300 }, { x: 950, y: 300 }, { x: 640, y: 180 }, { x: 640, y: 470 },
  ],
  [ // reef 2 — diamond, longer diagonals
    { x: 240, y: 210 }, { x: 1040, y: 210 }, { x: 240, y: 480 }, { x: 1040, y: 480 }, { x: 640, y: 330 },
  ],
  [ // reef 3 — wide ring for boss-night geometry
    { x: 200, y: 300 }, { x: 480, y: 160 }, { x: 800, y: 160 }, { x: 1080, y: 300 }, { x: 640, y: 490 },
  ],
];

export function reefForNight(night) {
  if (night <= 3) return 0;
  if (night <= 6) return 1;
  return 2;
}

export function gradeForMultiplier(m) {
  if (m >= 8) return 'S';
  if (m >= 6) return 'A';
  if (m >= 4) return 'B';
  if (m >= 2) return 'C';
  return 'D';
}
