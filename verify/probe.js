// One Pan — focused probe: poll document.title every 250ms and log every
// distinct state, so we can see exactly what serve/good/early/burnt do
// over time. Usage: node probe.js <url>
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const path = require('path');
const url = process.argv[2];
const W = 1136, H = 640;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function guiClick(page, x, y) {
  await page.mouse.move(x, H - y);
  await page.mouse.down();
  await sleep(800);
  await page.mouse.up();
  await sleep(400);
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
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForURL(/localhost:8907/, { timeout: 15000 }).catch(() => {});
  await sleep(9000);
  console.log('title:', await page.title());
  await guiClick(page, 568, 312); // PLAY
  const t0 = Date.now();
  let last = '';
  console.log('--- phase 1: no input, 45s ---');
  while (Date.now() - t0 < 45000) {
    const t = await page.title();
    if (t !== last) {
      last = t;
      console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', t);
    }
    await sleep(250);
  }
  console.log('--- phase 2: press A (autoplay), 40s ---');
  await page.keyboard.down('a'); await sleep(800); await page.keyboard.up('a');
  while (Date.now() - t0 < 85000) {
    const t = await page.title();
    if (t !== last) {
      last = t;
      console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', t);
    }
    await sleep(250);
  }
  await page.screenshot({ path: path.join(__dirname, 'probe-end.png') });
  await browser.close();
})().catch((e) => { console.error('PROBE CRASH:', e); process.exit(2); });
