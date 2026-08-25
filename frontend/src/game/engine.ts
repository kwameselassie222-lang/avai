import { V2Level, V2Robot, V2Alien, V2Ability } from "@/src/api";

export type Lane = "left" | "center" | "right";
export type Side = "player" | "alien";
export type SoundEvent = "deploy" | "hit" | "explode" | "ability" | "win" | "lose" | "combo" | "boss" | "counter" | "resource_lost";
export type ResourceKind = "cobalt" | "nickel" | "iron" | "gold";
export type Resources = Record<ResourceKind, number>;

export type Entity = {
  id: string;
  side: Side;
  type: string;
  name: string;
  kind: "ground" | "air";
  hp: number;
  max_hp: number;
  atk: number;
  speed: number;
  range: number;
  atk_rate: number;
  atk_cooldown: number;
  lane: Lane;
  y: number;
  stun: number;
  color: string;
  size: number;
  spawn_time: number;
  last_hit_at: number;
  rage_mult?: number; // boss speed multiplier when raging
  // ==== Chess-mode ability layer ====
  category?: string;         // "light" | "heavy" | "ranged" | "support" | "swarm" | "armored" | "air" | "boss"
  shield_hits?: number;      // remaining hits absorbed at 60%
  dodge_chance?: number;     // 0..1 chance to negate incoming damage
  split_on_death?: string;   // type to spawn 2 of on death
  resurrect_chance?: number; // 0..1 revive chance once
  resurrected?: boolean;
};

// ==== Chess-mode categories & matchups ====
const ROBOT_CATEGORY: Record<string, "light" | "heavy" | "ranged" | "support"> = {
  scout: "light", drone: "light",
  tank: "heavy", titan: "heavy",
  sniper: "ranged", striker: "ranged",
  guardian: "support",
};
const ALIEN_CATEGORY: Record<string, "swarm" | "armored" | "ranged" | "air" | "boss"> = {
  crawler: "swarm", brute: "armored", spitter: "ranged", flyer: "air", hive_queen: "boss",
};
// Attacker cat -> list of defender cats it hard-counters (+50% dmg dealt, -30% dmg taken from them)
const ADVANTAGE: Record<string, string[]> = {
  ranged: ["swarm"],
  heavy:  ["ranged"],
  light:  ["armored"],
  air:    ["light"],
  swarm:  ["heavy"],       // swarms overwhelm heavies
  armored:["light"],       // heavies crush lights (mirror)
};
// Alien Commander AI: what to spawn to counter a deployed robot category
const ALIEN_COUNTER: Record<string, string> = {
  light: "flyer",       // light bots eaten by flyers
  heavy: "crawler",     // heavy bots swarmed
  ranged: "brute",      // ranged bots crushed by armor
  support: "spitter",   // support bots harassed at range
};
// Which resource each alien type "eats" from Earth on hit
const ALIEN_RESOURCE: Record<string, ResourceKind> = {
  crawler: "nickel",
  spitter: "cobalt",
  brute: "iron",
  flyer: "gold",
  hive_queen: "iron", // boss hits iron; core hit also drains random
};

const ATTACK_ENERGY_DRAIN = 0.08;      // energy drained per player-robot shot (was 0.22)
const CORE_HIT_RESOURCE_MIN = 3;
const CORE_HIT_RESOURCE_MAX = 8;
const UNIT_HIT_RESOURCE_MIN = 1;
const UNIT_HIT_RESOURCE_MAX = 3;
const REDEPLOY_PENALTY_WINDOW = 3.0;   // sec — same robot same lane costs +50%
const COUNTER_COOLDOWN = 12.0;         // alien commander responds at most every 12s (was 8)
const COUNTER_DELAY_MIN = 5.0;
const COUNTER_DELAY_MAX = 7.5;

export type Particle = {
  id: string;
  lane: Lane;
  y: number;
  color: string;
  size: number;
  born_at: number;
  ttl: number;
  kind: "explode" | "hit";
};

export type BattleState = {
  playing: boolean;
  outcome: "win" | "lose" | null;
  time: number;
  energy: number;
  energy_max: number;
  earth_hp: number;
  earth_max_hp: number;
  alien_hp: number;
  alien_max_hp: number;
  entities: Entity[];
  particles: Particle[];
  wave_index: number;
  ability_charge: number;
  overclock_until: number;
  ability_id: string;
  ability: V2Ability | null;
  target_time: number;
  robots: Record<string, V2Robot>;
  aliens: Record<string, V2Alien>;
  robot_levels: Record<string, number>;
  events: string[];
  sound_queue: SoundEvent[];
  screen_shake: number; // decays over time (0..1)
  recent_deploys: { lane: Lane; time: number }[]; // for combo tracking
  combo: { lane: Lane; time: number; count: number } | null;
  boss_intro_at: number | null; // set when boss first spawns
  boss_intro_shown: boolean;
  boss_phase: 1 | 2 | 3;
  boss_last_summon_at: number;
  boss_phase_flash_at: number; // fx trigger when phase transitions
  difficulty: "normal" | "veteran";
  surge_index: number;
  surge_flash_at: number; // fx trigger when a surge triggers
  surges: { at: number; type: string }[];
  waves: { at: number; type: string; lane: Lane }[]; // possibly-expanded per difficulty
  // ==== Resource pain economy ====
  resources: Resources;
  resources_max: Resources;
  resource_flash: Record<ResourceKind, number>; // last drain time
  resource_lost: Record<ResourceKind, boolean>; // one-shot flag when hit 0
  resource_events: { kind: ResourceKind; amount: number; time: number; lane: Lane; y: number }[];
  civilian_toll: number; // narrative counter
  // ==== Alien Commander AI ====
  counter_last_at: number;
  counter_flash_at: number;
  counter_pending: { at: number; type: string; lane: Lane } | null;
  counter_label: string;
  // ==== Lane-lock: same robot / same lane discourager ====
  lane_deploy_time: Record<string, number>; // key = `${robotId}:${lane}` -> time
};

const ENERGY_REGEN_PER_SEC = 0.9;      // was 0.4 — much faster reload
const ABILITY_CHARGE_PER_SEC = 1 / 30; // full in 30s
// ==== GLOBAL DIFFICULTY BUMP (softer so the player has room to think) ====
const GLOBAL_HP_MULT = 1.15;
const GLOBAL_ATK_MULT = 1.10;
const GLOBAL_SPEED_MULT = 1.05;
const ROBOT_COLORS: Record<string, string> = {
  scout: "#00E5FF", guardian: "#B57BFF", drone: "#00FF66", striker: "#FFB020",
  sniper: "#FF7A00", tank: "#B0B4C0", titan: "#FF3366",
};
const ALIEN_COLORS: Record<string, string> = {
  crawler: "#8AFF00", spitter: "#00E5A0", brute: "#FF3366", flyer: "#FFB020", hive_queen: "#FF00FF",
};

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function robotStats(r: V2Robot, level: number) {
  const mult = 1 + (level - 1) * 0.08;
  return {
    hp: Math.round(r.hp * mult),
    atk: Math.round(r.atk * mult),
  };
}

function queueSound(state: BattleState, s: SoundEvent) {
  state.sound_queue.push(s);
  if (state.sound_queue.length > 12) state.sound_queue.shift();
}

export function drainSounds(state: BattleState): SoundEvent[] {
  const out = state.sound_queue;
  state.sound_queue = [];
  return out;
}

export function initBattle(
  level: V2Level,
  robots: V2Robot[],
  aliens: V2Alien[],
  abilities: V2Ability[],
  _deck: string[],
  robot_levels: Record<string, number>,
  ability_id: string,
  difficulty: "normal" | "veteran" = "normal",
): BattleState {
  const rMap: Record<string, V2Robot> = {};
  robots.forEach((r) => (rMap[r.id] = r));
  const aMap: Record<string, V2Alien> = {};
  aliens.forEach((a) => (aMap[a.id] = a));

  // ==== Difficulty expansion ====
  // VETERAN: each wave gets a duplicate 1.5s later in an adjacent lane (2× density)
  const laneOrder: Lane[] = ["left", "center", "right"];
  let expandedWaves: { at: number; type: string; lane: Lane }[] = level.waves.map((w) => ({ ...w }));
  if (difficulty === "veteran") {
    const extras: { at: number; type: string; lane: Lane }[] = [];
    for (const w of level.waves) {
      const idx = laneOrder.indexOf(w.lane);
      const altLane = laneOrder[(idx + 1) % 3];
      extras.push({ at: w.at + 1.5, type: w.type, lane: altLane });
    }
    expandedWaves = [...expandedWaves, ...extras].sort((a, b) => a.at - b.at);
    // Note: alien HP/ATK scaling handled in spawnAlien via state.difficulty
  }

  return {
    playing: true,
    outcome: null,
    time: 0,
    energy: level.energy_start + 3,
    energy_max: 12,
    earth_hp: 500,
    earth_max_hp: 500,
    alien_hp: level.core_hp,
    alien_max_hp: level.core_hp,
    entities: [],
    particles: [],
    wave_index: 0,
    ability_charge: 0,
    overclock_until: 0,
    ability_id,
    ability: abilities.find((a) => a.id === ability_id) || null,
    target_time: level.target_time,
    robots: rMap,
    aliens: aMap,
    robot_levels,
    events: [],
    sound_queue: [],
    screen_shake: 0,
    recent_deploys: [],
    combo: null,
    boss_intro_at: null,
    boss_intro_shown: false,
    boss_phase: 1,
    boss_last_summon_at: 0,
    boss_phase_flash_at: -999,
    difficulty,
    surge_index: 0,
    surge_flash_at: -999,
    surges: (level.surges || []).map((s) => ({ ...s })),
    waves: expandedWaves,
    resources:     { cobalt: 100, nickel: 100, iron: 100, gold: 100 },
    resources_max: { cobalt: 100, nickel: 100, iron: 100, gold: 100 },
    resource_flash: { cobalt: -999, nickel: -999, iron: -999, gold: -999 },
    resource_lost: { cobalt: false, nickel: false, iron: false, gold: false },
    resource_events: [],
    civilian_toll: 0,
    counter_last_at: -999,
    counter_flash_at: -999,
    counter_pending: null,
    counter_label: "",
    lane_deploy_time: {},
  };
}

const COMBO_WINDOW_SEC = 4.0;
const COMBO_ENERGY_REFUND = 2;

export function deployRobot(state: BattleState, robotId: string, lane: Lane): boolean {
  if (!state.playing) return false;
  const r = state.robots[robotId];
  if (!r) return false;
  // Lane-lock penalty: same robot in same lane within window = +50% cost
  const laneKey = `${robotId}:${lane}`;
  const lastTime = state.lane_deploy_time[laneKey] ?? -999;
  const penalized = state.time - lastTime < REDEPLOY_PENALTY_WINDOW;
  const actualCost = penalized ? Math.ceil(r.cost * 1.5) : r.cost;
  if (state.energy < actualCost) return false;
  const level = state.robot_levels[robotId] || 1;
  const s = robotStats(r, level);
  state.energy -= actualCost;
  state.lane_deploy_time[laneKey] = state.time;
  const category = ROBOT_CATEGORY[r.id] || "support";
  state.entities.push({
    id: uid(), side: "player", type: r.id, name: r.name, kind: r.kind,
    hp: s.hp, max_hp: s.hp, atk: s.atk, speed: r.speed, range: r.range,
    atk_rate: r.atk_rate, atk_cooldown: 0, lane, y: 8, stun: 0,
    color: ROBOT_COLORS[r.id] || "#00E5FF", size: r.id === "titan" ? 18 : r.id === "tank" ? 16 : 12,
    spawn_time: state.time, last_hit_at: -999,
    category,
  });
  state.events.push(penalized ? `▮ ${r.name} deployed (·×1.5 cost)` : `▮ ${r.name} deployed`);
  if (state.events.length > 8) state.events.shift();
  queueSound(state, "deploy");

  // ==== Alien Commander AI: schedule counter-deploy ====
  if (state.time - state.counter_last_at > COUNTER_COOLDOWN && !state.counter_pending) {
    const counterType = ALIEN_COUNTER[category];
    if (counterType && state.aliens[counterType]) {
      const delay = COUNTER_DELAY_MIN + Math.random() * (COUNTER_DELAY_MAX - COUNTER_DELAY_MIN);
      state.counter_pending = { at: state.time + delay, type: counterType, lane };
      state.counter_last_at = state.time;
      state.counter_flash_at = state.time;
      state.counter_label = `${state.aliens[counterType]?.name || counterType.toUpperCase()} → LANE ${lane.toUpperCase()}`;
      state.events.push(`⚠ COMMANDER RESPONDS: ${state.counter_label}`);
      if (state.events.length > 8) state.events.shift();
      queueSound(state, "counter");
    }
  }

  // ---- Combo detection ----
  // Prune old deploys and add new one
  state.recent_deploys = state.recent_deploys.filter(
    (d) => state.time - d.time <= COMBO_WINDOW_SEC
  );
  state.recent_deploys.push({ lane, time: state.time });
  // Count same-lane deploys inside window
  const sameLane = state.recent_deploys.filter((d) => d.lane === lane);
  if (sameLane.length >= 3 && (!state.combo || state.combo.time < state.time - COMBO_WINDOW_SEC)) {
    // Trigger combo bonus
    state.combo = { lane, time: state.time, count: sameLane.length };
    state.energy = Math.min(state.energy_max, state.energy + COMBO_ENERGY_REFUND);
    // Buff same-lane robots for 3s (+30% atk via temporary stun-negative trick? No - directly bump atk)
    for (const e of state.entities) {
      if (e.side === "player" && e.lane === lane) {
        e.atk = Math.round(e.atk * 1.3);
      }
    }
    // Reset the deploy list so it doesn't retrigger every deploy
    state.recent_deploys = state.recent_deploys.filter((d) => d.lane !== lane);
    state.events.push(`◆ COMBO x${sameLane.length}! +${COMBO_ENERGY_REFUND}⚡ +30% ATK`);
    if (state.events.length > 8) state.events.shift();
    queueSound(state, "combo");
    // Spawn a flashy particle chain in the lane
    for (let i = 0; i < 5; i++) {
      state.particles.push({
        id: uid(), lane, y: 15 + i * 8,
        color: "#FFEE55", size: 14, born_at: state.time + i * 0.05, ttl: 0.5, kind: "hit",
      });
    }
  }
  return true;
}

function spawnAlien(state: BattleState, wave: { type: string; lane: Lane }, level: V2Level) {
  const a = state.aliens[wave.type];
  if (!a) return;
  // Global bump applies to ALL difficulties; veteran multiplies further.
  const vet = state.difficulty === "veteran" ? 1.3 : 1.0;
  const diff = level.difficulty * GLOBAL_HP_MULT * vet;
  const atkDiff = level.difficulty * GLOBAL_ATK_MULT * vet;
  const category = ALIEN_CATEGORY[a.id] || "swarm";
  const lvl = level.id;
  // Attach abilities progressively as world advances
  const shield_hits =
    (category === "armored" && lvl >= 5) ? 3 :
    (category === "swarm"   && lvl >= 6) ? 2 : undefined;
  const dodge_chance =
    (category === "ranged" && lvl >= 3) ? 0.25 :
    (category === "air"    && lvl >= 4) ? 0.2  : undefined;
  const split_on_death =
    (category === "swarm"  && lvl >= 7) ? "crawler" : undefined;
  const resurrect_chance =
    (category === "armored" && lvl >= 9) ? 0.25 :
    (category === "boss")                ? 0.35 : undefined;
  state.entities.push({
    id: uid(), side: "alien", type: a.id, name: a.name, kind: a.kind,
    hp: Math.round(a.hp * diff), max_hp: Math.round(a.hp * diff),
    atk: Math.round(a.atk * atkDiff), speed: a.speed * GLOBAL_SPEED_MULT, range: a.range,
    atk_rate: a.atk_rate, atk_cooldown: 0, lane: wave.lane, y: 92, stun: 0,
    color: ALIEN_COLORS[a.id] || "#FF00FF", size: a.boss ? 22 : a.id === "brute" ? 16 : 12,
    spawn_time: state.time, last_hit_at: -999,
    category, shield_hits, dodge_chance, split_on_death, resurrect_chance,
  });
}

// ==== Rock-Paper-Scissors matchup multiplier ====
function matchupMult(attackerCat?: string, defenderCat?: string): number {
  if (!attackerCat || !defenderCat) return 1.0;
  if ((ADVANTAGE[attackerCat] || []).includes(defenderCat)) return 1.5;
  if ((ADVANTAGE[defenderCat] || []).includes(attackerCat)) return 0.7;
  return 1.0;
}

function drainResource(state: BattleState, kind: ResourceKind, amount: number, lane: Lane, y: number) {
  const before = state.resources[kind];
  state.resources[kind] = Math.max(0, before - amount);
  const drained = before - state.resources[kind];
  if (drained <= 0) return;
  state.resource_flash[kind] = state.time;
  state.resource_events.push({ kind, amount: drained, time: state.time, lane, y });
  if (state.resource_events.length > 12) state.resource_events.shift();
  state.civilian_toll += Math.round(drained * 340); // narrative cost per resource unit
  // Depletion cascade: first time a resource hits 0 -> Earth suffers a symbolic collapse
  if (state.resources[kind] === 0 && !state.resource_lost[kind]) {
    state.resource_lost[kind] = true;
    // Earth loses 20% of its current max hp as collapse damage
    const collapse = Math.round(state.earth_max_hp * 0.20);
    state.earth_hp = Math.max(0, state.earth_hp - collapse);
    state.screen_shake = 1;
    const labels: Record<ResourceKind, string> = {
      cobalt: "COBALT MINES OVERRUN — 40,000 DISPLACED",
      nickel: "NICKEL REFINERY FALLEN — 28,000 DISPLACED",
      iron:   "IRON WORKS OVERRUN — 52,000 DISPLACED",
      gold:   "GOLD RESERVES LOST — MARKETS CRASH",
    };
    state.events.push(`☠ ${labels[kind]}`);
    if (state.events.length > 8) state.events.shift();
    queueSound(state, "resource_lost");
  }
}

function applyDamage(state: BattleState, target: Entity, dmg: number, attacker?: Entity) {
  // Dodge check (aliens only)
  if (target.side === "alien" && target.dodge_chance && Math.random() < target.dodge_chance) {
    // Miss particle
    state.particles.push({
      id: uid(), lane: target.lane, y: target.y,
      color: "#88CCFF", size: 6, born_at: state.time, ttl: 0.2, kind: "hit",
    });
    return;
  }
  // Matchup multiplier
  let finalDmg = dmg * matchupMult(attacker?.category, target.category);
  // Shield absorbs 60% of first N hits
  if (target.side === "alien" && (target.shield_hits ?? 0) > 0) {
    finalDmg *= 0.4;
    target.shield_hits = (target.shield_hits ?? 0) - 1;
  }
  const before = target.hp;
  target.hp = Math.max(0, before - finalDmg);
  target.last_hit_at = state.time;
  if (before > 0) {
    // small hit particle
    state.particles.push({
      id: uid(), lane: target.lane, y: target.y,
      color: target.side === "alien" ? "#FFEE55" : "#FF5588",
      size: 8, born_at: state.time, ttl: 0.18, kind: "hit",
    });
    queueSound(state, "hit");
  }
  if (target.hp <= 0 && before > 0) {
    // Resurrect check
    if (target.side === "alien" && !target.resurrected && target.resurrect_chance && Math.random() < target.resurrect_chance) {
      target.resurrected = true;
      target.hp = Math.round(target.max_hp * 0.35);
      state.particles.push({
        id: uid(), lane: target.lane, y: target.y,
        color: "#FF00FF", size: 22, born_at: state.time, ttl: 0.5, kind: "hit",
      });
      state.events.push(`⚠ ${target.name} REVIVED`);
      if (state.events.length > 8) state.events.shift();
      queueSound(state, "boss");
      return;
    }
    // explosion particle
    state.particles.push({
      id: uid(), lane: target.lane, y: target.y,
      color: target.side === "alien" ? "#FF3366" : "#00E5FF",
      size: Math.max(20, target.size * 2.4), born_at: state.time, ttl: 0.55, kind: "explode",
    });
    queueSound(state, "explode");
    state.screen_shake = Math.min(1, state.screen_shake + 0.35);
    // Split-on-death: spawn 2 mini units of the given type
    if (target.side === "alien" && target.split_on_death && state.aliens[target.split_on_death]) {
      const a = state.aliens[target.split_on_death];
      for (let i = 0; i < 2; i++) {
        state.entities.push({
          id: uid(), side: "alien", type: a.id, name: a.name, kind: a.kind,
          hp: Math.round(a.hp * 0.4), max_hp: Math.round(a.hp * 0.4),
          atk: Math.round(a.atk * 0.6), speed: a.speed * 1.15, range: a.range,
          atk_rate: a.atk_rate * 0.85, atk_cooldown: 0.2, lane: target.lane, y: target.y,
          stun: 0, color: ALIEN_COLORS[a.id] || "#FF00FF", size: 9,
          spawn_time: state.time, last_hit_at: -999,
          category: ALIEN_CATEGORY[a.id] || "swarm",
        });
      }
      state.events.push(`◆ ${target.name} SPLIT`);
      if (state.events.length > 8) state.events.shift();
    }
  }
}

export function tick(state: BattleState, level: V2Level, dt: number): BattleState {
  if (!state.playing) return state;
  state.time += dt;
  state.energy = Math.min(state.energy_max, state.energy + ENERGY_REGEN_PER_SEC * dt);
  state.ability_charge = Math.min(1, state.ability_charge + ABILITY_CHARGE_PER_SEC * dt);
  state.screen_shake = Math.max(0, state.screen_shake - dt * 2.0);

  // ==== Prune old resource floaters ====
  state.resource_events = state.resource_events.filter((r) => state.time - r.time < 1.2);

  // ==== Alien Commander AI: fire pending counter-deploy ====
  if (state.counter_pending && state.counter_pending.at <= state.time) {
    const cp = state.counter_pending;
    spawnAlien(state, { type: cp.type, lane: cp.lane }, level);
    state.events.push(`▮ COUNTER ${state.aliens[cp.type]?.name || cp.type.toUpperCase()} INBOUND`);
    if (state.events.length > 8) state.events.shift();
    queueSound(state, "counter");
    state.counter_pending = null;
  }

  // Spawn waves (use state.waves — potentially expanded by veteran mode)
  while (state.wave_index < state.waves.length && state.waves[state.wave_index].at <= state.time) {
    const w = state.waves[state.wave_index];
    spawnAlien(state, w, level);
    state.events.push(`▮ ${state.aliens[w.type]?.name || "?"} incoming`);
    if (state.events.length > 8) state.events.shift();
    state.wave_index++;
  }

  // ==== SURGE events (L7+): synchronized triple-lane spawn moments ====
  while (state.surge_index < state.surges.length && state.surges[state.surge_index].at <= state.time) {
    const surge = state.surges[state.surge_index];
    const laneList: Lane[] = ["left", "center", "right"];
    for (const ln of laneList) {
      spawnAlien(state, { type: surge.type, lane: ln }, level);
    }
    state.surge_flash_at = state.time;
    state.events.push(`⚠ SURGE — ${state.aliens[surge.type]?.name || surge.type.toUpperCase()} × 3`);
    if (state.events.length > 8) state.events.shift();
    state.screen_shake = Math.max(state.screen_shake, 0.6);
    queueSound(state, "boss");
    state.surge_index++;
  }

  // Spawn a boss around time 45 for boss level 10
  if (level.boss && state.time > 45 && !state.entities.some((e) => e.type === level.boss)) {
    spawnAlien(state, { type: level.boss, lane: "center" }, level);
    state.events.push(`⚠ BOSS: ${state.aliens[level.boss!]?.name}`);
    if (state.events.length > 8) state.events.shift();
    if (!state.boss_intro_shown) {
      state.boss_intro_at = state.time;
      state.boss_intro_shown = true;
      state.screen_shake = 1;
      queueSound(state, "boss");
    }
  }

  // ==== Hive Queen 3-phase behavior ====
  if (level.boss) {
    const boss = state.entities.find((e) => e.type === level.boss && e.hp > 0);
    if (boss) {
      const hpRatio = boss.hp / boss.max_hp;
      // Phase 2: 66% → +50% speed (RAGE)
      if (state.boss_phase === 1 && hpRatio <= 0.66) {
        state.boss_phase = 2;
        boss.rage_mult = 1.5;
        state.boss_phase_flash_at = state.time;
        state.events.push("⚠ HIVE QUEEN — RAGE MODE");
        if (state.events.length > 8) state.events.shift();
        state.screen_shake = Math.max(state.screen_shake, 0.7);
        queueSound(state, "boss");
        // Visual particles around queen
        for (let i = 0; i < 6; i++) {
          state.particles.push({
            id: uid(), lane: boss.lane, y: boss.y,
            color: "#FF3366", size: 22, born_at: state.time + i * 0.05, ttl: 0.6, kind: "hit",
          });
        }
      }
      // Phase 3: 33% → summons crawler swarms
      if (state.boss_phase === 2 && hpRatio <= 0.33) {
        state.boss_phase = 3;
        boss.rage_mult = 1.7;
        state.boss_phase_flash_at = state.time;
        state.boss_last_summon_at = state.time - 6; // trigger summon immediately
        state.events.push("⚠ HIVE QUEEN — SPAWNING SWARM");
        if (state.events.length > 8) state.events.shift();
        state.screen_shake = 1;
        queueSound(state, "boss");
        for (let i = 0; i < 10; i++) {
          state.particles.push({
            id: uid(), lane: boss.lane, y: boss.y,
            color: "#FF00FF", size: 26, born_at: state.time + i * 0.04, ttl: 0.7, kind: "hit",
          });
        }
      }
      // Phase 3: every 6s summon 2 crawlers in random lanes
      if (state.boss_phase === 3 && state.time - state.boss_last_summon_at >= 6) {
        state.boss_last_summon_at = state.time;
        const lanes: Lane[] = ["left", "center", "right"];
        for (let i = 0; i < 2; i++) {
          const ln = lanes[Math.floor(Math.random() * 3)];
          spawnAlien(state, { type: "crawler", lane: ln }, level);
        }
        state.events.push("◆ CRAWLER SWARM SUMMONED");
        if (state.events.length > 8) state.events.shift();
        queueSound(state, "ability");
      }
    }
  }

  const overclock = state.overclock_until > state.time;
  const boost = overclock && state.ability?.id === "overclock" ? (state.ability.boost || 0.5) : 0;

  // Move + attack
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    if (e.stun > 0) { e.stun -= dt; continue; }

    // find target: nearest opposing entity in same lane OR core
    const enemies = state.entities.filter(
      (o) => o.side !== e.side && o.hp > 0 && (o.lane === e.lane || o.kind === "air" || e.kind === "air")
    );
    let target: Entity | null = null;
    let bestDist = Infinity;
    for (const o of enemies) {
      const d = Math.abs(o.y - e.y);
      if (d < bestDist) { bestDist = d; target = o; }
    }
    // Core distance
    const coreY = e.side === "player" ? 100 : 0;
    const coreDist = Math.abs(coreY - e.y);
    const useCore = !target || coreDist < bestDist;

    if (useCore && coreDist > e.range) {
      // Move toward core
      const dir = e.side === "player" ? 1 : -1;
      e.y += dir * e.speed * (e.rage_mult || 1) * (1 + boost) * dt * 4.0;
    } else if (target && bestDist > e.range) {
      const dir = target.y > e.y ? 1 : -1;
      e.y += dir * e.speed * (e.rage_mult || 1) * (1 + boost) * dt * 4.0;
    } else {
      // Attack
      e.atk_cooldown -= dt;
      if (e.atk_cooldown <= 0) {
        const atk = e.atk * (1 + (e.side === "player" ? boost : 0));
        // ==== Attack-drain energy for player robots ====
        if (e.side === "player") {
          if (state.energy < ATTACK_ENERGY_DRAIN) {
            // No energy: robot misfires — apply slight cooldown and skip
            e.atk_cooldown = 0.4;
            continue;
          }
          state.energy = Math.max(0, state.energy - ATTACK_ENERGY_DRAIN);
        }
        if (useCore) {
          if (e.side === "player") state.alien_hp = Math.max(0, state.alien_hp - atk);
          else {
            // Alien hits Earth core: drain HP + drain a random resource
            state.earth_hp = Math.max(0, state.earth_hp - atk);
            const primary = ALIEN_RESOURCE[e.type] || "iron";
            const kinds: ResourceKind[] = ["cobalt", "nickel", "iron", "gold"];
            const pick: ResourceKind = Math.random() < 0.65 ? primary : kinds[Math.floor(Math.random() * 4)];
            const amt = Math.round(CORE_HIT_RESOURCE_MIN + Math.random() * (CORE_HIT_RESOURCE_MAX - CORE_HIT_RESOURCE_MIN));
            drainResource(state, pick, amt, e.lane, 8);
          }
          // small hit fx on core
          state.particles.push({
            id: uid(), lane: e.lane, y: e.side === "player" ? 96 : 4,
            color: e.side === "player" ? "#FF3366" : "#00E5FF",
            size: 14, born_at: state.time, ttl: 0.25, kind: "hit",
          });
          queueSound(state, "hit");
        } else if (target) {
          applyDamage(state, target, atk, e);
          // Alien hitting a player robot: drain a small amount of resource
          if (e.side === "alien" && target.side === "player") {
            const primary = ALIEN_RESOURCE[e.type] || "iron";
            const amt = Math.round(UNIT_HIT_RESOURCE_MIN + Math.random() * (UNIT_HIT_RESOURCE_MAX - UNIT_HIT_RESOURCE_MIN));
            drainResource(state, primary, amt, target.lane, target.y);
          }
        }
        e.atk_cooldown = e.atk_rate;
      }
    }
  }

  // Cleanup dead & clamp y
  state.entities = state.entities.filter((e) => e.hp > 0);
  for (const e of state.entities) e.y = Math.max(4, Math.min(96, e.y));

  // Cleanup expired particles
  state.particles = state.particles.filter((p) => state.time - p.born_at < p.ttl);

  // Check outcome
  if (state.alien_hp <= 0) {
    state.playing = false;
    state.outcome = "win";
    queueSound(state, "win");
  } else if (state.earth_hp <= 0) {
    state.playing = false;
    state.outcome = "lose";
    queueSound(state, "lose");
  } else if (state.time > 240) {
    state.playing = false;
    state.outcome = "lose";
    queueSound(state, "lose");
  }

  return state;
}

export function useAbility(state: BattleState): BattleState {
  if (!state.playing || state.ability_charge < 1 || !state.ability) return state;
  const abil = state.ability;
  state.ability_charge = 0;
  queueSound(state, "ability");
  if (abil.id === "orbital") {
    const dmg = abil.damage || 180;
    for (const e of state.entities) {
      if (e.side === "alien") applyDamage(state, e, dmg);
    }
    state.events.push("◆ ORBITAL STRIKE");
    state.screen_shake = 1;
  } else if (abil.id === "emp") {
    const s = abil.stun || 3;
    for (const e of state.entities) if (e.side === "alien") {
      e.stun = s;
      state.particles.push({
        id: uid(), lane: e.lane, y: e.y,
        color: "#88CCFF", size: 18, born_at: state.time, ttl: 0.4, kind: "hit",
      });
    }
    state.events.push("◆ EMP PULSE");
    state.screen_shake = Math.max(state.screen_shake, 0.5);
  } else if (abil.id === "repair") {
    const p = abil.heal_pct || 0.4;
    for (const e of state.entities) if (e.side === "player") {
      e.hp = Math.min(e.max_hp, e.hp + e.max_hp * p);
      state.particles.push({
        id: uid(), lane: e.lane, y: e.y,
        color: "#00FF88", size: 14, born_at: state.time, ttl: 0.5, kind: "hit",
      });
    }
    state.events.push("◆ REPAIR WAVE");
  } else if (abil.id === "overclock") {
    state.overclock_until = state.time + (abil.duration || 6);
    state.events.push("◆ OVERCLOCK");
  }
  if (state.events.length > 8) state.events.shift();
  return state;
}

export function computeStars(state: BattleState, level: V2Level): number {
  if (state.outcome !== "win") return 0;
  let stars = 1;
  // 2 stars if either earth HP > 50% OR average resources > 60%
  const avgRes = (state.resources.cobalt + state.resources.nickel + state.resources.iron + state.resources.gold) / 4;
  if (state.earth_hp / state.earth_max_hp > 0.5 || avgRes > 60) stars = 2;
  // 3 stars if time target met AND no resource fully lost AND avgRes > 40
  const anyLost = state.resource_lost.cobalt || state.resource_lost.nickel || state.resource_lost.iron || state.resource_lost.gold;
  if (state.time <= level.target_time && !anyLost && avgRes > 40) stars = Math.max(stars, 3);
  return stars;
}

// ==== Tactical Briefing: how to beat each level ====
// Returns a puzzle-style breakdown of what's coming and what counters it.
export type LevelBrief = {
  level_id: number;
  level_name: string;
  aliens: { id: string; name: string; category: string; count: number; drains: ResourceKind }[];
  counters: { alien_cat: string; alien_label: string; robot_cats: string[]; robot_ids: string[] }[];
  strategy_tips: string[];
  boss?: { id: string; name: string };
};

const CAT_TO_ROBOT_IDS: Record<string, string[]> = {
  light: ["scout", "drone"],
  heavy: ["tank", "titan"],
  ranged: ["sniper", "striker"],
  support: ["guardian"],
};

const ALIEN_CAT_LABEL: Record<string, string> = {
  swarm: "SWARM",
  armored: "ARMORED",
  ranged: "RANGED",
  air: "AIRBORNE",
  boss: "BOSS",
};

const COUNTER_MAP: Record<string, string[]> = {
  swarm: ["ranged"],       // sniper/striker melt swarms
  armored: ["light"],      // light bots strip armor
  ranged: ["heavy"],       // heavies soak spitter shots
  air: ["ranged"],         // only ranged can hit flyers
  boss: ["heavy", "ranged"],
};

export function getRobotCategory(robotId: string): string | undefined {
  return ROBOT_CATEGORY[robotId];
}
export function getAlienCategory(alienId: string): string | undefined {
  return ALIEN_CATEGORY[alienId];
}
export function getAlienCatLabel(cat: string): string {
  return ALIEN_CAT_LABEL[cat] || cat.toUpperCase();
}

export function buildLevelBrief(
  level: V2Level,
  aliens: V2Alien[],
  robots: V2Robot[],
  unlocked_ids: string[],
): LevelBrief {
  // Merge waves + boss
  const counts: Record<string, number> = {};
  for (const w of level.waves) counts[w.type] = (counts[w.type] || 0) + 1;
  if (level.boss) counts[level.boss] = (counts[level.boss] || 0) + 1;
  const aMap: Record<string, V2Alien> = {};
  aliens.forEach((a) => (aMap[a.id] = a));

  const alienRoster = Object.entries(counts).map(([id, count]) => {
    const a = aMap[id];
    const category = ALIEN_CATEGORY[id] || "swarm";
    return {
      id,
      name: a?.name || id.toUpperCase(),
      category,
      count,
      drains: ALIEN_RESOURCE[id] || "iron",
    };
  });

  // Unique alien categories
  const uniqCats = Array.from(new Set(alienRoster.map((x) => x.category)));
  const counters = uniqCats.map((cat) => {
    const robot_cats = COUNTER_MAP[cat] || ["ranged"];
    const robot_ids = robot_cats
      .flatMap((rc) => CAT_TO_ROBOT_IDS[rc] || [])
      .filter((rid) => unlocked_ids.includes(rid) && robots.some((r) => r.id === rid));
    return {
      alien_cat: cat,
      alien_label: ALIEN_CAT_LABEL[cat] || cat.toUpperCase(),
      robot_cats,
      robot_ids,
    };
  });

  const strategy_tips: string[] = [];
  const laneCount: Record<string, number> = { left: 0, center: 0, right: 0 };
  for (const w of level.waves) laneCount[w.lane]++;
  const hotLane = Object.entries(laneCount).sort((a, b) => b[1] - a[1])[0][0];
  strategy_tips.push(`Most attacks hit the ${hotLane.toUpperCase()} lane — fortify it first.`);
  if (level.boss) {
    strategy_tips.push(`Boss appears late. Save ability charge and heavy units for it.`);
  }
  if (uniqCats.includes("swarm")) {
    strategy_tips.push("Snipers > swarms. Don't send tanks to fight crawlers.");
  }
  if (uniqCats.includes("armored")) {
    strategy_tips.push("Scouts and drones chew through armored brutes fast.");
  }
  if (uniqCats.includes("ranged")) {
    strategy_tips.push("Spitters shoot from far — tanks/titans absorb their volleys.");
  }
  if (uniqCats.includes("air")) {
    strategy_tips.push("Flyers ignore lanes. Keep at least one ranged bot per lane.");
  }
  if ((level.surges || []).length > 0) {
    strategy_tips.push("Triple-lane SURGES incoming — save 5+ energy for a spread response.");
  }

  return {
    level_id: level.id,
    level_name: level.name,
    aliens: alienRoster,
    counters,
    strategy_tips,
    boss: level.boss ? { id: level.boss, name: aMap[level.boss]?.name || level.boss } : undefined,
  };
}

