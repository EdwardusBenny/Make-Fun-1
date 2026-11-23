// Dev helper: play the real game loop with scripted keys and report errors and state.
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await page.goto('http://localhost:8080/?seed=3');
  await page.waitForTimeout(4000);
  await page.click('button[data-act=new]');
  await page.waitForTimeout(3000);
  const state = () => page.evaluate(() => 'ok');
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  await hold('KeyW', 2500);
  await page.screenshot({ path: out + '/pt1.jpg', type: 'jpeg', quality: 70 });
  // walk toward the nearest car and press F repeatedly while strafing
  for (let k = 0; k < 6; k++) { await page.keyboard.press('KeyF'); await hold(k % 2 ? 'KeyA' : 'KeyD', 400); }
  await hold('KeyW', 3000);
  await page.keyboard.press('KeyQ');
  await hold('KeyH', 300);
  await page.screenshot({ path: out + '/pt2.jpg', type: 'jpeg', quality: 70 });
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(500);
  await page.keyboard.press('Digit2');
  for (let k = 0; k < 5; k++) { await page.mouse.click(640, 360); await page.waitForTimeout(150); }
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/pt3.jpg', type: 'jpeg', quality: 70 });
  await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/pt4.jpg', type: 'jpeg', quality: 70 });
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps (swiftshader)', fps, await state());
  console.log('errors:', errors.length ? errors.slice(0, 15).join('\n') : 'none');
  await browser.close();
})();
