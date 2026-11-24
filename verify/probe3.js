// One Pan — probe 3: pause/resume reliability in L1.
// PLAY -> wait 5s -> P (pause) -> settle 3s -> read -> P (resume) ->
// poll 15s logging paused/time transitions.
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const path = require('path');
const url = process.argv[2];
const W = 1136, H = 640;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function guiClick(page, x, y) {
  await page.mouse.move(x, H - y);
  await page.mouse.down(); await sleep(800); await page.mouse.up(); await sleep(400);
}
async function tapKey(page, key) {
  await page.keyboard.down(key); await sleep(150); await page.keyboard.up(key);
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
  const t0 = Date.now();
  await guiClick(page, 568, 312);
  console.log('PLAY done,', await page.title());
  await sleep(5000);
  console.log('before P1,', await page.title());
  await tapKey(page, 'p');
  console.log('P1 tapped');
  for (let i = 0; i < 12; i++) { await sleep(500); console.log('+' + (0.5 * (i + 1)) + 's', await page.title()); }
  await tapKey(page, 'p');
  console.log('P2 tapped');
  for (let i = 0; i < 20; i++) { await sleep(500); console.log('+' + (0.5 * (i + 1)) + 's', await page.title()); }
  await browser.close();
})().catch((e) => { console.error('PROBE CRASH:', e); process.exit(2); });
