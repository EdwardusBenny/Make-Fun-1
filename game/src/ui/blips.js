// Gathers what the minimap and city map show: mission contacts, shops and activities, the current
// objective, enemies, police cars and officers (flashing), mission vehicles and pickups.
import { PLACES } from '../city/layout.js';

export const MAP_LEGEND = [
  ['#6fd3ff', 'Uncle Teo (missions)', 'T'],
  ['#ff8fd0', 'Lena Park (missions)', 'L'],
  ['#ffd23f', 'Objective', null],
  ['#ff3b3b', 'Lockbox Arms (weapons)', '$'],
  ['#5dffcf', 'Fresh Coat (lose the cops)', 'P'],
  ['#ffb347', 'Street race', 'R'],
  ['#ff4040', 'Enemy', null],
  ['#3a6bff', 'Police', null],
  ['#ffffff', 'Sunvale General (hospital)', 'H'],
  ['#9db8ff', 'SVPD Central', '★'],
];

export function mapBlips(game) {
  const out = [
    { x: PLACES.hospital.x, z: PLACES.hospital.z, color: '#ffffff', size: 6, label: 'H' },
    { x: PLACES.police.x, z: PLACES.police.z, color: '#9db8ff', size: 6, label: '★' },
  ];
  const flash = Math.floor(game.world.time * 4) % 2 === 0;
  for (const b of game.missions.blips()) out.push(b);
  for (const b of game.activities.blips()) out.push(b);
  for (const h of game.enemies.list) if (h.alive) out.push({ x: h.x, z: h.z, color: h.name ? '#ff2020' : '#ff5050', size: h.name ? 6 : 4 });
  for (const v of game.police.cars) if (!v.removed && !v.wrecked && v.siren) out.push({ x: v.x, z: v.z, color: flash ? '#ff2a3a' : '#2a5aff', size: 5, shape: 'square' });
  for (const o of game.police.officers) if (o.alive && o.state === 'walk' && o.hostile) out.push({ x: o.x, z: o.z, color: '#3a6bff', size: 3.5 });
  if (game.heli.active) out.push({ x: game.heli.x, z: game.heli.z, color: flash ? '#ffffff' : '#2a5aff', size: 6, shape: 'square' });
  for (const it of game.pickups.items) {
    if (it.kind === 'health') out.push({ x: it.x, z: it.z, color: '#ff6b7a', size: 3.5 });
    if (it.kind === 'armour') out.push({ x: it.x, z: it.z, color: '#6fb6ff', size: 3.5 });
  }
  return out;
}
