// The Night Director: what the tide brings each night, when it spawns,
// and when a night is cleared. Night 8 belongs to the Hollow Moon.

import { NIGHTS, WORLD } from './config.js';

const SPAWN_EDGES = ['top', 'left', 'right'];

export class NightDirector {
  constructor() {
    this.night = 0;
    this.queue = []; // { type, delay }
    this.spawnTimer = 0;
    this.active = false;
    this.cleared = false;
    this.bossSpawned = false;
    this.endless = false;
  }

  composition(night) {
    if (night <= 8) return NIGHTS[night - 1];
    // Endless nights: everything scales, and the moon returns every 4th night.
    const extra = night - 8;
    return {
      night,
      jelly: 4 + extra,
      darter: 3 + extra,
      shooter: 3 + Math.floor(extra / 2),
      weaver: 3 + Math.floor(extra / 2),
      boss: night % 4 === 0,
      spawnGap: Math.max(0.45, 0.75 - extra * 0.03),
    };
  }

  startNight(night, game) {
    this.night = night;
    const comp = this.composition(night);
    this.queue = [];
    const types = ['jelly', 'darter', 'shooter', 'weaver'];
    for (const type of types) {
      for (let i = 0; i < (comp[type] || 0); i++) this.queue.push(type);
    }
    // Shuffle, but keep the first two gentle.
    for (let i = this.queue.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * i);
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.spawnGap = comp.spawnGap;
    this.spawnTimer = 0.4;
    this.active = true;
    this.cleared = false;
    this.bossSpawned = false;
    this.isBossNight = !!comp.boss;
    if (this.isBossNight) {
      game.spawnBoss();
      this.bossSpawned = true;
    }
  }

  // How many of each creature are still owed (queued + alive).
  incomingCounts(game) {
    const counts = { jelly: 0, darter: 0, shooter: 0, weaver: 0 };
    for (const t of this.queue) counts[t]++;
    for (const e of game.enemies) counts[e.type]++;
    return counts;
  }

  totalLeft(game) {
    let n = this.queue.length + game.enemies.length;
    if (game.boss && !game.boss.dead) n += 1;
    return n;
  }

  update(dt, game) {
    if (!this.active) return;
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnGap;
        const type = this.queue.shift();
        const edge = SPAWN_EDGES[(Math.random() * SPAWN_EDGES.length) | 0];
        let x;
        let y;
        if (edge === 'top') { x = 60 + Math.random() * (WORLD.w - 120); y = 108; }
        else if (edge === 'left') { x = 40; y = 140 + Math.random() * (WORLD.h - 220); }
        else { x = WORLD.w - 40; y = 140 + Math.random() * (WORLD.h - 220); }
        game.spawnEnemy(type, x, y);
      }
    } else if (game.enemies.length === 0 && (!game.boss || game.boss.dead)) {
      this.active = false;
      this.cleared = true;
      game.onNightCleared();
    }
  }
}
