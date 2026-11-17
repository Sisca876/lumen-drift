# lumen-drift
[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Sisca876/lumen-drift/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Sisca876/lumen-drift/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Lumen Drift** — a lantern voyage across the night sea. You are the keeper of
the last lantern, surfing a skiff over glowing water. Drag a ribbon of light,
bend your starlance beam through prism buoys, and chain reflections to burn the
void: reflected light hits harder, and every reflected kill feeds your CHAIN.
Gather starlight to raise your COMBO, dash through danger, and choose a relic
at each dawn. Survive **8 nights across 3 reefs** — the Shallow Gleam, the
Drowned Choir, the Hollow Deep — then sink **THE HOLLOW MOON** and sail on
into endless nights.

## How to play

- **WASD / arrows** — sail the skiff
- **Hold LMB / Space** — fire the starlance beam (drains LIGHT; it returns
  when you let go)
- **Aim through PRISM BUOYS** — the beam reflects, and reflected segments deal
  bonus damage and build CHAIN
- **Shift** — dash (briefly invulnerable, leaves afterimages)
- **1 / 2 / 3** — choose a relic at dawn · **P** — pause · **M** — mute

Win by clearing all 8 nights. Lose if your hull reaches 0 hearts. The beam
also burns enemy void orbs out of the sky.

## Run it

No build step, no network requests, no dependencies. Serve `game/` with any
static server and open `game/index.html` in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly from any static host. All art is drawn in
code and all sound is synthesized with WebAudio — the game ships zero assets.

## Structure

- `game/index.html` + `game/style.css` — page shell and stage
- `game/src/config.js` — tuning, palette, reefs, nights, buoy layouts
- `game/src/beam.js` — prism surfing: ray tracing, reflections, beam drawing
- `game/src/entities.js` — the skiff, void creatures, the Hollow Moon, shards
- `game/src/waves.js` — the Night Director: spawning and night flow
- `game/src/relics.js` — the 1-of-3 dawn relic choices
- `game/src/background.js` — starfield, nebula, animated glowing sea
- `game/src/particles.js` — explosions, rings, floating damage numbers
- `game/src/audio.js` — synthesized SFX and ambient pad (WebAudio)
- `game/src/hud.js` — HUD panels, title, relic, victory and game-over screens
- `game/src/input.js` — keyboard + mouse
- `game/src/main.js` — state machine, game loop, combat and scoring
- `main.ts` — hands the game in: copies `game/` + `screenshots/` and writes
  the dossier with the kit's vendored library

## Screenshots

Real renders of the game's own code, captured in headless Chrome:
`1-title.jpg` (title), `2-combat.jpg` (prism chain mid-battle),
`3-boss.jpg` (the Hollow Moon), `4-victory.jpg` (dawn breaks + restart).

## License

MIT — see [LICENSE](LICENSE).
