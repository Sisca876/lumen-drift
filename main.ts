// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// ---- Lumen Drift entrypoint, written for this entry ----
// Startup validation and inventory: the handoff must never silently ship an
// empty or broken game folder, so the entrypoint checks its own inputs and
// reports exactly what it is about to hand in before copying anything.
const GAME_TITLE = 'Lumen Drift';
const GAME_VERSION = '1.0.0';

function fail(message: string): never {
  console.error(`[lumen-drift] ERROR: ${message}`);
  process.exit(1);
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile()) found.push(full);
  }
  return found.sort();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

const gameDir = join(here, 'game');
if (!existsSync(gameDir)) fail(`game/ folder missing beside main.ts (looked in ${gameDir})`);
if (!existsSync(join(gameDir, 'index.html'))) {
  fail('game/index.html missing: the game has no playable entry file');
}

const gameFiles = walk(gameDir);
const gameInventory = gameFiles.map((file) => ({ path: relative(here, file), bytes: statSync(file).size }));
const gameTotalBytes = gameInventory.reduce((sum, file) => sum + file.bytes, 0);

const shotsDir = join(here, 'screenshots');
const shotInventory = existsSync(shotsDir)
  ? walk(shotsDir).map((file) => ({ path: relative(here, file), bytes: statSync(file).size }))
  : [];

console.log(`[lumen-drift] ${GAME_TITLE} v${GAME_VERSION} — handing in the game`);
console.log(`[lumen-drift] game files (${gameInventory.length}, ${formatBytes(gameTotalBytes)}):`);
for (const file of gameInventory) console.log(`[lumen-drift]   ${file.path} (${formatBytes(file.bytes)})`);
console.log(`[lumen-drift] screenshots (${shotInventory.length}):`);
for (const file of shotInventory) console.log(`[lumen-drift]   ${file.path} (${formatBytes(file.bytes)})`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// ---- Handoff summary: confirm what landed in the output directory ----
const dossierPath = join(out, 'dossier.json');
const dossierBytes = statSync(dossierPath).size;
console.log(`[lumen-drift] wrote ${dossierPath} (${formatBytes(dossierBytes)})`);
console.log(
  `[lumen-drift] OK: ${gameInventory.length} game files, ${shotInventory.length} screenshots, ` +
    `dossier ${formatBytes(dossierBytes)} -> ${out}`,
);
