# Sunvale

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/EdwardusBenny/Make-Fun-1/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/EdwardusBenny/Make-Fun-1/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry in make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty.


An original open-world crime game set in **Sunvale**, a sun-soaked coastal city, made for the
make.fun "Make GTA 6" bounty. It runs in desktop Chrome from the static files in `game/`
(open `game/index.html` through any static server), with three.js vendored and every model,
texture, sky, sound and song generated in code.

Cass Moreno is home after four years upstate. Her uncle Teo runs a bait shop on the Saltmarsh
Docks, Lena Park runs a garage in Mercado, and developer Victor Krane is buying up the Coral Strand
with help from Rico Salas and his Tiburones. Six story missions (delivery, chase, getaway, hit,
finale), a street race, a gun shop, a paint shop that loses the cops, and 12 hidden Sun Tokens.

* Districts: Neon Row (towers), Coral Strand (pastel beach hotels), Mercado, Palm Heights (villas),
  Saltmarsh Docks, Sunvale Beach and Starwheel Pier with its Ferris wheel.
* Steal and drive eight invented vehicles, with traffic that obeys working signals and pedestrians who flee.
* Fists, the Kestrel 9 pistol and the Wasp SMG; a 0–5 star wanted level with cruisers, officers and a helicopter.
* HUD with a rotating minimap and GPS route, full city map (M), three procedural radio stations (Q).
* Save/continue in localStorage.

## Controls
WASD move/drive · mouse look · Shift sprint · Space jump/handbrake · F enter/steal/exit · left click
punch/shoot · right click aim · 1–3 or wheel weapons · E shops/race · Q radio · H horn · C look back ·
M map · Esc/P pause.

## Development
* `node serve.ts` serves `game/` on http://localhost:8080.
* `node tools/capture.cjs` renders the scenes in `shots.json` (`?shot=cover|chase|combat|map|title&seed=1`) into `screenshots/`.
* `node tools/logictest.cjs` plays through the story and systems headlessly.
* `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` builds the hand-in.

Source layout: `game/src/city` (plan, roads, buildings, props, landmarks, sky, sea, collision),
`actors` (people, player, pedestrians, enemies), `vehicles` (models, physics, traffic), `combat`,
`police`, `missions` (story, steps, activities, pickups, markers), `ui` (HUD, minimap, map, menus),
`audio` (effects and radio), `fx` (particles, tracers).

MIT licensed (see LICENSE). three.js is MIT licensed by its authors (`game/vendor/three.LICENSE.txt`).
