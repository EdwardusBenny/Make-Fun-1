// The story of SUNVALE: Cass Moreno is out after four years upstate. Her uncle Teo runs a bait
// shop on the docks; Lena Park runs a garage in Mercado. Developer Victor Krane is buying up the
// Coral Strand with help from the Tiburones beach gang and their boss Rico Salas.
// Six missions, each a list of steps, plus what each one pays and unlocks.
import { say, goTo, getVehicle, holdAt, raiseWanted, loseWanted, run, custom, wait } from './steps.js';
import { PLACES, PITCH, PIER, CITY_H, HALF_ROAD } from '../city/layout.js';
import { giveWeapon } from '../combat/weapons.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const MISSIONS = [
  {
    id: 'homecoming', title: 'Homecoming', contact: 'teo', reward: 500, auto: true,
    start: PLACES.start,
    steps: () => [
      say([
        ['teo', "Cass! You're out. Listen, mija — the bus don't run to the docks no more. Krane bought the route."],
        ['teo', 'Find yourself some wheels and come see me at the shop.'],
      ]),
      getVehicle(),
      goTo(PLACES.teo, "Drive to <b>Teo's Bait &amp; Tackle</b> in Saltmarsh Docks.", { radius: 3.5 }),
      say([
        ['teo', 'Look at you. Thinner. Meaner.'],
        ['cass', 'What happened to this town, Teo? Half the Strand is boarded up.'],
        ['teo', 'Victor Krane happened. He buys the buildings, the Tiburones collect his "rent" with baseball bats.'],
        ['teo', 'Take this — a Kestrel 9. For emergencies. Come back when you want real work.'],
      ]),
      run((ctx) => { giveWeapon(ctx.game.player.arsenal, 'pistol', 60); ctx.game.player.arsenal.current = 'pistol'; ctx.game.hud.help('You got the <b>Kestrel 9</b>. Hold <kbd>Right click</kbd> to aim, <kbd>Left click</kbd> to shoot, <kbd>1</kbd>-<kbd>3</kbd> to switch weapons.', 7); }),
    ],
  },
  {
    id: 'bait', title: 'Bait & Switch', contact: 'teo', reward: 1500, requires: ['homecoming'],
    steps: () => [
      say([
        ['teo', "A courier in Neon Row is holding a cooler for me. It ain't fish."],
        ['teo', "Pick it up and run it to the Starwheel Pier gate. The buyer won't wait long."],
      ]),
      goTo(PLACES.courier, 'Pick up the cooler from the <b>courier</b> in Neon Row.', { vehicle: true, radius: 3.5 }),
      say([['Courier', "Cooler's in your trunk. Buyer leaves in ninety seconds — move!"]], { blocking: true }),
      goTo(PLACES.pierGate, 'Deliver the cooler to the <b>Starwheel Pier gate</b>.', { vehicle: true, radius: 4, timer: 95 }),
      say([
        ['teo', "Good. That buyer is a cop's cousin. Now he owes me, and so does his cousin."],
        ['teo', 'Lena Park wants to meet you. She runs a garage in Mercado. Fixes cars... and takes them back.'],
      ]),
    ],
  },
  {
    id: 'repo', title: 'Repo Season', contact: 'lena', reward: 2500, requires: ['bait'],
    steps: () => [
      say([
        ['lena', "So you're Teo's niece. I fix cars. I also repossess them."],
        ['lena', 'A Tiburon called Dex owes me for a gold Vela GT. He parks it on Grand Street like he owns it.'],
        ['lena', "Bring me its carcass. I don't care what shape it's in."],
      ]),
      run((ctx) => {
        const x = 6 * PITCH + 30, z = 3 * PITCH + 5.25;
        const v = ctx.spawnVehicle('vela', x, z, Math.PI / 2, '#d4af37');
        const dex = ctx.spawnDriver(v, 'gang');
        dex.name = 'Dex';
        ctx.data.car = v;
        v.health = v.spec.health * 0.9;
      }),
      goTo((ctx) => ({ x: ctx.data.car.x, z: ctx.data.car.z }), "Find Dex's <b>gold Vela GT</b> on Grand Street.", { radius: 40 }),
      say([['Dex', "That's Lena's crazy cousin! I'm outta here!"]], { blocking: false }),
      custom((ctx) => {
        ctx.makeFlee(ctx.data.car);
        ctx.setObjective('Wreck the <b>gold Vela GT</b> before Dex gets away.');
      }, (ctx) => {
        const v = ctx.data.car;
        ctx.target = { x: v.x, z: v.z, color: '#ff4040' };
        if (v.health < v.spec.health * 0.25 || v.wrecked) {
          if (v.driver && v.driver.alive && v.driver !== ctx.game.player.human) ctx.bail(v, true);
          return 'done';
        }
        const pl = ctx.game.player;
        if (dist(pl.vehicle ?? pl, v) > 320) return 'Dex got away.';
        return null;
      }),
      say([['lena', "That'll do. Insurance pays better for wrecks anyway. Come back to the garage."]]),
      goTo(PLACES.lena, 'Return to <b>Park Auto &amp; Custom</b>.', { radius: 3.5 }),
      say([['lena', 'Not bad, Moreno. I have a bigger job coming. Much bigger.']]),
    ],
  },
  {
    id: 'lowtide', title: 'Low Tide', contact: 'lena', reward: 6000, requires: ['repo'],
    steps: () => [
      say([
        ['lena', 'Krane launders his money through Coral Savings & Trust. My crew is going to make a withdrawal.'],
        ['lena', 'You drive. Park out front, wait for them, then lose whoever follows. Bring them back here.'],
      ]),
      getVehicle('Get a <b>car</b> for the getaway.'),
      goTo({ x: 4 * PITCH - 4.5, z: 3.5 * PITCH }, 'Pull up outside <b>Coral Savings &amp; Trust</b> in Neon Row.', { vehicle: true, radius: 4, slow: true }),
      say([['Crew', 'Keep the engine running. We go in, we come out. Thirty seconds tops.']], { blocking: false }),
      holdAt({ x: 4 * PITCH - 4.5, z: 3.5 * PITCH }, 10, 'Wait for the crew...', { radius: 5, awayText: 'Get back to the <b>bank</b>! The crew needs a ride.' }),
      run((ctx) => { ctx.game.audio?.alarm(); ctx.game.hud.banner('ALARM!', 'The crew is out — go, go, go!', '', 2.5); }),
      raiseWanted(3),
      loseWanted('Lose the <b>cops</b>!'),
      goTo(PLACES.lena, 'Take the crew back to <b>Lena\'s garage</b>.', { radius: 4, vehicle: true }),
      say([
        ['lena', 'Clean. Krane is going to feel that one.'],
        ['lena', 'Here, take a Wasp. Krane will be sending people after whoever did this.'],
      ]),
      run((ctx) => { giveWeapon(ctx.game.player.arsenal, 'smg', 120); ctx.game.hud.help('You got the <b>Wasp SMG</b>. Press <kbd>3</kbd> to equip it.', 6); }),
    ],
  },
  {
    id: 'sharks', title: 'Sharks on the Pier', contact: 'teo', reward: 8000, requires: ['lowtide'],
    steps: () => [
      say([
        ['teo', 'Rico Salas — the shark who runs the Tiburones — is meeting Krane\'s money man on the pier tonight.'],
        ['teo', 'Cut the head off the shark and the Strand can breathe again. Take some vests from my locker.'],
      ]),
      run((ctx) => { ctx.game.player.human.armour = 100; giveWeapon(ctx.game.player.arsenal, 'pistol', 48); }),
      goTo(PLACES.pierGate, 'Go to <b>Starwheel Pier</b>.', { radius: 5 }),
      run((ctx) => {
        const cx = PIER.x0 + 7;
        ctx.data.rico = ctx.spawnEnemy('boss', cx, PIER.z1 - 30, { weapon: 'smg', name: 'Rico Salas', skill: 0.6, alertRange: 45 });
        ctx.data.rico.look.shirt = '#0b7a75';
        for (let k = 0; k < 6; k++) {
          const z = CITY_H + 85 + k * 22;
          ctx.spawnEnemy('gang', cx + (k % 2 ? 3 : -3), z, { weapon: k % 3 === 0 ? 'smg' : 'pistol', skill: 0.5, alertRange: 32 });
        }
      }),
      custom((ctx) => { ctx.setObjective('Kill <b>Rico Salas</b> and his Tiburones.'); }, (ctx) => {
        const r = ctx.data.rico;
        ctx.target = r.alive ? { x: r.x, z: r.z, color: '#ff4040' } : null;
        const left = ctx.game.enemies.list.filter((h) => h.alive).length;
        if (!r.alive && left === 0) return 'done';
        if (!r.alive) ctx.setObjective(`Rico is down. Finish his crew: <b>${left}</b> left.`);
        return null;
      }),
      say([['teo', "Rico's done. The whole Strand heard that — get out of there!"]], { blocking: false }),
      raiseWanted(2),
      loseWanted(),
      say([['teo', "Krane's going to panic now. When he runs, we'll be waiting."]]),
    ],
  },
  {
    id: 'finale', title: "Krane's Last Deal", contact: 'lena', reward: 25000, requires: ['sharks'],
    steps: () => [
      say([
        ['lena', "Krane's skipping town. His limo is leaving Krane Tower right now."],
        ['teo', 'This is it, Cass. Finish it, for the Strand.'],
      ]),
      goTo({ x: PLACES.kraneTower.x, z: PLACES.kraneTower.z + 10 }, 'Get to <b>Krane Tower</b> in Neon Row.', { radius: 30 }),
      run((ctx) => {
        const t = PLACES.kraneTower;
        const v = ctx.spawnVehicle('limo', t.x + 6, 3 * PITCH - 5.25, -Math.PI / 2, '#0d0d10');
        const krane = ctx.spawnDriver(v, 'boss');
        krane.name = 'Victor Krane';
        krane.maxHealth = krane.health = 120;
        ctx.data.limo = v; ctx.data.krane = krane;
        for (let k = 0; k < 4; k++) ctx.spawnEnemy('security', t.x - 10 + k * 6, t.z - 0.5, { weapon: k % 2 ? 'smg' : 'pistol', skill: 0.55, alertRange: 60 });
        ctx.makeFlee(v);
        ctx.game.wanted.atLeast(2);
      }),
      say([['krane', 'You think you can take my city? I AM this city!']], { blocking: false }),
      custom((ctx) => { ctx.setObjective('Stop <b>Victor Krane</b>.'); }, (ctx) => {
        const k = ctx.data.krane, v = ctx.data.limo;
        ctx.target = { x: k.vehicle ? v.x : k.x, z: k.vehicle ? v.z : k.z, color: '#ff4040' };
        if (k.vehicle === v && (v.health < v.spec.health * 0.3 || v.wrecked)) {
          ctx.bail(v, true);
          ctx.setObjective('Krane is on foot! <b>Take him down.</b>');
        }
        if (!k.alive) return 'done';
        const pl = ctx.game.player;
        if (dist(pl.vehicle ?? pl, k.vehicle ?? k) > 360) return 'Krane escaped.';
        return null;
      }),
      say([
        ['cass', "That's for the Strand, Victor."],
        ['teo', 'It is done, mija. Sunvale is ours again.'],
        ['lena', 'Drinks at the pier. You are buying, rich girl.'],
      ]),
      loseWanted(),
      run((ctx) => { ctx.game.hud.banner('SUNVALE IS YOURS', 'Story complete — keep exploring, racing and collecting Sun Tokens', '', 7); }),
    ],
  },
];
void HALF_ROAD; void wait;
