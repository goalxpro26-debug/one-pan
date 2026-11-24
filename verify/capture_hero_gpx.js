// One Pan — capture a busy hero frame from the GamePix build for assets.
// ENDLESS (straight from the title screen) -> autoplay on -> wait until
// the grill is full and the queue is busy -> screenshot verify/gpx/hero.png
// Same capture_hero.js idea, adapted to the file:// GamePix build route
// (manual EngineLoader.load, SDK via the 3129 forwarding proxy).
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const path = require('path');
const url = process.argv[2];
const W = 1136, H = 640;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function guiClick(page, x, y) {
  await page.mouse.move(x, H - y);
  await page.mouse.down(); await sleep(800); await page.mouse.up(); await sleep(400);
}
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hatch-webgl-allowed-domains-file=' + path.join(__dirname, 'webgl-policy-all.txt'),
      '--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,local-network-access-check',
      '--proxy-server=http://127.0.0.1:3129',
      '--proxy-bypass-list=127.0.0.1,localhost',
      '--ignore-certificate-errors'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(url, { waitUntil: 'load' });
  await sleep(2000);
  await page.evaluate(() => {
    const w = document.getElementById('running-from-file-warning');
    if (w) w.style.display = 'none';
    EngineLoader.load('canvas', 'OnePan');
  });
  await sleep(9000);
  await guiClick(page, 736, 210); // ENDLESS (straight from the title screen)
  await sleep(2000);
  // NO autoplay: nothing serves the food, so it piles up on the grill and
  // customers queue up — a busy frame. (With autoplay on, food is served
  // as fast as it spawns and the grill stays near-empty.)
  const t0 = Date.now();
  let best = null;
  while (Date.now() - t0 < 90000) {
    const t = await page.title();
    const m = {};
    t.split('|').forEach((p) => { const kv = p.split('='); if (kv.length === 2) m[kv[0]] = kv[1]; });
    const foods = parseInt(m.foods || '0');
    const cust = parseInt(m.customers || '0');
    if (foods >= 3 && cust >= 1) { best = t; break; }
    await sleep(500);
  }
  console.log('hero state:', best || await page.title());
  await page.screenshot({ path: path.join(__dirname, 'gpx', 'hero.png') });
  await browser.close();
})().catch((e) => { console.error('CAPTURE CRASH:', e); process.exit(2); });
