// SUNVALE — Salt & Neon: hand-in program for the make.fun "Make GTA 6" bounty (gta6-01).
//
// The game itself lives in game/: static files a desktop browser opens offline from
// game/index.html (ES modules under game/src, stylesheets under game/css, and three.js r176's
// minified module build vendored in game/vendor, wired up with one import map). Everything you
// see in Sunvale (the city, cars, people, textures, sky, music) is generated in code at load time.
//
// This program (Node 22, standard library only) copies game/ and screenshots/ from beside this
// file into the output directory and writes dossier.json there with the vendored make.fun library,
// which summarises the entry for the judge.
//
// Play locally:   node serve.ts            then open http://localhost:8080
// Screenshots:    node tools/capture.cjs   (with the server running; scenes are listed in shots.json)
// Hand in:        mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   (the grader uses /output)

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Sunvale ships exactly four screenshots: the cover drive, the police chase, the pier shoot-out and the title screen over the sunset city.
const shots = existsSync(join(here, 'screenshots')) ? readdirSync(join(here, 'screenshots')).filter((f) => /\.(jpe?g|png)$/i.test(f)) : [];
if (shots.length < 3 || shots.length > 4) console.warn(`expected 3 or 4 screenshots, found ${shots.length}`);

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
console.log(`Sunvale handed in to ${out}: game/, ${shots.length} screenshots and dossier.json`);
