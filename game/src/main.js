// Lumen Drift — the game itself. Owns the state machine (title, playing,
// relic choice, victory, game over), the loop, beam combat, scoring, combo,
// screen shake and the screenshot hooks the maker uses to capture the game.

import { WORLD, PLAYER_TUNING, BEAM_TUNING, COMBO_TUNING, REEFS, reefForNight, ENEMY_DEFS, BOSS_DEF, SPIRE, REEF_LIGHT_MAX, REEF_LIGHT_NIGHT_BONUS, REEF_LIGHT_LANTERN_BONUS, REEF_LIGHT_ORB_DRAIN, NIGHT_DURATIONS, ENDLESS_NIGHT_DURATION, LANTERN_LAYOUTS } from './config.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { Background } from './background.js';
import { traceBeam, drawBeam, drawBuoy, createBuoys, distToSegment, findBestBeamDir, PrismBuoy } from './beam.js';
import { Player, Enemy, Boss, Shard, EnemyBullet, WildLantern, drawSpire } from './entities.js';
import { NightDirector } from './waves.js';
import { rollRelics, RELIC_POOL } from './relics.js';
import {
  drawTopBar, drawIncomingPanel, drawRelicsPanel, drawReefMap, drawMinimap, drawHints, drawComboGauge,
  drawDashPip, drawBanner, drawTitleScreen, drawRelicChoice, drawVictory,
  drawGameOver, drawPause, titleLayout, relicLayout, victoryLayout,
  gameOverLayout, soundChipRect, pointIn,
} from './hud.js';

const BEST_KEY = 'lumen-drift-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.background = new Background();
    this.particles = new Particles();
    this.player = new Player();
    this.director = new NightDirector();
    this.state = 'title';
    this.paused = false;
    this.t = 0;
    this.night = 1;
    this.endless = false;
    this.clearedReefs = new Set();
    this.enemies = [];
    this.bullets = [];
    this.shards = [];
    this.boss = null;
    this.buoys = createBuoys(0);
    this.spire = { x: SPIRE.x, y: SPIRE.y, radius: SPIRE.radius, flash: 0 };
    this.reefLight = REEF_LIGHT_MAX;
    this.reefLightMax = REEF_LIGHT_MAX;
    this.lanterns = [];
    this.lanternsLit = 0;
    this.dawnLeft = Infinity;
    this.dawnRushing = false;
    this.dawnAnnounced = false;
    this.gameOverReason = null;
    this.relics = [];
    this.relicChoices = [];
    this.emberGuard = false;
    this.score = 0;
    this.best = this.loadBest();
    this.starlight = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.comboShards = 0;
    this.comboTimer = 0;
    this.comboWindow = COMBO_TUNING.window;
    this.multiplier = 1;
    this.maxMultiplier = 1;
    this.banner = null;
    this.shake = 0;
    this.hitFlash = 0;
    this.bossDeathT = 0;
    this.fireworkTimer = 0;
    this.tipTimer = 0;
    this.tipEvalTimer = 0;
    this.tip = 'bend the beam through prisms — reflected light hits harder';
    this.beamTrace = null;
    this.beamOn = false;
    this.shotAim = null; // screenshot mode: fixed aim point
    this.shotMode = null; // 'combat' | 'boss': re-aims the beam at live targets
    this.shotReaim = 0;
    // Title-screen demo buoys live in the left third, so the demo beam never
    // crosses the title text or the SET SAIL button.
    this.titleBuoys = [new PrismBuoy(150, 430), new PrismBuoy(330, 300), new PrismBuoy(190, 190)];
    this.titleAimBuoy = 0;
    this.titleJellies = [];
    for (let i = 0; i < 6; i++) {
      this.titleJellies.push(new Enemy('jelly', 120 + Math.random() * 1040, 150 + Math.random() * 380));
    }
    this.titleTarget = { x: 640, y: 300 };
    this.titleAimAngle = -Math.PI / 2;
    this.titleAimTarget = -Math.PI / 2;
    this.titleAimTimer = 0;
    this.moteTimer = 0;

    // Audio unlocks on the first gesture, as browsers require.
    const unlock = () => { this.sound.ensure(); this.sound.startAmbient(); };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });

    this.setupShot(new URLSearchParams(location.search).get('shot'));
  }

  loadBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (err) { return 0; }
  }

  saveBest() {
    try { localStorage.setItem(BEST_KEY, String(this.best)); } catch (err) { /* ignore */ }
  }

  // ------------------------------------------------------------ state flow ---

  startGame() {
    this.player.reset();
    this.enemies = [];
    this.bullets = [];
    this.shards = [];
    this.boss = null;
    this.relics = [];
    this.emberGuard = false;
    this.score = 0;
    this.starlight = 0;
    this.chain = 0;
    this.comboShards = 0;
    this.multiplier = 1;
    this.maxMultiplier = 1;
    this.night = 1;
    this.endless = false;
    this.bossDeathT = 0;
    this.state = 'playing';
    this.paused = false;
    this.reefLight = REEF_LIGHT_MAX;
    this.lanternsLit = 0;
    this.gameOverReason = null;
    this.clearedReefs = new Set();
    this.startNight(1);
  }

  startNight(n) {
    this.night = n;
    const reef = reefForNight(Math.min(n, 8));
    this.background.setReef(reef);
    this.buoys = createBuoys(reef);
    this.lanterns = LANTERN_LAYOUTS[reef].map((p) => new WildLantern(p.x, p.y));
    this.spire.flash = 0;
    if (this.emberGuard) this.player.shield = true;
    this.director.startNight(n, this);
    // Dawn clock: boss nights have no dawn — the moon itself is the clock.
    this.dawnLeft = this.director.isBossNight ? Infinity
      : (n <= 8 ? NIGHT_DURATIONS[n - 1] : ENDLESS_NIGHT_DURATION);
    this.dawnRushing = false;
    this.dawnAnnounced = false;
    const reefName = REEFS[reef].name;
    if (this.director.isBossNight) {
      this.showBanner('THE HOLLOW MOON WAKES', `${reefName} · night ${n} — bend every beam you have`, '#f0abfc');
      this.sound.bossRoar();
    } else {
      this.showBanner(`NIGHT ${n} — ${reefName}`, REEFS[reef].flavor, '#fef3c7');
    }
  }

  // A night clears when the field is clear AND (on non-boss nights) dawn has
  // broken and every dark prism is lit.
  nightClearReady() {
    if (this.director.isBossNight) return true;
    if (this.dawnLeft > 0) return false;
    return this.buoys.filter((b) => b.prism).every((b) => b.lit);
  }

  drainSpire(amount, x, y) {
    if (this.state !== 'playing') return;
    this.reefLight = Math.max(0, this.reefLight - amount);
    this.spire.flash = 1;
    this.shake = Math.max(this.shake, 7);
    this.particles.burst(this.spire.x, this.spire.y - 40, {
      colors: ['#f87171', '#fcd34d', '#fef3c7'], count: 18, speed: 200, life: 0.6,
    });
    this.particles.text(this.spire.x, this.spire.y - 96, `-${amount} REEF LIGHT`, '#f87171', 15);
    this.sound.playerHit();
    if (this.reefLight <= 0) this.beginGameOver('spire');
  }

  onNightCleared() {
    this.sound.waveClear();
    this.beamOn = false;
    this.beamTrace = null;
    this.sound.setBeamHum(false);
    // Dawn restores the spire, and the reef just sailed is marked clear.
    this.reefLight = Math.min(this.reefLightMax, this.reefLight + REEF_LIGHT_NIGHT_BONUS);
    this.clearedReefs.add(reefForNight(Math.min(this.night, 8)));
    if (this.night >= 8 && !this.endless) {
      this.beginVictory();
      return;
    }
    this.relicChoices = rollRelics(3, this.relics.map((r) => r.id));
    this.state = 'relic';
    this.showBanner(`NIGHT ${this.night} CLEARED`, 'choose a relic', '#4ade80');
  }

  chooseRelic(i) {
    const relic = this.relicChoices[i];
    if (!relic) return;
    relic.apply(this.player, this);
    this.relics.push(relic);
    this.sound.relic();
    this.particles.burst(this.player.x, this.player.y - 20, {
      colors: ['#fcd34d', '#fef3c7', relic.color], count: 30, speed: 240, life: 0.8,
    });
    this.state = 'playing';
    this.startNight(this.night + 1);
  }

  beginVictory() {
    this.state = 'victory';
    this.beamOn = false;
    this.beamTrace = null;
    this.sound.win();
    this.sound.setBeamHum(false);
    if (this.score > this.best) { this.best = this.score; this.saveBest(); }
    this.fireworkTimer = 0;
  }

  beginEndless() {
    this.endless = true;
    this.state = 'playing';
    this.player.hearts = Math.min(this.player.maxHearts, this.player.hearts + 2);
    this.startNight(9);
  }

  beginGameOver(reason = 'hull') {
    this.gameOverReason = reason;
    this.state = 'gameover';
    this.beamOn = false;
    this.beamTrace = null;
    this.sound.lose();
    this.sound.setBeamHum(false);
    if (this.score > this.best) { this.best = this.score; this.saveBest(); }
    this.particles.burst(this.player.x, this.player.y, {
      colors: ['#fb7185', '#fda4af', '#fcd34d'], count: 46, speed: 340, life: 1.1,
    });
  }

  showBanner(main, sub, color) {
    this.banner = { main, sub, color, age: 0, life: 2.6 };
  }

  // -------------------------------------------------------------- spawning ---

  spawnEnemy(type, x, y) {
    const hpScale = this.endless ? 1 + (this.night - 8) * 0.12 : 1;
    this.enemies.push(new Enemy(type, x, y, hpScale));
  }

  spawnBoss() {
    this.boss = new Boss();
    if (this.endless) {
      const scale = 1 + (this.night - 8) * 0.25;
      this.boss.hp = BOSS_DEF.hp * scale;
      this.boss.maxHp = this.boss.hp;
    }
  }

  spawnEnemyBullet(x, y, dx, dy, speed) {
    this.bullets.push(new EnemyBullet(x, y, dx * speed, dy * speed));
  }

  // ---------------------------------------------------------------- combat ---

  damageEnemy(e, amount, segmentIndex, hx, hy) {
    e.hp -= amount;
    e.flash = 1;
    const reflected = segmentIndex >= 1;
    const mult = reflected ? 1 + BEAM_TUNING.reflectBonus * segmentIndex * this.player.upgrades.chain : 1;
    const dealt = Math.max(1, Math.round(amount * mult));
    this.particles.text(hx, hy - 10, `${dealt}`, reflected ? '#fde68a' : '#e0f2fe', reflected ? 19 : 15);
    if (e.hp <= 0 && !e.dead) this.killEnemy(e, reflected);
  }

  killEnemy(e, reflected) {
    e.dead = true;
    const def = e.def || BOSS_DEF;
    const gained = Math.round(def.score * this.multiplier * (reflected ? 1 + 0.25 * this.chain : 1));
    this.score += gained;
    this.particles.text(e.x, e.y - 26, `+${gained}`, '#fcd34d', 17);
    this.particles.burst(e.x, e.y, {
      colors: [e.def ? e.def.color : '#e9d5ff', e.def ? e.def.core : '#c084fc', '#fef3c7'],
      count: e === this.boss ? 60 : 22, speed: e === this.boss ? 420 : 280, life: 0.8,
    });
    this.particles.ring(e.x, e.y, e.def ? e.def.color : '#e9d5ff', e === this.boss ? 200 : 70);
    this.sound.enemyDie();
    if (reflected) {
      this.chain += 1;
      this.chainTimer = BEAM_TUNING.chainWindow;
      if (this.chain >= 3) {
        this.showBanner(`PRISM CHAIN ×${this.chain}!`, 'reflected light feeds the chain', '#67e8f9');
      }
    }
    // Starlight shards spill out.
    const shards = e === this.boss ? 14 : 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < shards; i++) this.shards.push(new Shard(e.x, e.y));
    if (e === this.boss) {
      this.bossDeathT = 1.5;
      this.shake = 22;
      this.sound.bossRoar();
    } else {
      this.shake = Math.min(14, this.shake + 4);
    }
  }

  // The advice line, in priority order: danger first, then the objective,
  // then the craft, then a slow rotation of general tips.
  contextTip() {
    const p = this.player;
    if (this.boss && !this.boss.dead) return 'sink the Hollow Moon — bend every beam you have';
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.x - this.spire.x, e.y - this.spire.y) < 170) {
        return 'an enemy nears the spire — cut it off!';
      }
    }
    if (this.reefLight < 30) return 'the spire is fading — light wild lanterns to feed it!';
    if (!this.director.isBossNight && this.dawnLeft <= 0) {
      const unlit = this.buoys.filter((b) => b.prism && !b.lit).length;
      if (unlit > 0) return 'dawn is here — light the dark prisms to open the way!';
    }
    if (!this.director.isBossNight && this.buoys.some((b) => b.prism && !b.lit)) {
      const lit = this.buoys.filter((b) => b.prism && b.lit).length;
      if (lit === 0) return 'bend the beam through dark prisms to light them';
    }
    if (p.beamSputtered) return 'the lantern sputters — ease off and let it breathe';
    if (this.chain >= 3) return 'reflected light feeds the chain — keep bending!';
    if (this.tipTimer > 7) {
      this.tipTimer = 0;
      const tips = [
        'bend the beam through prisms — reflected light hits harder',
        'the beam burns void orbs out of the sky',
        'dash through danger — you cannot be hurt mid-dash',
        'starlight raises your combo — spend it before it fades',
        'prism buoys drift with the tide — use the angles',
        'wild lanterns feed the spire when the beam lights them',
      ];
      return tips[(Math.random() * tips.length) | 0];
    }
    return this.tip;
  }

  damagePlayer() {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'playing') return;
    if (p.shield) {
      p.shield = false;
      p.invuln = 1.0;
      this.particles.ring(p.x, p.y, '#67e8f9', 90);
      this.showBanner('EMBER GUARD HOLDS', 'the ward is spent — it returns next night', '#67e8f9');
      this.sound.prismPing(2);
      return;
    }
    p.hearts -= 1;
    p.invuln = PLAYER_TUNING.invulnTime;
    this.hitFlash = 0.55;
    this.shake = 16;
    this.sound.playerHit();
    this.particles.burst(p.x, p.y, { colors: ['#fb7185', '#fecdd3'], count: 24, speed: 300, life: 0.7 });
    if (p.hearts <= 0) this.beginGameOver();
  }

  fireBeam(dt) {
    const p = this.player;
    const origin = p.lanternPos();
    const aim = this.shotAim || this.input.mouse;
    const dx = aim.x - origin.x;
    const dy = aim.y - origin.y;
    const dl = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / dl, y: dy / dl };
    const maxBounces = BEAM_TUNING.baseBounces + p.upgrades.bounces;
    const trace = traceBeam(origin, dir, this.buoys, maxBounces, this.t);
    this.beamTrace = trace;

    // Prism kisses: light the buoys and sing. A dark objective prism wakes
    // permanently when the beam kisses it; lighting them all opens the way.
    let newKisses = 0;
    let prismLitNow = false;
    for (const b of trace.hitBuoys) {
      if (b.flash <= 0.1) newKisses++;
      b.flash = 1;
      if (b.prism && !b.lit) {
        b.lit = true;
        prismLitNow = true;
        this.score += 40 * this.multiplier;
        this.particles.text(b.x, b.y - 30, 'PRISM LIT', '#fcd34d', 16);
        this.particles.burst(b.x, b.y, { colors: ['#fcd34d', '#fef3c7', '#67e8f9'], count: 22, speed: 220, life: 0.6 });
      }
    }
    if (newKisses > 0) this.sound.prismPing(trace.bounces);
    if (prismLitNow) {
      const prisms = this.buoys.filter((b) => b.prism);
      if (prisms.length > 0 && prisms.every((b) => b.lit)) {
        this.showBanner('THE WAY IS OPEN', 'every prism burns — hold the sea until dawn', '#fcd34d');
        this.sound.relic();
      }
    }

    // Wild lanterns catch the beam and light: they feed the spire.
    for (const l of this.lanterns) {
      if (l.lit) continue;
      for (let s = 0; s < trace.points.length - 1; s++) {
        if (distToSegment(l.x, l.y, trace.points[s].x, trace.points[s].y, trace.points[s + 1].x, trace.points[s + 1].y) < l.radius) {
          l.lit = true;
          l.flash = 1;
          this.lanternsLit++;
          this.reefLight = Math.min(this.reefLightMax, this.reefLight + REEF_LIGHT_LANTERN_BONUS);
          this.starlight += 2;
          this.score += 25 * this.multiplier;
          this.particles.text(l.x, l.y - 30, 'LANTERN LIT', '#fcd34d', 16);
          this.particles.burst(l.x, l.y, { colors: ['#fcd34d', '#fef3c7', '#f59e0b'], count: 20, speed: 200, life: 0.7 });
          this.sound.shard();
          break;
        }
      }
    }

    const width = BEAM_TUNING.baseWidth * p.upgrades.width;
    const dps = BEAM_TUNING.baseDps * p.upgrades.damage;
    const damageTarget = (target, isBoss) => {
      let bestSeg = -1;
      for (let s = 0; s < trace.points.length - 1; s++) {
        const d = distToSegment(target.x, target.y, trace.points[s].x, trace.points[s].y, trace.points[s + 1].x, trace.points[s + 1].y);
        if (d < target.radius + width / 2) { bestSeg = s; break; }
      }
      if (bestSeg >= 0) {
        target.beamAcc = (target.beamAcc || 0) + dps * dt;
        if (target.beamAcc >= dps * BEAM_TUNING.tickEvery) {
          const amt = target.beamAcc;
          target.beamAcc = 0;
          const hx = target.x + (Math.random() - 0.5) * target.radius;
          const hy = target.y + (Math.random() - 0.5) * target.radius;
          this.damageEnemy(target, amt, bestSeg, hx, hy);
          this.particles.spray(hx, hy, Math.atan2(dy, dx) + Math.PI, {
            colors: ['#fef3c7', '#fde68a', '#67e8f9'], count: 3, speed: 200, life: 0.35, size: 3,
          });
        }
      }
    };
    for (const e of this.enemies) if (!e.dead) damageTarget(e, false);
    if (this.boss && !this.boss.dead) damageTarget(this.boss, true);

    // The beam burns void orbs out of the sky.
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (let s = 0; s < trace.points.length - 1; s++) {
        if (distToSegment(b.x, b.y, trace.points[s].x, trace.points[s].y, trace.points[s + 1].x, trace.points[s + 1].y) < width / 2 + b.radius) {
          b.dead = true;
          this.particles.burst(b.x, b.y, { colors: ['#f0abfc', '#fef3c7'], count: 8, speed: 160, life: 0.4, size: 3 });
          break;
        }
      }
    }
    // Impact sparks at the beam's end.
    const end = trace.points[trace.points.length - 1];
    if (Math.random() < 0.5) {
      this.particles.spray(end.x, end.y, Math.atan2(-dy, -dx), {
        colors: ['#fef3c7', '#67e8f9'], count: 2, speed: 140, life: 0.3, size: 2.5,
      });
    }
  }

  // ---------------------------------------------------------------- update ---

  update(dt) {
    this.t += dt;
    this.background.update(dt);
    this.particles.update(dt);
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age > this.banner.life) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - dt * 34);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 1.6);

    // Global keys.
    if (this.input.wasPressed('KeyM')) {
      const muted = this.sound.toggleMute();
      this.tip = muted ? 'sound off · press M to hear the sea again' : 'sound on · the sea sings';
    }

    if (this.state === 'title') { this.updateTitle(dt); return; }
    if (this.state === 'relic') { this.updateRelic(dt); return; }
    if (this.state === 'victory') { this.updateVictory(dt); return; }
    if (this.state === 'gameover') { this.updateGameOver(dt); return; }

    // Playing.
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      this.paused = !this.paused;
      this.sound.setBeamHum(false);
    }
    if (this.paused) return;

    const p = this.player;
    const input = this.input;

    // Dash.
    if (this.input.wasPressed('ShiftLeft') || this.input.wasPressed('ShiftRight')) {
      const ax = input.axis();
      let dir = ax.x !== 0 || ax.y !== 0 ? ax : { x: Math.cos(p.aimAngle), y: Math.sin(p.aimAngle) };
      const l = Math.hypot(dir.x, dir.y) || 1;
      dir = { x: dir.x / l, y: dir.y / l };
      if (p.startDash(dir)) {
        this.sound.dash();
        this.particles.spray(p.x, p.y, Math.atan2(-dir.y, -dir.x), {
          colors: ['#67e8f9', '#a5f3fc'], count: 12, speed: 260, life: 0.4, size: 3,
        });
      }
    }

    p.update(dt, input, this.t);
    for (const b of this.buoys) b.update(dt);
    for (const l of this.lanterns) l.update(dt);
    this.spire.flash = Math.max(0, this.spire.flash - dt * 2);
    // The skiff cannot sail through the spire's stone.
    {
      const dx = p.x - this.spire.x;
      const dy = p.y - this.spire.y;
      const d = Math.hypot(dx, dy);
      const min = SPIRE.collide + p.radius;
      if (d > 0 && d < min) {
        p.x = this.spire.x + (dx / d) * min;
        p.y = this.spire.y + (dy / d) * min;
      }
    }

    // Dawn clock: the night ends when dawn breaks, the field is clear and
    // the prisms burn. Dawn hurries once the sea is clear and lit.
    if (!this.director.isBossNight && this.dawnLeft > 0) {
      const fieldClear = this.director.queue.length === 0 && this.enemies.length === 0 && (!this.boss || this.boss.dead);
      const prismsDone = this.buoys.filter((b) => b.prism).every((b) => b.lit);
      this.dawnRushing = fieldClear && prismsDone;
      this.dawnLeft = Math.max(0, this.dawnLeft - dt * (this.dawnRushing ? 4 : 1));
      if (this.dawnLeft === 0 && !this.dawnAnnounced) {
        this.dawnAnnounced = true;
        if (!fieldClear) this.showBanner('DAWN BREAKS', 'clear the rest of the tide', '#fcd34d');
        else if (!prismsDone) this.showBanner('DAWN BREAKS', 'light the dark prisms to open the way', '#fcd34d');
        else this.showBanner('DAWN BREAKS', 'the night is yours', '#4ade80');
      }
    }

    // Screenshot mode: keep the beam bent toward whatever is alive right now.
    if (this.shotMode) {
      this.shotReaim -= dt;
      if (this.shotReaim <= 0) {
        this.shotReaim = 0.5;
        const targets = [...this.enemies];
        if (this.boss && !this.boss.dead) targets.push(this.boss);
        const origin = p.lanternPos();
        const best = findBestBeamDir(origin, this.buoys, 2 + p.upgrades.bounces, this.t, targets);
        this.shotAim = { x: origin.x + best.dir.x * 500, y: origin.y + best.dir.y * 500 };
      }
    }

    // Beam energy + firing.
    const wantFire = input.firing() || this.shotAim !== null;
    if (p.light <= 0) p.beamSputtered = true;
    if (p.beamSputtered && p.light >= PLAYER_TUNING.lightRefire * p.upgrades.lightCap) p.beamSputtered = false;
    this.beamOn = wantFire && !p.beamSputtered && p.light > 0;
    if (this.beamOn) {
      p.light = Math.max(0, p.light - PLAYER_TUNING.lightDrain * dt);
      this.fireBeam(dt);
      this.sound.setBeamHum(true);
    } else {
      this.beamTrace = null;
      p.light = Math.min(p.lightMax, p.light + PLAYER_TUNING.lightRegen * dt);
      this.sound.setBeamHum(false);
    }

    // Enemies, boss, bullets, shards.
    const stub = this;
    for (const e of this.enemies) e.update(dt, p, stub);
    if (this.boss && !this.boss.dead) this.boss.update(dt, p, stub);
    for (const b of this.bullets) b.update(dt);
    for (const s of this.shards) s.update(dt, p, PLAYER_TUNING.magnetRadius * p.upgrades.magnet);
    this.director.update(dt, this);

    // Gentle separation so creatures never stack into one blob.
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius - 6;
        if (d > 0 && d < min) {
          const push = (min - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }

    // Collisions: contact + orbs vs the skiff.
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius - 4) {
        this.damagePlayer();
        // Knock the creature back so one touch is one hit.
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.x += Math.cos(a) * 30;
        e.y += Math.sin(a) * 30;
      }
    }
    // The tide against the spire: a creature that reaches the light spends
    // itself to drain it.
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.x - this.spire.x, e.y - this.spire.y) < this.spire.radius + e.radius - 8) {
        e.dead = true;
        this.drainSpire(e.def.drain, e.x, e.y);
      }
    }
    if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < this.boss.radius + p.radius - 10) {
      this.damagePlayer();
    }
    for (const b of this.bullets) {
      if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius - 4) {
        b.dead = true;
        this.damagePlayer();
      }
      if (!b.dead && Math.hypot(b.x - this.spire.x, b.y - this.spire.y) < this.spire.radius + b.radius) {
        b.dead = true;
        this.drainSpire(REEF_LIGHT_ORB_DRAIN, b.x, b.y);
      }
    }

    // Shard pickups.
    for (const s of this.shards) {
      if (!s.dead && Math.hypot(s.x - p.x, s.y - p.y) < 26) {
        s.dead = true;
        this.starlight += 1;
        this.comboShards += 1;
        this.comboTimer = this.comboWindow;
        const gained = 10 * this.multiplier;
        this.score += gained;
        this.sound.shard();
        this.particles.burst(s.x, s.y, { colors: ['#fde68a', '#fef3c7'], count: 6, speed: 120, life: 0.4, size: 3 });
      }
    }

    // Combo + chain decay.
    const newMult = Math.min(COMBO_TUNING.maxMultiplier, 1 + Math.floor(this.comboShards / COMBO_TUNING.shardsPerStep));
    if (newMult !== this.multiplier) {
      this.multiplier = newMult;
      this.maxMultiplier = Math.max(this.maxMultiplier, newMult);
      if (newMult > 1) this.particles.text(p.x, p.y - 46, `COMBO ×${newMult}`, '#fcd34d', 20);
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.comboShards = 0; this.multiplier = 1; }
    }
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }

    // Boss death cinematic.
    if (this.bossDeathT > 0) {
      this.bossDeathT -= dt;
      if (this.boss && Math.random() < 0.6) {
        this.particles.burst(
          this.boss.x + (Math.random() - 0.5) * 140,
          this.boss.y + (Math.random() - 0.5) * 140,
          { colors: ['#e9d5ff', '#f0abfc', '#fef3c7'], count: 12, speed: 300, life: 0.7 },
        );
      }
      this.shake = Math.max(this.shake, 8);
    }

    // Ambient sea motes.
    this.moteTimer -= dt;
    if (this.moteTimer <= 0) {
      this.moteTimer = 0.25;
      this.particles.mote(Math.random() * WORLD.w, 560 + Math.random() * 140, '#5eead4');
    }

    // Contextual guidance: the line under the arena reads the situation and
    // advises, falling back to a slow rotation of general tips.
    this.tipEvalTimer -= dt;
    if (this.tipEvalTimer <= 0) {
      this.tipEvalTimer = 0.5;
      this.tip = this.contextTip();
    }
    this.tipTimer += dt;

    // Screenshot mode: keep the lantern full and the banner crisp on screen.
    // (Held at mid-life: the banner fades in from age 0 and out at the end,
    // so mid-life is where it reads at full opacity.)
    if (this.shotMode) {
      p.light = p.lightMax;
      if (this.banner) {
        this.banner.age = this.banner.life * 0.4;
      } else if (this.shotMode === 'boss') {
        this.showBanner('THE HOLLOW MOON WAKES', 'the Hollow Deep · night 8 — bend every beam you have', '#f0abfc');
      } else {
        this.showBanner('PRISM CHAIN ×3', 'reflected light — the tide is breaking', '#67e8f9');
      }
    }

    // Sweep the dead.
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.shards = this.shards.filter((s) => !s.dead);
    if (this.boss && this.boss.dead && this.bossDeathT <= 0 && this.director.active) {
      // Director notices the cleared night on its next pass.
    }

    // Sound chip click.
    for (const c of this.input.consumeClicks()) {
      if (pointIn(c, soundChipRect())) {
        const muted = this.sound.toggleMute();
        this.tip = muted ? 'sound off' : 'sound on';
      }
    }
  }

  updateTitle(dt) {
    // The title screen is alive: drifting jellies, a sweeping demo beam.
    this.titleTarget.x = 640 + Math.sin(this.t * 0.2) * 300;
    this.titleTarget.y = 300 + Math.cos(this.t * 0.16) * 90;
    const stub = { spawnEnemyBullet() {} };
    for (const j of this.titleJellies) j.update(dt, this.titleTarget, stub);
    for (const b of this.titleBuoys) b.update(dt);
    this.moteTimer -= dt;
    if (this.moteTimer <= 0) {
      this.moteTimer = 0.3;
      this.particles.mote(Math.random() * WORLD.w, 560 + Math.random() * 140, '#5eead4');
    }
    // Demo beam: retargets every few seconds, cycling the demo buoys, easing
    // between targets. The aim prefers traces that stay in the left third,
    // so the beam never crosses the title text or the SET SAIL button.
    const p = this.player;
    p.x = 210;
    p.y = WORLD.h - 120;
    p.drawScale = 1.6;
    p.bobPhase += dt * 2.2;
    const origin = p.lanternPos();
    this.titleAimTimer -= dt;
    if (this.titleAimTimer <= 0) {
      this.titleAimTimer = 2.6;
      let chosen = null;
      for (let k = 0; k < 3; k++) {
        const b = this.titleBuoys[(this.titleAimBuoy + k) % 3];
        const ang = Math.atan2(b.bobY(this.t) - origin.y, b.x - origin.x) + (Math.random() - 0.5) * 0.08;
        const cand = traceBeam(origin, { x: Math.cos(ang), y: Math.sin(ang) }, this.titleBuoys, 2, this.t);
        if (k === 0) chosen = ang;
        if (cand.points.every((pt) => pt.x <= 470 && pt.y >= 130 && pt.y <= 600)) {
          chosen = ang;
          this.titleAimBuoy = (this.titleAimBuoy + k + 1) % 3;
          break;
        }
      }
      this.titleAimTarget = chosen;
    }
    let diff = this.titleAimTarget - this.titleAimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.titleAimAngle += diff * Math.min(1, dt * 2.2);
    const trace = traceBeam(origin, { x: Math.cos(this.titleAimAngle), y: Math.sin(this.titleAimAngle) }, this.titleBuoys, 2, this.t);
    this.beamTrace = trace;
    for (const b of trace.hitBuoys) b.flash = 1;
    if (Math.random() < 0.1) {
      const pt = trace.points[(Math.random() * trace.points.length) | 0];
      this.particles.mote(pt.x, pt.y, '#fde68a');
    }
    const start = titleLayout().start;
    if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      this.sound.uiClick();
      this.startGame();
      return;
    }
    for (const c of this.input.consumeClicks()) {
      if (pointIn(c, start)) {
        this.sound.uiClick();
        this.startGame();
        return;
      }
    }
  }

  updateRelic(dt) {
    for (const b of this.buoys) b.update(dt);
    if (this.input.wasPressed('Digit1')) this.chooseRelic(0);
    else if (this.input.wasPressed('Digit2')) this.chooseRelic(1);
    else if (this.input.wasPressed('Digit3')) this.chooseRelic(2);
    const rects = relicLayout();
    for (const c of this.input.consumeClicks()) {
      for (let i = 0; i < rects.length; i++) {
        if (pointIn(c, rects[i])) { this.chooseRelic(i); return; }
      }
    }
  }

  updateVictory(dt) {
    this.fireworkTimer -= dt;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = 0.38;
      const colors = [['#fcd34d', '#fef3c7'], ['#67e8f9', '#a5f3fc'], ['#f0abfc', '#e9d5ff']];
      for (let k = 0; k < 2; k++) {
        const pick = colors[(Math.random() * colors.length) | 0];
        const fx = 160 + Math.random() * 960;
        const fy = 110 + Math.random() * 220;
        this.particles.burst(fx, fy, { colors: pick, count: 26, speed: 280, life: 1.15 });
        this.particles.ring(fx, fy, pick[0], 70, 0.7);
      }
    }
    const layout = victoryLayout();
    if (this.input.wasPressed('Enter')) { this.sound.uiClick(); this.beginEndless(); return; }
    if (this.input.wasPressed('KeyR')) { this.sound.uiClick(); this.startGame(); return; }
    for (const c of this.input.consumeClicks()) {
      if (pointIn(c, layout.endless)) { this.sound.uiClick(); this.beginEndless(); return; }
      if (pointIn(c, layout.again)) { this.sound.uiClick(); this.startGame(); return; }
    }
  }

  updateGameOver(dt) {
    const layout = gameOverLayout();
    if (this.input.wasPressed('Enter')) { this.sound.uiClick(); this.startGame(); return; }
    if (this.input.wasPressed('KeyT')) { this.sound.uiClick(); this.state = 'title'; return; }
    for (const c of this.input.consumeClicks()) {
      if (pointIn(c, layout.retry)) { this.sound.uiClick(); this.startGame(); return; }
      if (pointIn(c, layout.title)) { this.sound.uiClick(); this.state = 'title'; return; }
    }
  }

  // ------------------------------------------------------------------ draw ---

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, WORLD.w, WORLD.h);
    // Screen shake applies to the world, never the HUD.
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.background.draw(ctx);
    const shownBuoys = this.state === 'title' ? this.titleBuoys : this.buoys;
    for (const b of shownBuoys) drawBuoy(ctx, b, this.t);
    // The spire anchors the arena, not the title card: behind the title
    // panel its ring would peek out as a stray circle.
    if (this.state !== 'title') {
      drawSpire(ctx, this.spire, this.reefLight / this.reefLightMax, this.t);
      for (const l of this.lanterns) l.draw(ctx, this.t);
    }

    if (this.state === 'title') {
      for (const j of this.titleJellies) j.draw(ctx, this.t);
      this.player.draw(ctx, this.t);
      // The demo beam is clipped to the left third: it can never cross the
      // title text or the SET SAIL button, whatever angle it takes.
      if (this.beamTrace) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 130, 470, 460);
        ctx.clip();
        drawBeam(ctx, this.beamTrace, 9, this.t, false);
        ctx.restore();
      }
      this.particles.draw(ctx);
      ctx.restore();
      drawTitleScreen(ctx, this, this.t, this.input.mouse);
      return;
    }

    for (const s of this.shards) s.draw(ctx);
    for (const b of this.bullets) b.draw(ctx, this.t);
    for (const e of this.enemies) e.draw(ctx, this.t);
    if (this.boss && !this.boss.dead) this.boss.draw(ctx, this.t);
    if (this.state !== 'gameover') this.player.draw(ctx, this.t);

    // The starlance beam, above the actors.
    if (this.beamTrace && this.beamOn) {
      drawBeam(ctx, this.beamTrace, 9 * this.player.upgrades.width, this.t, this.chain >= 3);
    }
    // Aim preview: a faint dotted line while the beam rests.
    if (this.state === 'playing' && !this.beamOn && !this.paused) {
      const origin = this.player.lanternPos();
      const m = this.input.mouse;
      const dx = m.x - origin.x;
      const dy = m.y - origin.y;
      const dl = Math.hypot(dx, dy) || 1;
      ctx.save();
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(origin.x + (dx / dl) * 130, origin.y + (dy / dl) * 130);
      ctx.stroke();
      ctx.restore();
    }
    this.particles.draw(ctx);
    ctx.restore();

    // Hit flash vignette.
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hitFlash * 0.5;
      const g = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, 220, WORLD.w / 2, WORLD.h / 2, 640);
      g.addColorStop(0, 'rgba(244, 63, 94, 0)');
      g.addColorStop(1, 'rgba(244, 63, 94, 0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
      ctx.restore();
    }

    if (this.state === 'playing' || this.state === 'relic' || this.paused) {
      drawTopBar(ctx, this);
      drawIncomingPanel(ctx, this);
      drawReefMap(ctx, this);
      drawRelicsPanel(ctx, this);
      drawMinimap(ctx, this);
      drawHints(ctx, this.sound.muted);
      drawComboGauge(ctx, this);
      drawDashPip(ctx, this, this.tip);
      drawBanner(ctx, this.banner);
    }
    if (this.state === 'relic') drawRelicChoice(ctx, this, this.input.mouse);
    if (this.state === 'victory') {
      drawTopBar(ctx, this);
      drawVictory(ctx, this, this.input.mouse);
    }
    if (this.state === 'gameover') {
      drawTopBar(ctx, this);
      drawGameOver(ctx, this, this.input.mouse);
    }
    if (this.paused && this.state === 'playing') drawPause(ctx);
  }

  frame(dt) {
    this.update(dt);
    this.draw();
    this.input.endFrame();
  }

  // ------------------------------------------------------- screenshot hooks ---
  // ?shot=title|combat|boss|victory|gameover — the maker reaches a real game
  // state through the game's own functions, then captures the render.
  setupShot(shot) {
    if (!shot) return;
    if (shot === 'combat') {
      this.startGame();
      this.night = 4;
      this.startNight(4);
      this.director.queue = [];
      this.dawnLeft = 84;
      this.reefLight = 78;
      // Two prisms already lit, two still dark — the objective reads at once.
      if (this.buoys[0]) this.buoys[0].lit = true;
      if (this.buoys[1]) this.buoys[1].lit = true;
      if (this.lanterns[0]) this.lanterns[0].lit = true;
      if (this.lanterns[1]) this.lanterns[1].lit = true;
      this.lanternsLit = 2;
      const spots = [
        ['jelly', 300, 220], ['jelly', 420, 320], ['jelly', 880, 240], ['jelly', 1010, 380],
        ['darter', 240, 420], ['darter', 1060, 300], ['shooter', 200, 200], ['shooter', 1080, 470],
        ['weaver', 640, 200], ['jelly', 760, 430], ['darter', 560, 260], ['shooter', 760, 560],
      ];
      for (const [type, x, y] of spots) this.spawnEnemy(type, x, y);
      // One slow jelly drifting toward the spire: the warning tip fires and
      // the stakes read in a single frame.
      this.spawnEnemy('jelly', 700, 470);
      const near = this.enemies[this.enemies.length - 1];
      near.targetSpire = true;
      near.speed = 18;
      // Buff the capture-state creatures so the beam does not clear the
      // frame before the screenshot lands; game balance is untouched.
      for (const e of this.enemies) { e.hp *= 3; e.maxHp *= 3; }
      this.player.upgrades.bounces = 1;
      this.player.upgrades.width = 1.3;
      this.player.upgrades.damage = 1.35;
      this.player.x = 640;
      this.player.y = 480;
      this.score = 12480;
      this.starlight = 47;
      this.comboShards = 18;
      this.comboTimer = this.comboWindow;
      this.chain = 3;
      this.chainTimer = BEAM_TUNING.chainWindow;
      this.relics = RELIC_POOL.filter((r) => ['prism-hand', 'sunlit-wick', 'star-magnet'].includes(r.id));
      this.shotMode = 'combat';
      this.shotReaim = 0;
      this.shotAim = { x: 950, y: 300 };
      this.particles.burst(880, 240, { colors: ['#c4b5fd', '#8b5cf6', '#fef3c7'], count: 24, speed: 280, life: 0.8 });
      this.particles.burst(300, 220, { colors: ['#fda4af', '#f43f5e', '#fef3c7'], count: 20, speed: 260, life: 0.7 });
      this.showBanner('PRISM CHAIN ×3!', 'reflected light feeds the chain', '#67e8f9');
    } else if (shot === 'boss') {
      this.startGame();
      this.startNight(8);
      this.director.queue = [];
      this.reefLight = 64;
      for (const b of this.buoys) b.lit = true;
      if (this.lanterns[0]) this.lanterns[0].lit = true;
      this.lanternsLit = 1;
      if (this.boss) this.boss.hp = Math.round(this.boss.maxHp * 0.55);
      this.spawnEnemy('jelly', 300, 320);
      this.spawnEnemy('jelly', 980, 320);
      this.spawnEnemy('darter', 500, 430);
      this.spawnEnemy('weaver', 830, 460);
      this.spawnEnemy('shooter', 330, 470);
      for (const e of this.enemies) { e.hp *= 2; e.maxHp *= 2; }
      this.player.upgrades.bounces = 1;
      this.player.upgrades.width = 1.45;
      this.player.upgrades.damage = 1.7;
      this.player.x = 640;
      this.player.y = 560;
      this.score = 34200;
      this.starlight = 120;
      this.comboShards = 26;
      this.comboTimer = this.comboWindow;
      this.chain = 5;
      this.chainTimer = BEAM_TUNING.chainWindow;
      this.relics = RELIC_POOL.filter((r) => ['prism-hand', 'sunlit-wick', 'wide-aperture', 'ember-guard'].includes(r.id));
      this.shotMode = 'boss';
      this.shotReaim = 0;
      this.shotAim = { x: 640, y: 210 };
      this.showBanner('THE HOLLOW MOON WAKES', 'the final night — bend every beam you have', '#f0abfc');
    } else if (shot === 'victory') {
      this.startGame();
      this.score = 48230;
      this.starlight = 214;
      this.maxMultiplier = 7;
      this.night = 8;
      this.dawnLeft = 0;
      this.reefLight = this.reefLightMax;
      this.lanternsLit = 9;
      for (const b of this.buoys) b.lit = true;
      this.clearedReefs = new Set([0, 1, 2]);
      this.background.setReef(2);
      this.relics = RELIC_POOL.filter((r) => ['prism-hand', 'sunlit-wick', 'wide-aperture', 'star-magnet', 'chain-lens'].includes(r.id));
      this.beginVictory();
    } else if (shot === 'gameover') {
      this.startGame();
      this.night = 6;
      this.score = 18940;
      this.starlight = 96;
      this.maxMultiplier = 4;
      this.dawnLeft = 23;
      this.reefLight = 41;
      if (this.buoys[0]) this.buoys[0].lit = true;
      this.player.hearts = 0;
      this.beginGameOver();
    }
  }
}

// ------------------------------------------------------------------ boot ---

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__gameReady = true;
