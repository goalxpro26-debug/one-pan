// One Pan — capture a busy hero frame for thumbnails.
// PLAY -> ENDLESS (no autoplay, so food piles up) -> wait until the
// grill is full and the queue is busy -> screenshot verify/thumb-hero.png
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
      '--no-proxy-server', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForURL(/localhost:8907/, { timeout: 15000 }).catch(() => {});
  await sleep(9000);
  await guiClick(page, 736, 210); // ENDLESS (straight from the title screen)
  await sleep(2000);
  // Autoplay ON: customers get served (no walk-off popups), the grill
  // keeps cycling, so the frame is busy AND clean.
  await page.keyboard.down('a'); await sleep(150); await page.keyboard.up('a');
  await sleep(500);
  const t0 = Date.now();
  let best = null;
  while (Date.now() - t0 < 120000) {
    const t = await page.title();
    const m = {};
    t.split('|').forEach((p) => { const kv = p.split('='); if (kv.length === 2) m[kv[0]] = kv[1]; });
    const foods = parseInt(m.foods || '0');
    const cust = parseInt(m.customers || '0');
    const score = parseInt(m.score || '0');
    if (foods >= 3 && cust >= 2 && score >= 100) { best = t; break; }
    await sleep(500);
  }
  console.log('hero state:', best || await page.title());
  await page.screenshot({ path: path.join(__dirname, 'thumb-hero.png') });
  await browser.close();
})().catch((e) => { console.error('CAPTURE CRASH:', e); process.exit(2); });
