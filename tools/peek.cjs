// Dev helper: load a game URL in headless Chromium, print console errors, save a screenshot.
// usage: node tools/peek.cjs "<query>" out.png [waitMs]
const { chromium } = require('playwright');
(async () => {
  const [query = '', out = 'peek.png', wait = '60000'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console.' + m.type() + ']', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
  const t0 = Date.now();
  await page.goto('http://localhost:8080/' + query);
  try { await page.waitForFunction(() => window.__shotReady === true, null, { timeout: Number(wait) }); }
  catch { console.log('timeout waiting for __shotReady'); }
  console.log('ready in', Date.now() - t0, 'ms', await page.evaluate(() => { const g = window.__sunvale; return g ? `calls ${g.renderer.info.render.calls} tris ${g.renderer.info.render.triangles} humans ${g.world.humans.length} cars ${g.world.vehicles.length}` : ''; }));
  await page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', quality: out.endsWith('.jpg') ? 80 : undefined });
  await browser.close();
})();
