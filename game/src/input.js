// Keyboard + mouse state, translated into game coordinates (1280x720).
// The game polls this once per frame; "just pressed" keys are consumed.

import { WORLD } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: WORLD.w / 2, y: WORLD.h / 2 - 120, down: false };
    this.clicks = []; // queued {x, y} in game coordinates
    this.wheel = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    const toGame = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * WORLD.w,
        y: ((e.clientY - r.top) / r.height) * WORLD.h,
      };
    };
    canvas.addEventListener('mousemove', (e) => {
      const p = toGame(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const p = toGame(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = true;
      this.clicks.push({ x: p.x, y: p.y });
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }

  wasPressed(code) { return this.pressed.has(code); }

  // Normalized WASD / arrow movement vector.
  axis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  firing() { return this.mouse.down || this.down('Space'); }

  consumeClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  endFrame() { this.pressed.clear(); }
}
