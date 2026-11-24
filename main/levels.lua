-- One Pan: food definitions + level definitions + mission text.
-- Doneness zones per food (seconds of cooking):
--   underdone:  t < good0        (tap wastes the food)
--   good:       good0 <= t < perfect0  (served, base points)
--   perfect:    perfect0 <= t <= perfect1 (served, bonus + streak)
--   overdone:   perfect1 < t < burn (served, half points)
--   burnt:      t >= burn        (tap trashes it)
-- Mission types: "serve" (serve N customers), "score" (reach a score
-- target), "perfect" (serve N perfect dishes, lose at most max_lost).
local M = {}

M.FOODS = {
  { id = "sausage", name = "Sausage", cook = 6,
    good0 = 3.0, perfect0 = 4.5, perfect1 = 6.5, burn = 9, score = 100 },
  { id = "steak", name = "Steak", cook = 10,
    good0 = 6.0, perfect0 = 8.0, perfect1 = 12.0, burn = 16, score = 140 },
  { id = "corn", name = "Corn", cook = 14,
    good0 = 8.0, perfect0 = 11.0, perfect1 = 15.0, burn = 20, score = 160 },
  { id = "fish", name = "Fish", cook = 5,
    good0 = 2.5, perfect0 = 3.5, perfect1 = 5.5, burn = 8, score = 120 },
  { id = "patty", name = "Patty", cook = 8,
    good0 = 5.0, perfect0 = 6.5, perfect1 = 9.5, burn = 13, score = 130 },
}

-- slots: grill slots. foods: indices into FOODS available this level.
-- speed: global cook-speed multiplier. patience: customer patience (s).
-- spawn: seconds between new customers. wear: pan condition lost per
-- served dish. season: seconds a re-season takes. time: level time limit.
-- stars: score thresholds for 1/2/3 stars at win.
M.LEVELS = {
  { slots = 4, foods = { 1, 2 }, speed = 1.00, patience = 35, spawn = 5.0,
    wear = 6, season = 2.5, time = 120,
    mission = { type = "serve", count = 6, text = "Serve 6 customers!" },
    stars = { 500, 800, 1100 } },
  { slots = 4, foods = { 1, 2 }, speed = 1.05, patience = 32, spawn = 5.0,
    wear = 7, season = 2.5, time = 120,
    mission = { type = "serve", count = 7, text = "Serve 7 customers!" },
    stars = { 600, 950, 1300 } },
  { slots = 4, foods = { 1, 2, 3 }, speed = 1.10, patience = 30, spawn = 4.5,
    wear = 7, season = 2.5, time = 150,
    mission = { type = "score", target = 1200, text = "Score 1,200 points" },
    stars = { 1200, 1600, 2000 } },
  { slots = 5, foods = { 1, 2, 3 }, speed = 1.15, patience = 30, spawn = 4.5,
    wear = 8, season = 2.5, time = 150,
    mission = { type = "serve", count = 8, text = "Serve 8 customers!" },
    stars = { 800, 1200, 1600 } },
  { slots = 5, foods = { 1, 2, 3 }, speed = 1.20, patience = 28, spawn = 4.0,
    wear = 8, season = 2.5, time = 150,
    mission = { type = "perfect", count = 6, max_lost = 1,
                text = "Serve 6 PERFECT dishes (lose at most 1)!" },
    stars = { 700, 1000, 1400 } },
  { slots = 5, foods = { 1, 2, 3, 4 }, speed = 1.20, patience = 28, spawn = 4.0,
    wear = 9, season = 2.5, time = 150,
    mission = { type = "serve", count = 9, text = "Serve 9 customers!" },
    stars = { 900, 1400, 1900 } },
  { slots = 5, foods = { 1, 2, 3, 4 }, speed = 1.25, patience = 26, spawn = 4.0,
    wear = 9, season = 2.5, time = 180,
    mission = { type = "score", target = 2000, text = "Score 2,000 points" },
    stars = { 2000, 2600, 3200 } },
  { slots = 6, foods = { 1, 2, 3, 4 }, speed = 1.30, patience = 26, spawn = 3.5,
    wear = 9, season = 2.5, time = 180,
    mission = { type = "serve", count = 10, text = "Serve 10 customers!" },
    stars = { 1000, 1600, 2200 } },
  { slots = 6, foods = { 1, 2, 3, 4 }, speed = 1.30, patience = 24, spawn = 3.5,
    wear = 10, season = 2.5, time = 180,
    mission = { type = "perfect", count = 8, max_lost = 2,
                text = "Serve 8 PERFECT dishes (lose at most 2)!" },
    stars = { 900, 1400, 1900 } },
  { slots = 6, foods = { 1, 2, 3, 4, 5 }, speed = 1.35, patience = 24, spawn = 3.5,
    wear = 10, season = 2.5, time = 180,
    mission = { type = "serve", count = 12, text = "Serve 12 customers!" },
    stars = { 1200, 1800, 2500 } },
  { slots = 6, foods = { 1, 2, 3, 4, 5 }, speed = 1.40, patience = 22, spawn = 3.0,
    wear = 10, season = 2.5, time = 210,
    mission = { type = "score", target = 3200, text = "Score 3,200 points" },
    stars = { 3200, 4000, 4800 } },
  { slots = 6, foods = { 1, 2, 3, 4, 5 }, speed = 1.45, patience = 22, spawn = 3.0,
    wear = 11, season = 2.5, time = 210,
    mission = { type = "serve", count = 14, text = "Serve 14 customers!" },
    stars = { 1400, 2100, 2800 } },
}

M.ENDLESS = { slots = 5, foods = { 1, 2, 3, 4, 5 }, speed = 1.20,
  patience = 25, spawn = 4.0, wear = 8, season = 2.5, time = 0,
  mission = { type = "endless", text = "Serve the crowd - 3 walk-offs ends it!" },
  stars = { 0, 0, 0 } }

function M.get(n)
  return M.LEVELS[math.max(1, math.min(#M.LEVELS, n))]
end

function M.food(id_or_index)
  if type(id_or_index) == "number" then return M.FOODS[id_or_index] end
  for _, f in ipairs(M.FOODS) do
    if f.id == id_or_index then return f end
  end
  return M.FOODS[1]
end

return M
