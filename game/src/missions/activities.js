// Things to do between missions: Lockbox Arms (ammo, the Wasp SMG, armour), Fresh Coat paint shop
// (drive in to lose the cops, repair and respray), the Coral Run street race against the clock,
// twelve hidden Sun Tokens, and health/armour pickups that respawn around the city.
import { PLACES, PITCH, CITY_H, PIER, HALF_ROAD, CITY_W } from '../city/layout.js';
import { giveWeapon } from '../combat/weapons.js';
import { formatMoney } from '../core/mathutil.js';
import { VEHICLES } from '../vehicles/specs.js';
import { pick } from '../core/random.js';

export const TOKEN_SPOTS = [
  [4.5 * PITCH, 5.5 * PITCH + 9], [PIER.x0 + 7, PIER.z1 - 6], [CITY_W + 30, 40], [-20, -20], [1.5 * PITCH, 1.5 * PITCH + 30],
  [7.5 * PITCH, CITY_H + 60], [60, CITY_H + 80], [9.5 * PITCH, 4.5 * PITCH + 30], [5 * PITCH + 3, 0.5 * PITCH], [2.5 * PITCH, 6.5 * PITCH + 33],
  [CITY_W + 25, CITY_H - 20], [6.5 * PITCH, 7.5 * PITCH - 33],
];

/** The Coral Run: a loop from Lena's garage down to the beach, along Coral Parade and back through Neon Row. */
const RACE = [
  [2 * PITCH, 5 * PITCH + 3.5], [2 * PITCH, 7 * PITCH], [3 * PITCH, 8 * PITCH + 3.5], [5 * PITCH, 8 * PITCH + 3.5], [7 * PITCH, 8 * PITCH + 3.5],
  [8 * PITCH, 7 * PITCH], [8 * PITCH, 5 * PITCH], [7 * PITCH, 3 * PITCH + 3.5], [5 * PITCH, 3 * PITCH + 3.5], [4 * PITCH, 4 * PITCH],
  [3 * PITCH, 5 * PITCH + 3.5], [2 * PITCH - 30, 5 * PITCH + 3.5],
];
const RACE_PAR = 105;
const RACE_START = { x: 2 * PITCH - 30, z: 5 * PITCH + 3.5 };

export function createActivities(game) {
  const { hud, world, markers } = game;
  const state = { tokens: new Set(), raceBest: null, raceWon: false };
  const shopM = markers.add(PLACES.gunShop.x, PLACES.gunShop.z, { color: '#ff3b3b', radius: 1.4, height: 3, label: '$' });
  const paintM = markers.add(PLACES.paintShop.x, PLACES.paintShop.z + 9, { color: '#5dffcf', radius: 3.5, height: 3, label: 'P' });
  let raceM = null;
  let tokenItems = [];
  let race = null;
  let shopOpen = false;
  let paintCool = 0;
  const panel = document.createElement('div');
  panel.id = 'shop-panel';
  panel.style.cssText = 'position:fixed;right:30px;top:200px;width:330px;background:rgba(10,8,18,.88);border-left:4px solid #ff3b3b;padding:14px 18px;font-size:16px;line-height:1.7;display:none;color:#fff;';
  document.body.appendChild(panel);

  const STOCK = [
    { key: 'Digit1', label: 'Kestrel 9 ammo ×36', price: 150, ok: (p) => p.arsenal.pistol.owned, buy: (p) => giveWeapon(p.arsenal, 'pistol', 36) },
    { key: 'Digit2', label: 'Wasp SMG + 90 rounds', price: 1200, ok: () => true, buy: (p) => { giveWeapon(p.arsenal, 'smg', 90); p.arsenal.current = 'smg'; } },
    { key: 'Digit3', label: 'Body armour', price: 250, ok: (p) => p.human.armour < 100, buy: (p) => { p.human.armour = 100; } },
  ];

  function renderPanel() {
    const p = game.player;
    panel.innerHTML = `<div style="font-weight:bold;letter-spacing:3px;color:#ff6b6b">LOCKBOX ARMS</div>` +
      STOCK.map((s, k) => `<div style="opacity:${s.ok(p) && p.money >= s.price ? 1 : 0.4}"><kbd style="background:#fff;color:#111;padding:0 6px;border-radius:3px;font-weight:bold">${k + 1}</kbd> ${s.label} <span style="float:right;color:#7dffa1">${formatMoney(s.price)}</span></div>`).join('') +
      `<div style="font-size:13px;opacity:.7;margin-top:6px">Press <b>E</b> to leave</div>`;
  }

  function spawnTokens() {
    for (const it of tokenItems) game.pickups.remove(it);
    tokenItems = TOKEN_SPOTS.map(([x, z], k) => (state.tokens.has(k) ? null : Object.assign(game.pickups.spawn('token', x, z, { index: k }), {}))).filter(Boolean);
  }

  world.events.on('pickup', (it) => {
    if (it.kind === 'token') {
      state.tokens.add(it.data.index);
      game.player.money += 250;
      const n = state.tokens.size;
      hud.banner(`SUN TOKEN ${n}/12`, n === 12 ? 'All tokens found! Bonus $5,000' : '+$250', '', 3);
      if (n === 12) game.player.money += 5000;
      game.audio?.jingle('token');
      game.save?.();
    }
  });

  // health and armour that come back a while after being taken
  const STATIC = [['health', PLACES.hospital.x + 4, PLACES.hospital.z], ['armour', PLACES.police.x + 6, PLACES.police.z], ['health', PIER.x0 + 7, PIER.z1 - 12],
    ['armour', 4.5 * PITCH + 12, 5.5 * PITCH], ['health', PLACES.teo.x, PLACES.teo.z + 6], ['armour', 1 * PITCH - 10, 2 * PITCH + 10]];
  const staticItems = STATIC.map(([k, x, z]) => ({ kind: k, x, z, item: null, timer: 0 }));

  function startRace() {
    if (!game.player.vehicle) { hud.help('You need a <b>car</b> to race.', 3); return; }
    race = { index: 0, time: -3, marker: null };
    hud.banner('CORAL RUN', `Beat ${RACE_PAR}s to win`, '', 2.5);
    nextCheckpoint();
  }
  function nextCheckpoint() {
    race.marker?.remove();
    const [x, z] = RACE[race.index];
    race.marker = markers.add(x, z, { color: '#ffb347', radius: 5.5, height: 10, checkpoint: true });
  }
  function endRace(finished) {
    race.marker?.remove();
    hud.timer('');
    hud.setObjective('');
    if (finished) {
      const t = race.time;
      const best = state.raceBest == null || t < state.raceBest;
      if (best) state.raceBest = t;
      const won = t <= RACE_PAR;
      const prize = won ? (state.raceWon ? 300 : 1500) : 0;
      if (won) state.raceWon = true;
      game.player.money += prize;
      hud.banner(won ? 'RACE WON' : 'RACE OVER', `${t.toFixed(2)}s${best ? ' · new best' : ''}${prize ? ' · ' + formatMoney(prize) : ''}`, '', 4);
      game.audio?.jingle(won ? 'pass' : 'fail');
      game.save?.();
    } else hud.banner('RACE ABANDONED', '', 'wasted', 2.5);
    race = null;
  }

  const api = {
    state,
    get racing() { return !!race; },
    /** Read shop keys before the player uses 1-3 for weapons. */
    preInput(input) {
      if (!shopOpen) return;
      const p = game.player;
      for (const s of STOCK) {
        if (input.hit(s.key)) {
          if (!s.ok(p)) hud.help('You can\'t use that right now.', 2);
          else if (p.money < s.price) hud.help('Not enough cash.', 2);
          else { p.money -= s.price; s.buy(p); game.audio?.jingle('buy'); game.save?.(); }
          renderPanel();
        }
      }
    },
    update(dt, input) {
      const p = game.player;
      const px = p.vehicle ? p.vehicle.x : p.x, pz = p.vehicle ? p.vehicle.z : p.z;
      if (game.state !== 'play') { if (race) endRace(false); return; }
      // gun shop
      const atShop = !p.vehicle && Math.hypot(px - shopM.x, pz - shopM.z) < 2.2;
      if (atShop && !shopOpen) hud.help('Press <kbd>E</kbd> to shop at <b>Lockbox Arms</b>.', 0.2);
      if (atShop && input?.hit('KeyE')) { shopOpen = !shopOpen; }
      if (!atShop) shopOpen = false;
      if (shopOpen) renderPanel();
      panel.style.display = shopOpen ? 'block' : 'none';
      // paint shop
      paintCool -= dt;
      if (p.vehicle && paintCool <= 0 && Math.hypot(px - paintM.x, pz - paintM.z) < 4.5) {
        const cost = game.wanted.level > 0 ? 250 : 100;
        if (p.money >= cost) {
          p.money -= cost;
          const v = p.vehicle;
          v.health = v.spec.health;
          const col = pick(v.spec.paints.length > 1 ? v.spec.paints : ['#ff5fa2', '#2ec4b6', '#ffd23f']);
          v.bodyMesh.material = v.bodyMesh.material.clone(); v.bodyMesh.material.color.set(col);
          const had = game.wanted.level;
          game.wanted.clear();
          game.police.reset();
          hud.banner('FRESH COAT', had ? `New paint, new plates. -${formatMoney(cost)}` : `Repaired and resprayed. -${formatMoney(cost)}`, '', 3);
          game.audio?.jingle('buy');
        } else hud.help('Fresh Coat costs <b>$100</b> ($250 with the cops on you).', 3);
        paintCool = 6;
      }
      // race
      const raceOpen = game.missions.completed.has('repo');
      if (raceOpen && !raceM && !race) raceM = markers.add(RACE_START.x, RACE_START.z, { color: '#ffb347', radius: 2.5, height: 4, label: 'R' });
      if (raceM && !race && Math.hypot(px - raceM.x, pz - raceM.z) < 4 && !game.missions.active) {
        hud.help(p.vehicle ? 'Press <kbd>E</kbd> to start the <b>Coral Run</b> street race.' : 'Bring a <b>car</b> to race the Coral Run.', 0.2);
        if (input?.hit('KeyE') && p.vehicle) { raceM.remove(); raceM = null; startRace(); }
      }
      if (race) {
        race.time += dt;
        if (race.time < 0) { hud.timer(`${Math.ceil(-race.time)}`); if (p.vehicle) { p.vehicle.vx *= 0.9; p.vehicle.vz *= 0.9; } }
        else {
          hud.timer(`${race.time.toFixed(1)}s`);
          hud.setObjective(`Checkpoint <b>${race.index + 1}/${RACE.length}</b> · par ${RACE_PAR}s${state.raceBest ? ` · best ${state.raceBest.toFixed(1)}s` : ''}`, 'Coral Run');
          const [x, z] = RACE[race.index];
          if (Math.hypot(px - x, pz - z) < 8) {
            race.index++;
            game.audio?.jingle('checkpoint');
            if (race.index >= RACE.length) endRace(true); else nextCheckpoint();
          }
          if (race && !p.vehicle) endRace(false);
        }
      }
      // respawning pickups
      for (const s of staticItems) {
        if (s.item && !game.pickups.items.includes(s.item)) { s.item = null; s.timer = 60; }
        if (!s.item) { s.timer -= dt; if (s.timer <= 0) s.item = game.pickups.spawn(s.kind, s.x, s.z); }
      }
    },
    blips() {
      const out = [
        { x: shopM.x, z: shopM.z, color: '#ff3b3b', size: 6, label: '$' },
        { x: paintM.x, z: paintM.z, color: '#5dffcf', size: 6, label: 'P' },
      ];
      if (raceM) out.push({ x: raceM.x, z: raceM.z, color: '#ffb347', size: 6, label: 'R' });
      if (race) out.push({ x: RACE[race.index][0], z: RACE[race.index][1], color: '#ffb347', size: 7, pin: true });
      return out;
    },
    gps() { return race ? { x: RACE[race.index][0], z: RACE[race.index][1], color: '#ffb347' } : null; },
    spawnTokens,
    load(s) { state.tokens = new Set(s.tokens ?? []); state.raceBest = s.raceBest ?? null; state.raceWon = !!s.raceWon; spawnTokens(); },
    save() { return { tokens: [...state.tokens], raceBest: state.raceBest, raceWon: state.raceWon }; },
  };
  void HALF_ROAD; void VEHICLES;
  return api;
}
