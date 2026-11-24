# One Pan

An original food-court grill-timing game for GameDistribution (HTML5),
built with Defold 1.14.0. Game 7 of the GD factory queue. Landscape
1136x640. Category: Casual.

## The game

One grill, seen from straight above. Food lands on the grill; each piece
has a doneness bar with a green PERFECT window. Tap a piece in its window
to serve it to the customer who ordered it. Tap too early and it is
underdone; too late and it is burnt — both get wasted. Every dish wears
the PAN out: a worn pan cooks faster and grows HOT SPOTS that burn food
twice as fast. Tap SEASON PAN to fix it — but food keeps cooking while
you season. Customers who wait too long walk off to the RIVAL stall
across the court.

- **12 levels** with missions: serve N customers, reach a score target,
  or serve N PERFECT dishes while losing at most K customers. Stars
  (1–3) by score; progress saved.
- **Endless mode**: customers keep coming; 3 walk-offs ends the run,
  best score saved.
- **Controls**: mouse / touch (tap food, tap SEASON PAN, tap buttons),
  keyboard (1-6 serve a grill slot, S/Space season, P/Esc pause).
  Hidden verification aid: press **A** to toggle an auto-play bot
  (serves perfect foods, trashes burnt ones, seasons a worn pan), and
  **U** on the title screen to unlock all levels.
- **Audio**: 11 synthesized SFX + 2 music loops, all generated locally
  by `tools/synth_audio.py` (numpy, no AI audio, no downloads).
- **Art**: all sprites drawn in code by `tools/make_art.py` (PIL, no AI
  images, no copied assets). 5 original top-down food icons (sausage,
  steak, corn, fish, patty), 4 customer characters, a cast-iron pan,
  neon stall sign background, bright 2D cartoon style.
- **Animations**: food spawn pop-in, serve bursts, smoke on burnt food,
  score popups, perfect streaks, customer walk-in/walk-off, pan season
  progress, confetti on win, tweened panels (gui.animate).

## GameDistribution SDK

- Extension vendored locally under `gamedistribution/` (bob cannot fetch
  the zip through the egress proxy) + `[library] include_dirs =
  gamedistribution` in `game.project`.
- `game.project` has `[gamedistribution] game_id = PLACEHOLDER` — the
  parent fills the real HEX Game ID from the portal Upload tab before
  upload.
- Ads only on user input: pre-roll interstitial on the first Play tap,
  interstitial when the player taps Next on a level-complete screen.
- `SDK_GAME_PAUSE` pauses the game + mutes audio; `SDK_GAME_START` /
  `CONTENT_RESUME_REQUESTED` resumes + unmutes; `SDK_ERROR` / `AD_ERROR`
  / `AD_SDK_CANCELED` also resume if ad-paused (ad-error resume fix,
  copied from Pocket Escape's gd_ads.lua — never ship the old
  pause-only listener). `show_play` resets `user_paused` (stale-pause
  fix). All `gdsdk` calls are guarded (`if gdsdk then`) so the game
  runs fine with no SDK / no network.

## Building (this VM)

```bash
# start the extender reverse proxy (once per VM boot)
setsid nohup python3 ~/workspace/tools/extender-reverse-proxy.py \
  >/tmp/extender-rproxy.log 2>&1 &
cd ~/workspace/defold/projects/one-pan
export JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true \
  -Djavax.net.ssl.trustStore=$HOME/workspace/tools/egress-truststore.jks \
  -Djavax.net.ssl.trustStorePassword=changeit"
~/workspace/defold/run-bob.sh --build-server http://127.0.0.1:8080 \
  --platform wasm-web --variant release --archive \
  --bundle-output dist/html5 resolve build bundle
# -> dist/html5/One Pan/  (~8 MB)
```

HTML5 platform is `wasm-web` (not `js-web`). Engine artifacts are
pre-seeded in `~/workspace/defold/bob-root/wasm_pthread-web/`. The
egress-proxy CA rotates: rebuild `egress-truststore.jks` from
`/run/hatch/egress-tls/ca-bundle.pem` (last cert only) if extender builds
start failing with PKIX errors.

## Verifying

The game reports live state in `document.title`
(`ONEPAN|screen=...|score=...|served=...|pan=...|serve=x,y|early=x,y|
burnt=x,y|...`) which the verify script polls. Screenshots land in
`verify/`.

```bash
# serve the bundle on port 8907, then:
node verify/verify.js \
  "file:///home/hatch/workspace/defold/projects/one-pan/verify/redirect.html"
# (redirect.html navigates to http://localhost:8907/index.html)
```

**Headless-verification gotchas (carry over from the other games):**
1. Defold HTML5 input is **polled once per engine frame**; headless
   SwiftShader runs at a few FPS, so quick clicks fall between frames.
   Use **held inputs** (down, hold ~800 ms, up).
2. Input action x/y are in **GUI space (origin bottom-left, y up)**,
   but Playwright clicks in **page space (origin top-left, y down)**.
   A GUI point (x, y) in this 1136x640 game must be clicked at page
   (x, 640 - y).
3. Canvas blankness: decode the screenshot PNG and count distinct
   colors (drawImage returns blank without preserveDrawingBuffer).
4. `bob` without a command only **builds**; the bundle is written only
   when the `bundle` command is passed.
5. Grill timers run in 0.25s sub-steps in `update`, so doneness
   windows cannot be skipped between slow headless frames.

## Files

- `main/` — `game.script` (controller/save/GD/music), `gui.gui_script`
  (all screens, grill rendering, input, animations), `grill.lua` (pure
  grill + customer logic), `levels.lua` (12 levels + endless),
  `audio.lua`
- `art/` — PIL-drawn PNGs + `atlas.atlas`
- `audio/` — synthesized WAVs + `.sound` files + `audio.go`
- `tools/` — `make_art.py`, `synth_audio.py`
- `input/game.input_binding` — mouse + touch + keyboard
- `verify/` — Playwright verification script + screenshots
