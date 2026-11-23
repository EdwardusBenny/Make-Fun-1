// The on-screen HUD in DOM: money (ticks up when earned), wanted stars (flashing while searched),
// weapon and ammo, health and armour, clock, district and street name, objective and help text,
// speedometer and car damage, radio station, subtitles, big banners, crosshair and hurt flash.
import { formatMoney } from '../core/mathutil.js';
import { WEAPONS } from '../combat/weapons.js';
import { DISTRICTS } from '../city/layout.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const el = {
    root: $('hud'), money: $('hud-money'), stars: $('hud-stars'), weapon: $('hud-weapon-name'), ammo: $('hud-ammo'),
    health: $('hud-health'), armour: $('hud-armour'), clock: $('hud-clock'), objective: $('hud-objective'), help: $('hud-help'),
    district: $('hud-district'), vehicle: $('hud-vehicle'), vname: $('hud-vehicle-name'), speed: $('hud-speed'), damage: document.querySelector('#hud-damage i'),
    radio: $('hud-radio'), subtitle: $('hud-subtitle'), banner: $('hud-banner'), crosshair: $('hud-crosshair'), timer: $('hud-timer'), hit: $('hud-hitflash'),
  };
  el.stars.innerHTML = '<span>★</span>'.repeat(5);
  const starEls = [...el.stars.children];
  const cache = {};
  const set = (key, node, prop, value) => { if (cache[key] !== value) { cache[key] = value; node[prop] = value; } };
  let shownMoney = 0;
  let bannerTime = 0, radioTime = 0, subtitleTime = 0, helpTime = 0, districtTime = 0, lastDistrict = '';
  let hitTime = 0;

  const hud = {
    show(v) { el.root.classList.toggle('hidden', !v); },
    setObjective(html, mission = '') { set('obj', el.objective, 'innerHTML', html ? (mission ? `<span class="mission">${mission}</span>` : '') + html : ''); },
    help(html, seconds = 6) { set('help', el.help, 'innerHTML', html); helpTime = seconds; },
    subtitle(html, seconds = 4) { set('sub', el.subtitle, 'innerHTML', html); subtitleTime = seconds; },
    banner(big, small = '', kind = '', seconds = 4) {
      el.banner.querySelector('.big').textContent = big;
      el.banner.querySelector('.small').textContent = small;
      el.banner.className = `on ${kind}`;
      bannerTime = seconds;
    },
    clearBanner() { bannerTime = 0; el.banner.className = ''; },
    radio(name, tagline) { el.radio.innerHTML = `${name}<small>${tagline}</small>`; el.radio.classList.add('on'); radioTime = 3.5; },
    timer(text) { set('timer', el.timer, 'textContent', text ?? ''); },
    hurt() { hitTime = 0.35; },
    snapMoney(v) { shownMoney = v; },
    update(dt, s) {
      // money ticks toward the real amount
      if (shownMoney !== s.money) {
        const step = Math.max(1, Math.abs(s.money - shownMoney) * dt * 4);
        shownMoney = shownMoney < s.money ? Math.min(s.money, shownMoney + step) : Math.max(s.money, shownMoney - step);
      }
      set('money', el.money, 'textContent', formatMoney(shownMoney));
      for (let k = 0; k < 5; k++) {
        const on = k < s.wanted;
        if (cache['s' + k] !== on) { cache['s' + k] = on; starEls[k].className = on ? 'on' : ''; }
      }
      const flash = s.wanted > 0 && s.flashing;
      if (cache.flash !== flash) { cache.flash = flash; el.stars.classList.toggle('flash', flash); }
      const w = WEAPONS[s.weapon];
      set('wname', el.weapon, 'textContent', w.name);
      set('ammo', el.ammo, 'textContent', w.melee ? '' : s.reloading ? 'RELOADING' : `${s.clip} / ${s.ammo}`);
      set('hp', el.health.style, 'width', `${Math.max(0, s.health)}%`);
      set('ar', el.armour.style, 'width', `${Math.max(0, s.armour)}%`);
      const hh = Math.floor(s.hour), mm = Math.floor((s.hour - hh) * 60);
      set('clock', el.clock, 'textContent', `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      // district name pops up when it changes
      if (s.district !== lastDistrict) { lastDistrict = s.district; districtTime = 4; }
      const dname = DISTRICTS[s.district]?.name ?? '';
      set('district', el.district, 'innerHTML', districtTime > 0 ? `${dname}<br><small style="font-size:12px;letter-spacing:1px;opacity:.8">${s.street}</small>` : `<small style="font-size:12px;letter-spacing:1px;opacity:.8">${s.street}</small>`);
      if (districtTime > 0) districtTime -= dt;
      el.vehicle.classList.toggle('on', !!s.vehicle);
      if (s.vehicle) {
        set('vname', el.vname, 'textContent', s.vehicle.spec.name.toUpperCase());
        set('speed', el.speed, 'textContent', String(Math.round(s.vehicle.speed * 3.6)));
        set('dmg', el.damage.style, 'width', `${Math.round(s.vehicle.health / s.vehicle.spec.health * 100)}%`);
      }
      el.crosshair.classList.toggle('on', s.aiming);
      el.crosshair.classList.toggle('hit', s.hitMarker);
      if (bannerTime > 0) { bannerTime -= dt; if (bannerTime <= 0) el.banner.classList.remove('on'); }
      if (radioTime > 0) { radioTime -= dt; if (radioTime <= 0) el.radio.classList.remove('on'); }
      if (subtitleTime > 0) { subtitleTime -= dt; if (subtitleTime <= 0) set('sub', el.subtitle, 'innerHTML', ''); }
      if (helpTime > 0) { helpTime -= dt; if (helpTime <= 0) set('help', el.help, 'innerHTML', ''); }
      if (hitTime > 0) { hitTime -= dt; }
      if (cache.hit !== hitTime > 0) { cache.hit = hitTime > 0; el.hit.classList.toggle('on', hitTime > 0); }
    },
  };
  return hud;
}
