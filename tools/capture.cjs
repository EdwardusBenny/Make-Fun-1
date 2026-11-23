// Captures the screenshots listed in shots.json from the running dev server (node serve.ts) into
// screenshots/ as 1280x720 JPEGs, lowering quality if one would exceed the 256 KiB cap.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const root = path.join(__dirname, '..');
  const shots = JSON.parse(fs.readFileSync(path.join(root, 'shots.json'), 'utf8'));
  const dir = path.join(root, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('pageerror', s.name, e.message));
    await page.goto('http://localhost:8080/' + s.query);
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
    let quality = 84, buf;
    do { buf = await page.screenshot({ type: 'jpeg', quality }); quality -= 6; } while (buf.length > 250 * 1024 && quality > 30);
    fs.writeFileSync(path.join(dir, s.name), buf);
    console.log(s.name, Math.round(buf.length / 1024) + ' KiB', 'q' + (quality + 6));
    await page.close();
  }
  await browser.close();
})();
