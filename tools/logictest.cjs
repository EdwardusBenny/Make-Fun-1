// Dev helper: drive the simulation directly (no real-time rendering) through the story and systems.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8080/?seed=5');
  await page.waitForFunction(() => window.__sunvale, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(async () => {
    const g = window.__sunvale;
    const log = [];
    const held = new Set(); let pressed = new Set();
    const input = { mouse: { dx: 0, dy: 0, left: false, right: false, leftPressed: false, wheel: 0 },
      down: (c) => held.has(c), hit: (c) => { if (pressed.has(c)) { pressed.delete(c); return true; } return false; },
      axis: (n, p) => (held.has(p) ? 1 : 0) - (held.has(n) ? 1 : 0), endFrame() { pressed = new Set(); } };
    const step = (sec, fn) => { for (let t = 0; t < sec; t += 1 / 30) { fn?.(t); g.step(1 / 30, input); input.endFrame(); } g.updateHud(1 / 30); };
    const press = (c) => pressed.add(c);
    const P = g.player, H = P.human;
    // start a new game the way the menu does
    document.querySelector('button[data-act=new]').click();
    step(0.5);
    log.push('mission ' + g.missions.active?.def.id);
    step(14); // dialogue
    const v = g.vehicles.list.find((c) => c.ai?.kind === 'traffic');
    H.x = v.doorPoint().x; H.z = v.doorPoint().z;
    press('KeyF'); step(0.2);
    log.push('in car: ' + !!P.vehicle + ' wanted ' + g.wanted.level);
    held.add('KeyW'); step(2); held.delete('KeyW');
    log.push('car speed after 2s ' + P.vehicle?.speed.toFixed(1));
    if (!g.missions.active?.ctx.target) { log.push('no target; step ' + g.missions.active?.index + ' inCar ' + !!P.vehicle + ' obj ' + document.getElementById('hud-objective').textContent); return log; }
    const car = P.vehicle; car.x = g.missions.active.ctx.target.x + 2; car.z = g.missions.active.ctx.target.z; car.vx = car.vz = 0;
    step(1);
    log.push('step index ' + g.missions.active?.index);
    step(20);
    log.push('after homecoming: money ' + P.money + ' pistol ' + P.arsenal.pistol.owned + ' done ' + [...g.missions.completed]);
    // gunfire near people -> wanted, police spawn and chase
    press('KeyF'); step(0.5);
    P.arsenal.current = 'pistol';
    for (let k = 0; k < 6; k++) { input.mouse.leftPressed = true; step(0.3); }
    log.push('wanted after shooting ' + g.wanted.level);
    g.wanted.atLeast(3);
    step(15);
    log.push('police cars ' + g.police.cars.length + ' officers ' + g.police.officers.length + ' heli ' + g.heli.active + ' state ' + g.state + ' hp ' + H.health.toFixed(0));
    step(20);
    log.push('after 35s: state ' + g.state + ' hp ' + H.health.toFixed(0) + ' wanted ' + g.wanted.level + ' deaths ' + g.stats.deaths + ' arrests ' + g.stats.arrests);
    // wasted
    if (g.state === 'play') { H.takeDamage(500, { kind: 'bullet' }); step(6); }
    log.push('after death: state ' + g.state + ' pos ' + H.x.toFixed(0) + ',' + H.z.toFixed(0) + ' wanted ' + g.wanted.level);
    // run each remaining mission by jumping to its steps' targets
    for (const id of ['bait', 'repo', 'lowtide', 'sharks', 'finale']) {
      g.missions.startById(id);
      let guard = 0;
      while (g.missions.active && guard++ < 60) {
        const a = g.missions.active, ctx = a.ctx;
        const before = a.index;
        // satisfy whatever the step wants
        if (!P.vehicle) { const c = g.vehicles.spawn('marlin', { x: H.x + 3, z: H.z }); P.enterVehicle(c); }
        if (ctx.target) { P.vehicle.x = ctx.target.x + 1; P.vehicle.z = ctx.target.z; P.vehicle.vx = P.vehicle.vz = 0; }
        if (g.wanted.level) { g.wanted.clear(); g.police.reset(); }
        for (const e of g.enemies.list) if (e.alive) e.takeDamage(999, { source: H, kind: 'bullet' });
        if (ctx.data.car && !ctx.data.car.wrecked) ctx.data.car.damage(5000, H);
        if (ctx.data.limo && ctx.data.limo.health > 0) ctx.data.limo.damage(5000, H);
        if (ctx.data.krane && !ctx.data.krane.vehicle && ctx.data.krane.alive) ctx.data.krane.takeDamage(999, { source: H });
        H.health = 100;
        step(1.5);
        if (a.index === before) step(4);
      }
      log.push(id + ': active=' + (g.missions.active?.def.id ?? 'none') + ' idx ' + (g.missions.active?.index ?? '-') + ' done=' + g.missions.completed.has(id) + ' money ' + P.money);
      if (g.missions.active) g.missions.abort();
    }
    let nan = 0;
    for (const h of g.world.humans) if (!Number.isFinite(h.x) || !Number.isFinite(h.z)) nan++;
    for (const c of g.world.vehicles) if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) nan++;
    log.push('NaN entities ' + nan + ' humans ' + g.world.humans.length + ' vehicles ' + g.world.vehicles.length);
    log.push('draw calls ' + g.renderer.info.render.calls + ' tris ' + g.renderer.info.render.triangles);
    return log;
  });
  // save, reload, continue
  await page.evaluate(() => window.__sunvale.save());
  await page.goto('http://localhost:8080/?seed=6');
  await page.waitForFunction(() => window.__sunvale, null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  const cont = await page.evaluate(() => {
    const b = document.querySelector('button[data-act=continue]');
    const visible = b && !b.disabled && b.style.display !== 'none';
    b.click();
    const g = window.__sunvale;
    for (let k = 0; k < 30; k++) g.step(1 / 30, null);
    return `continue visible ${visible}; money ${g.player.money}; story ${[...g.missions.completed].join(',')}; smg ${g.player.arsenal.smg.owned}; state ${g.state}`;
  });
  result.push(cont);
  console.log(result.join('\n'));
  console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
