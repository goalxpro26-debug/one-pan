// One Pan — capture a burst of endless frames, pick a clean busy one.
// ENDLESS (no autoplay) -> screenshot every 8s for ~64s -> verify/hero-N.png
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
  await guiClick(page, 736, 210); // ENDLESS
  await sleep(2000);
  for (let i = 1; i <= 8; i++) {
    await sleep(8000);
    const t = await page.title();
    console.log('frame ' + i + ':', t);
    await page.screenshot({ path: path.join(__dirname, 'hero-' + i + '.png') });
    if (t.includes('screen=lose')) break;
  }
  await browser.close();
})().catch((e) => { console.error('BURST CRASH:', e); process.exit(2); });
