-- One Pan: grill + customer logic (pure data, no GUI).
-- The view (gui#gui) owns timers and rendering; this module owns the
-- state transitions: cooking, doneness, serving, pan wear, customers.
local levels = require("main.levels")

local M = {}

function M.new(def, endless)
  local s = {
    slots = {}, customers = {}, pan = 100, seasoning = 0,
    served = 0, perfect = 0, lost = 0, streak = 0, best_streak = 0,
    rival = 0, cust_timer = 2.0, spawn_timer = 0.5, next_cust_id = 1,
    endless = endless or false, elapsed = 0,
  }
  for i = 1, def.slots do
    s.slots[i] = { food = nil, t = 0, hot = false, burnt_t = 0 }
  end
  return s
end

-- Worn pan cooks hotter: up to +80% cook speed at pan 0.
function M.cook_speed(state, def)
  local wear = 1 + (1 - state.pan / 100) * 0.8
  return def.speed * wear
end

function M.doneness(food, t)
  if t >= food.burn then return "burnt" end
  if t >= food.perfect1 then return "over" end
  if t >= food.perfect0 then return "perfect" end
  if t >= food.good0 then return "good" end
  return "under"
end

-- A food index some waiting customer wants that is not already on the grill.
function M.wanted_food(state)
  local on_grill = {}
  for _, slot in ipairs(state.slots) do
    if slot.food then on_grill[slot.food] = true end
  end
  for _, c in ipairs(state.customers) do
    if not on_grill[c.want] then return c.want end
  end
  return nil
end

-- Advance timers by dt (call in small sub-steps so doneness windows
-- cannot be skipped between slow headless frames).
-- Returns events: {type="left", cust=...} / {type="arrived"} /
-- {type="spawned", slot=i}.
function M.tick(state, def, dt)
  local events = {}
  local cs = M.cook_speed(state, def)
  for i, slot in ipairs(state.slots) do
    if slot.food then
      local mult = cs * (slot.hot and 2 or 1)
      slot.t = slot.t + dt * mult
      -- Burnt food smokes and is cleared after 4s, so a forgotten
      -- burnt dish can never stall the grill (both food types burnt
      -- = wanted_food returns nil = no new spawns = deadlock).
      if slot.t >= levels.FOODS[slot.food].burn then
        slot.burnt_t = slot.burnt_t + dt
        if slot.burnt_t > 4 then
          slot.food = nil
          slot.t = 0
          slot.hot = false
          slot.burnt_t = 0
          events[#events + 1] = { type = "burnt_cleared", slot = i }
        end
      else
        slot.burnt_t = 0
      end
    end
  end
  for i = #state.customers, 1, -1 do
    local c = state.customers[i]
    c.patience = c.patience - dt
    if c.patience <= 0 then
      table.remove(state.customers, i)
      state.lost = state.lost + 1
      state.rival = state.rival + 1
      state.streak = 0
      events[#events + 1] = { type = "left", cust = c }
    end
  end
  state.cust_timer = state.cust_timer - dt
  if state.cust_timer <= 0 then
    state.cust_timer = def.spawn
    if #state.customers < 4 then
      local want = def.foods[math.random(#def.foods)]
      local p = def.patience
      state.customers[#state.customers + 1] = {
        want = want, patience = p, max = p,
        color = math.random(4), id = state.next_cust_id,
      }
      state.next_cust_id = state.next_cust_id + 1
      events[#events + 1] = { type = "arrived" }
    end
  end
  state.spawn_timer = state.spawn_timer - dt
  if state.spawn_timer <= 0 then
    state.spawn_timer = 0.8
    for i, slot in ipairs(state.slots) do
      if not slot.food then
        local want = M.wanted_food(state)
        if want then
          slot.food = want
          slot.t = 0
          slot.hot = state.pan < 50 and math.random() < 0.4
          slot.burnt_t = 0
          events[#events + 1] = { type = "spawned", slot = i }
        end
      end
    end
  end
  return events
end

-- Try to serve the food in slot i.
-- Returns result + points. result is one of:
--   "perfect" | "good" | "over" (served, points > 0)
--   "under" (tapped too early, food wasted)
--   "burnt" (trashed)
--   "nobody" (no waiting customer wants it, food wasted)
--   "empty" (nothing in the slot)
function M.serve(state, def, i)
  local slot = state.slots[i]
  if not slot or not slot.food then return "empty", 0 end
  local food = levels.FOODS[slot.food]
  local d = M.doneness(food, slot.t)
  if d == "under" or d == "burnt" then
    slot.food = nil
    slot.t = 0
    slot.hot = false
    slot.burnt_t = 0
    return d, 0
  end
  local ci = nil
  for j, c in ipairs(state.customers) do
    if c.want == slot.food then ci = j break end
  end
  if not ci then
    slot.food = nil
    slot.t = 0
    slot.hot = false
    slot.burnt_t = 0
    return "nobody", 0
  end
  local pts
  if d == "perfect" then
    state.streak = state.streak + 1
    state.best_streak = math.max(state.best_streak, state.streak)
    state.perfect = state.perfect + 1
    pts = food.score + (state.streak - 1) * 25
  elseif d == "good" then
    state.streak = 0
    pts = food.score
  else -- over
    state.streak = 0
    pts = math.floor(food.score / 2)
  end
  table.remove(state.customers, ci)
  state.served = state.served + 1
  state.pan = math.max(0, state.pan - def.wear)
  slot.food = nil
  slot.t = 0
  slot.hot = false
  slot.burnt_t = 0
  return d, pts
end

-- Foods currently on the grill, by doneness zone.
function M.counts(state)
  local n, perfect, good, burnt = 0, 0, 0, 0
  for _, slot in ipairs(state.slots) do
    if slot.food then
      n = n + 1
      local d = M.doneness(levels.FOODS[slot.food], slot.t)
      if d == "perfect" then perfect = perfect + 1
      elseif d == "good" or d == "over" then good = good + 1
      elseif d == "burnt" then burnt = burnt + 1 end
    end
  end
  return n, perfect, good, burnt
end

return M
