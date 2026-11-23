// Weapon definitions: fists, the Kestrel 9 pistol and the Wasp SMG (all invented names).

export const WEAPONS = {
  fists: { id: 'fists', name: 'FISTS', melee: true, damage: 15, cooldown: 0.42, range: 1.8 },
  pistol: { id: 'pistol', name: 'KESTREL 9', damage: 34, cooldown: 0.24, auto: false, spread: 0.006, range: 150, clip: 12, reload: 1.1 },
  smg: { id: 'smg', name: 'WASP SMG', damage: 19, cooldown: 0.085, auto: true, spread: 0.02, range: 120, clip: 30, reload: 1.5 },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg'];

/** A fresh inventory: fists only. */
export function newArsenal() {
  return {
    current: 'fists',
    pistol: { owned: false, ammo: 0, clip: 0 },
    smg: { owned: false, ammo: 0, clip: 0 },
  };
}

export function giveWeapon(arsenal, id, ammo) {
  const slot = arsenal[id];
  if (!slot) return;
  slot.owned = true;
  slot.ammo += ammo;
  if (slot.clip === 0) {
    const take = Math.min(WEAPONS[id].clip, slot.ammo);
    slot.clip = take; slot.ammo -= take;
  }
}
