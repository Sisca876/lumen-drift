// Relics: the 1-of-3 choice between nights. Each relic is a permanent
// blessing for the voyage, shown in the right-hand RELICS panel while playing.

export const RELIC_POOL = [
  {
    id: 'prism-hand', name: 'Prism Hand', glyph: '✦', color: '#67e8f9',
    desc: 'The beam bends once more: +1 prism bounce.',
    apply: (p) => { p.upgrades.bounces += 1; },
  },
  {
    id: 'sunlit-wick', name: 'Sunlit Wick', glyph: '☀', color: '#fcd34d',
    desc: 'The lantern burns hotter: +35% beam damage.',
    apply: (p) => { p.upgrades.damage *= 1.35; },
  },
  {
    id: 'wide-aperture', name: 'Wide Aperture', glyph: '◎', color: '#f0abfc',
    desc: 'A broader starlance: +45% beam width.',
    apply: (p) => { p.upgrades.width *= 1.45; },
  },
  {
    id: 'fleetfoot', name: 'Fleetfoot Current', glyph: '≋', color: '#5eead4',
    desc: 'The tide carries you: +18% skiff speed.',
    apply: (p) => { p.upgrades.speed *= 1.18; },
  },
  {
    id: 'second-lantern', name: 'Second Lantern', glyph: '♥', color: '#fda4af',
    desc: '+1 max heart, and mend one heart now.',
    apply: (p) => { p.maxHearts += 1; p.hearts = Math.min(p.maxHearts, p.hearts + 1); },
  },
  {
    id: 'star-magnet', name: 'Star Magnet', glyph: '✧', color: '#fde68a',
    desc: 'Starlight finds you: +70% pickup radius.',
    apply: (p) => { p.upgrades.magnet *= 1.7; },
  },
  {
    id: 'quick-dash', name: 'Quicksilver Wake', glyph: '↯', color: '#a5f3fc',
    desc: 'Dash again sooner: −35% dash cooldown.',
    apply: (p) => { p.upgrades.dashCd *= 0.65; },
  },
  {
    id: 'ember-guard', name: 'Ember Guard', glyph: '⛨', color: '#93c5fd',
    desc: 'A ward of light: absorb one hit each night.',
    apply: (p, game) => { p.shield = true; game.emberGuard = true; },
  },
  {
    id: 'long-wick', name: 'Long Wick', glyph: '◉', color: '#fdba74',
    desc: 'A deeper well of light: +40% light capacity.',
    apply: (p) => { p.upgrades.lightCap *= 1.4; p.lightMax *= 1.4; p.light = p.lightMax; },
  },
  {
    id: 'chain-lens', name: 'Chain Lens', glyph: '⧉', color: '#c4b5fd',
    desc: 'Reflected light bites deeper: +60% chain bonus.',
    apply: (p) => { p.upgrades.chain *= 1.6; },
  },
];

export function rollRelics(count = 3, ownedIds = []) {
  const available = RELIC_POOL.filter((r) => !ownedIds.includes(r.id) || r.id === 'second-lantern');
  const pool = available.length >= count ? available : RELIC_POOL;
  const picks = [];
  const copy = [...pool];
  while (picks.length < count && copy.length > 0) {
    const i = (Math.random() * copy.length) | 0;
    picks.push(copy.splice(i, 1)[0]);
  }
  return picks;
}
