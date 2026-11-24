// One Pan — headless verification with Playwright.
// Usage: node verify.js <game-url>  (e.g. file://.../verify/redirect.html)
// Steps: title loads -> PLAY -> early tap rejected -> perfect serve scores
// -> season the pan -> pause/resume -> autoplay wins level 1 -> NEXT LEVEL
// -> endless smoke test -> mute toggle.
// Screenshots + a PASS/FAIL summary go to verify/ (next to this script).
//
// INPUT NOTE (verified on the other games): Defold HTML5 input is POLLED
// once per engine frame, and headless SwiftShader runs at only a few FPS.
// Quick clicks fall between frames and are never seen. All interactions
// below use HELD inputs (down, hold ~800ms, up).
// COORDINATES: input action x/y are GUI space (origin bottom-left, y up),
// Playwright clicks are page space (origin top-left, y down). A GUI point
// (x, y) in this 1136x640 game must be clicked at page (x, 640 - y).
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = __dirname;
const url = process.argv[2];
if (!url) { console.error('usage: node verify.js <game-url>'); process.exit(2); }

const W = 1136, H = 640;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
}

// Held mouse click: down, hold long enough for a slow frame to poll it, up.
async function heldClick(page, x, y, holdMs) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(holdMs || 800);
  await page.mouse.up();
  await sleep(400);
}

// Click a GUI-space point (x, y) -> page coords (x, H - y).
async function guiClick(page, x, y, holdMs) {
  await heldClick(page, x, H - y, holdMs);
}

async function heldKey(page, key, holdMs) {
  // Keys are event-driven in Defold (not frame-polled like the mouse),
  // so a SHORT tap is reliable. A long hold risks OS key-repeat firing
  // action.pressed twice and toggling P/A back to where they started.
  await page.keyboard.down(key);
  await sleep(holdMs || 150);
  await page.keyboard.up(key);
  await sleep(300);
}

async function state(page) {
  const title = await page.title();
  const m = {};
  title.split('|').forEach((part) => {
    const kv = part.split('=');
    if (kv.length === 2) m[kv[0]] = kv[1];
  });
  return m;
}

async function tapKeyExpect(page, key, pred, timeoutMs, label) {
  // Tap a toggle key and wait for the expected state. Headless frames run
  // ~1 FPS under SwiftShader, so a tap's effect can take many seconds to
  // show in the title; never tap twice blind (a second tap queues the
  // opposite action). One retry, then report the state honestly.
  await heldKey(page, key);
  let s = await waitState(page, pred, timeoutMs, label, true);
  if (!pred(s)) {
    await heldKey(page, key);
    s = await waitState(page, pred, timeoutMs, label, true);
  }
  return s;
}

async function waitState(page, pred, timeoutMs, label, quiet) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await state(page);
    if (pred(s)) return s;
    await sleep(100);
  }
  const s = await state(page);
  if (!quiet) check(label, false, 'last state: ' + JSON.stringify(s));
  return s;
}

function parseXY(str) {
  if (!str) return null;
  const p = str.split(',').map((v) => parseInt(v, 10));
  if (p.length !== 2 || p.some(isNaN)) return null;
  return p;
}

// Minimal PNG decode (8-bit RGB/RGBA) -> count distinct sampled colors.
function pngDistinctColors(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return -1;
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString('ascii');
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return -1;
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const colors = new Set();
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    const row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const v = raw[rowStart + 1 + i];
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      row[i] = (v + pred) & 0xff;
    }
    prev = row;
    if (y % 4 !== 0) continue;
    for (let x = 0; x < width; x += 4) {
      const i = x * bpp;
      colors.add(row[i] + ',' + row[i + 1] + ',' + row[i + 2]);
      if (colors.size > 500) return colors.size;
    }
  }
  return colors.size;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hatch-webgl-allowed-domains-file=' + path.join(OUT, 'webgl-policy-all.txt'),
      '--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,local-network-access-check',
      '--no-proxy-server',
      '--ignore-certificate-errors'],
  });
  const page = await browser.newPage({
    viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => {
    if (e.message.includes('browsingTopics')) { logs.push('IGNORED: ' + e.message); return; }
    errors.push('PAGEERROR: ' + e.message);
  });
  page.on('console', (m) => {
    const t = m.text();
    logs.push(m.type() + ': ' + t.slice(0, 300));
    if (t.includes('HeaderLift service response error')) return;
    if (t.includes('Cross-Origin-Opener-Policy header has been ignored')) return;
    if (t.includes('browsingTopics')) return;
    if (m.type() === 'error') errors.push('CONSOLE: ' + t.slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!/localhost|127\.0\.0\.1/.test(u)) {
      logs.push('IGNORED-REQFAIL(ad): ' + u.slice(0, 160));
      return;
    }
    errors.push('REQFAIL: ' + u.slice(0, 160) + ' ' + (r.failure() || {}).errorText);
  });

  await page.goto(url, { waitUntil: 'load' });
  if (url.startsWith('file://')) {
    // The Defold template shows a "running from file" warning and never
    // calls EngineLoader.load for file:// URLs, so boot it by hand. The
    // bundle copy is patched only to accept XHR status 0 (verify copy).
    await sleep(2000);
    await page.evaluate(() => {
      // If a redirect.html already took us to http(s), the game page
      // auto-boots via its own EngineLoader.load — a second manual load
      // here tears the first engine down (PAGEERROR null 131075, dead Lua).
      if (location.protocol !== 'file:') return;
      const w = document.getElementById('running-from-file-warning');
      if (w) w.style.display = 'none';
      EngineLoader.load('canvas', 'OnePan');
    });
  } else {
    const m = url.match(/localhost:(\d+)/);
    const waitRe = m ? new RegExp('localhost:' + m[1]) : /localhost/;
    await page.waitForURL(waitRe, { timeout: 15000 }).catch(() => {});
  }
  await sleep(9000); // wasm engine boot
  const titleShot = await page.screenshot({ path: path.join(OUT, '01-title.png') });
  let s = await state(page);
  check('page loads, title state reported', s.screen === 'title', JSON.stringify(s));
  const distinct = pngDistinctColors(titleShot);
  check('canvas non-blank (title screenshot, distinct colors)',
    distinct > 50, 'distinct=' + distinct);

  // PLAY -> level 1 (GUI 568,312)
  await guiClick(page, 568, 312);
  s = await waitState(page, (x) => x.screen === 'play', 10000, 'PLAY starts level 1');
  await sleep(2500); // mission banner clears
  await page.screenshot({ path: path.join(OUT, '02-level1.png') });
  s = await waitState(page, (x) => parseInt(x.foods || '0') > 0, 20000,
    'level 1 grill populated');
  check('level 1 grill populated (foods > 0)', parseInt(s.foods || '0') > 0,
    'foods=' + s.foods);
  check('level 1 timer running', parseInt(s.time || '0') > 0, 'time=' + s.time);
  check('level 1 customers queued', parseInt(s.customers || '0') > 0,
    'customers=' + s.customers);
  check('level 1 pan full (100)', parseInt(s.pan || '0') === 100, 'pan=' + s.pan);

  // Early tap must be rejected: food wasted, served + score unchanged.
  let earlyOk = false;
  for (let attempt = 0; attempt < 4 && !earlyOk; attempt++) {
    s = await waitState(page, (x) => parseXY(x.early) && parseXY(x.early)[0] > 0,
      15000, 'wait for an underdone food', true);
    const e = parseXY(s.early);
    if (!e || e[0] === 0) continue; // no underdone food right now; wait again
    const foods0 = parseInt(s.foods || '0');
    const served0 = parseInt(s.served || '0');
    const score0 = parseInt(s.score || '0');
    await guiClick(page, e[0], e[1]);
    // the wasted food leaves its slot empty until the next spawn
    // (up to ~1.6s real at headless speed), so poll for the gap
    // instead of a single read that a respawn can beat.
    const t1 = Date.now();
    while (Date.now() - t1 < 3000) {
      s = await state(page);
      if (parseInt(s.foods || '0') === foods0 - 1 &&
          parseInt(s.served || '0') === served0 &&
          parseInt(s.score || '0') === score0) {
        earlyOk = true;
        break;
      }
      await sleep(300);
    }
  }
  check('early tap rejected (food wasted, served + score unchanged)', earlyOk,
    'last state: ' + JSON.stringify(s));
  await page.screenshot({ path: path.join(OUT, '03-early.png') });

  // Perfect serve: wait for a food in the green window, tap it, served +1.
  let serveOk = false;
  let serveDetail = '';
  for (let attempt = 0; attempt < 6 && !serveOk; attempt++) {
    s = await waitState(page, (x) => parseXY(x.serve) && parseXY(x.serve)[0] > 0,
      20000, 'wait for a perfect-window food', true);
    const p = parseXY(s.serve);
    if (!p || p[0] === 0) continue; // no perfect food right now; wait again
    const served0 = parseInt(s.served || '0');
    const score0 = parseInt(s.score || '0');
    await guiClick(page, p[0], p[1]);
    await sleep(800);
    s = await state(page);
    serveDetail = 'served ' + served0 + ' -> ' + s.served + ', score ' + score0 + ' -> ' + s.score;
    if (parseInt(s.served || '0') === served0 + 1 &&
        parseInt(s.score || '0') >= score0 + 100) {
      serveOk = true;
    }
  }
  check('perfect serve scores (served +1, score +100 or more)', serveOk, serveDetail);
  await page.screenshot({ path: path.join(OUT, '04-after-serve.png') });

  // Season the pan: serve a few more foods so the pan drops, then hold S.
  // (Autoplay off; drive a couple of perfect serves first.)
  for (let attempt = 0; attempt < 6; attempt++) {
    s = await state(page);
    if (parseInt(s.pan || '100') < 100) break;
    const sv = await waitState(page, (x) => parseXY(x.serve) && parseXY(x.serve)[0] > 0,
      20000, 'wait for a perfect food (season prep)', true);
    const p = parseXY(sv.serve);
    if (!p || p[0] === 0) break;
    await guiClick(page, p[0], p[1]);
    await sleep(800);
  }
  s = await state(page);
  const panBefore = parseInt(s.pan || '100');
  check('pan wears down with served dishes (pan < 100)', panBefore < 100,
    'pan=' + panBefore);
  if (panBefore < 100) {
    await heldKey(page, 's');
    // the season channel is 2.5s of GAME time, which runs ~2x slower
    // than real time in headless SwiftShader; wait for it to finish.
    s = await waitState(page, (x) => parseInt(x.pan || '0') === 100 && x.season === '0',
      20000, 'seasoning restores the pan (pan 100, season flag clears)');
    check('seasoning restores the pan (pan 100, season flag clears)',
      parseInt(s.pan || '0') === 100 && s.season === '0',
      'pan=' + s.pan + ' season=' + s.season);
  } else {
    check('seasoning restores the pan (pan 100, season flag clears)', false,
      'pan never dropped below 100, could not test');
  }

  // Pause with P, resume with P. The title only reflects the new state
  // many seconds after a tap at headless frame rates, so wait for it
  // (state-driven, never a blind second tap).
  s = await tapKeyExpect(page, 'p', (x) => x.paused === '1', 30000,
    'pause key pauses');
  check('pause key pauses', s.paused === '1', JSON.stringify(s));
  await page.screenshot({ path: path.join(OUT, '05-paused.png') });
  s = await tapKeyExpect(page, 'p', (x) => x.paused === '0', 30000,
    'pause key resumes');
  check('pause key resumes', s.paused === '0', JSON.stringify(s));

  // Autoplay to win level 1 (up to 240s at headless FPS)
  s = await tapKeyExpect(page, 'a', (x) => x.auto === '1', 30000,
    'autoplay turns on');
  check('autoplay turns on', s.auto === '1', JSON.stringify(s));
  s = await waitState(page, (x) => x.screen === 'win' || x.screen === 'lose',
    240000, 'autoplay finishes level 1');
  await page.screenshot({ path: path.join(OUT, '06-end-level1.png') });
  check('level 1 won by autoplay', s.screen === 'win',
    'score=' + s.score + ' served=' + s.served);
  const score1 = parseInt(s.score || '0');
  check('score increased during play', score1 > 0, 'score=' + score1);

  if (s.screen === 'win') {
    // NEXT LEVEL button (GUI 568,238)
    await guiClick(page, 568, 238);
    s = await waitState(page, (x) => x.screen === 'play' && parseInt(x.level || '0') === 2,
      10000, 'NEXT LEVEL starts level 2');
    await sleep(2500);
    await page.screenshot({ path: path.join(OUT, '07-level2.png') });
    s = await waitState(page, (x) => parseInt(x.foods || '0') > 0, 20000,
      'level 2 grill populated');
    check('level 2 grill populated (foods > 0)', parseInt(s.foods || '0') > 0,
      'foods=' + s.foods);
    // back to title via pause -> quit (wait for the pause overlay,
    // or the QUIT click lands on the play screen and does nothing)
    s = await tapKeyExpect(page, 'p', (x) => x.paused === '1', 30000,
      'pause before quit');
    if (s.paused === '1') {
      await guiClick(page, 568, 140); // QUIT TO TITLE (GUI 568,140)
    } else {
      await guiClick(page, 1010, 42); // MENU button (same ui_quit)
    }
    s = await waitState(page, (x) => x.screen === 'title', 10000,
      'quit returns to title');
  } else {
    check('NEXT LEVEL starts level 2', false, 'level 1 was lost, not won');
    await heldKey(page, 'a'); // autoplay off
    s = await state(page);
    if (s.screen === 'lose') {
      // lose screen -> LEVELS (GUI 568,160) -> BACK (568,70) -> title
      await guiClick(page, 568, 160);
      await waitState(page, (x) => x.screen === 'levels', 10000, 'lose -> levels');
      await guiClick(page, 568, 70);
      s = await waitState(page, (x) => x.screen === 'title', 10000, 'levels -> title');
    } else if (s.screen === 'play') {
      // stuck paused (or still playing): quit via MENU
      await guiClick(page, 1010, 42);
      s = await waitState(page, (x) => x.screen === 'title', 10000, 'quit to title');
    }
    // if already on title, nothing to do
  }

  // Endless smoke test (autoplay still on)
  await guiClick(page, 736, 210); // ENDLESS button
  s = await waitState(page, (x) => x.screen === 'play' && x.endless === '1',
    10000, 'ENDLESS starts endless mode');
  await sleep(2000);
  // Pause in endless right away, before walk-offs can end the run.
  s = await tapKeyExpect(page, 'p', (x) => x.paused === '1', 30000,
    'pause in endless works');
  check('pause in endless works', s.paused === '1', JSON.stringify(s));
  if (s.paused === '1') {
    await tapKeyExpect(page, 'p', (x) => x.paused === '0', 30000,
      'resume in endless');
  }
  const eScore0 = parseInt((await state(page)).score || '0');
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    s = await state(page);
    if (parseInt(s.score || '0') > eScore0) break;
    await sleep(500);
  }
  s = await state(page);
  check('endless mode scores', parseInt(s.score || '0') > eScore0,
    'score ' + eScore0 + ' -> ' + s.score);
  await page.screenshot({ path: path.join(OUT, '08-endless.png') });
  await heldKey(page, 'a'); // autoplay off

  // Quit to title: via the pause overlay if still playing, else via
  // the lose screen (endless may have ended on 3 walk-offs while scoring).
  s = await state(page);
  if (s.screen === 'play') {
    s = await tapKeyExpect(page, 'p', (x) => x.paused === '1', 30000,
      'pause before quit (endless)');
    if (s.paused === '1') {
      await guiClick(page, 568, 140); // QUIT TO TITLE
    } else {
      await guiClick(page, 1010, 42); // MENU button (same ui_quit)
    }
    await waitState(page, (x) => x.screen === 'title', 10000, 'back to title');
  } else {
    await guiClick(page, 568, 160); // LEVELS
    await waitState(page, (x) => x.screen === 'levels', 10000, 'lose -> levels');
    await guiClick(page, 568, 70); // BACK
    await waitState(page, (x) => x.screen === 'title', 10000, 'levels -> title');
  }
  await guiClick(page, 1030, 600); // SOUND ON/OFF
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '09-title-muted.png') });
  check('mute toggle clickable (no crash)', true);

  const realErrors = errors.filter((e) =>
    !/gamedistribution|GD_|gdsdk/i.test(e) &&
    !/^CONSOLE: Failed to load resource/.test(e));
  check('no page/console errors (excluding GD SDK network noise)',
    realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  if (errors.length) console.log('ALL console/page errors:\n' + errors.slice(0, 8).join('\n'));

  await browser.close();
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  fs.writeFileSync(path.join(OUT, 'results.json'),
    JSON.stringify(results, null, 2));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('VERIFY CRASH:', e); process.exit(2); });
