// One Pan — probe 2: reproduce the endless pause/score path.
// PLAY -> 'a' on -> win L1 -> NEXT -> L2 -> P -> QUIT -> ENDLESS,
// then poll every 250ms, press P at 5s into endless, log transitions.
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
async function tapKey(page, key) {
  await page.keyboard.down(key); await sleep(150); await page.keyboard.up(key);
  await sleep(300);
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
  const log = (tag) => page.title().then((t) => console.log(
    ((Date.now() - t0) / 1000).toFixed(1) + 's [' + tag + ']', t));
  await guiClick(page, 568, 312); // PLAY
  await log('after PLAY');
  await tapKey(page, 'a');
  await log('after A');
  // wait for L1 win (up to 200s)
  let s = '';
  while (Date.now() - t0 < 220000) {
    s = await page.title();
    if (s.includes('screen=win') || s.includes('screen=lose')) break;
    await sleep(1000);
  }
  await log('L1 end: ' + s.split('|')[0]);
  if (!s.includes('screen=win')) { console.log('L1 NOT WON, abort'); await browser.close(); return; }
  await guiClick(page, 568, 238); // NEXT LEVEL
  await sleep(3000);
  await log('L2 started');
  await tapKey(page, 'p');
  await log('after P in L2');
  await guiClick(page, 568, 140); // QUIT TO TITLE
  await sleep(2000);
  await log('after QUIT');
  await guiClick(page, 736, 210); // ENDLESS
  await sleep(2000);
  await log('endless started');
  // poll endless for 40s; press P at ~5s and ~10s, log transitions
  let last = '';
  const e0 = Date.now();
  let p1 = false, p2 = false;
  while (Date.now() - e0 < 40000) {
    const t = await page.title();
    if (t !== last) { last = t; console.log(((Date.now() - e0) / 1000).toFixed(1) + 's [endless]', t); }
    const el = Date.now() - e0;
    if (!p1 && el > 5000) { p1 = true; await tapKey(page, 'p'); console.log('--- pressed P (1) ---'); }
    if (!p2 && el > 10000) { p2 = true; await tapKey(page, 'p'); console.log('--- pressed P (2) ---'); }
    await sleep(250);
  }
  await browser.close();
})().catch((e) => { console.error('PROBE CRASH:', e); process.exit(2); });
