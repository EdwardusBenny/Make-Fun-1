// Title, pause and controls screens: buttons wired to callbacks, keyboard navigation with arrows
// and Enter, and the pause screen's progress summary.
import { formatMoney } from '../core/mathutil.js';

const $ = (id) => document.getElementById(id);

export function createMenus(handlers) {
  const screens = { title: $('menu-title'), pause: $('menu-pause'), controls: $('menu-controls') };
  let current = null, back = null;

  for (const [name, el] of Object.entries(screens)) {
    el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'controls') { show('controls', name); return; }
      if (act === 'back') { show(back ?? 'title'); return; }
      handlers[act]?.();
    });
  }

  function buttons() { return current ? [...screens[current].querySelectorAll('button:not(:disabled)')] : []; }
  function select(k) {
    const list = buttons();
    list.forEach((b, n) => b.classList.toggle('sel', n === k));
  }
  window.addEventListener('keydown', (e) => {
    if (!current) return;
    const list = buttons();
    let k = list.findIndex((b) => b.classList.contains('sel'));
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { select((k + 1) % list.length); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { select((k - 1 + list.length) % list.length); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'Space') { if (k < 0) k = 0; list[k]?.click(); e.preventDefault(); }
  });

  function show(name, from = null) {
    for (const el of Object.values(screens)) el.classList.add('hidden');
    current = name;
    if (from) back = from;
    if (name) { screens[name].classList.remove('hidden'); select(0); }
  }

  return {
    show,
    get current() { return current; },
    setContinue(enabled) { const b = screens.title.querySelector('[data-act=continue]'); b.disabled = !enabled; b.style.display = enabled ? '' : 'none'; },
    pauseStats(game) {
      const s = game.stats;
      const mins = Math.floor(s.played / 60);
      $('pause-stats').innerHTML = [
        `Cash <b>${formatMoney(game.player.money)}</b>`,
        `Story <b>${game.missions.completed.size}/${game.missions.count}</b> · Sun Tokens <b>${game.activities.state.tokens.size}/12</b>`,
        `Coral Run best <b>${game.activities.state.raceBest ? game.activities.state.raceBest.toFixed(1) + 's' : '—'}</b>`,
        `Cars stolen <b>${s.carsStolen}</b> · Takedowns <b>${s.kills}</b> · Busted <b>${s.arrests}</b> · Wasted <b>${s.deaths}</b>`,
        `Time on the streets <b>${mins} min</b>`,
      ].join('<br>');
    },
  };
}
