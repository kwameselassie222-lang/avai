import { V2Level, V2Robot, V2Alien, V2Ability } from "@/src/api";

export type Lane = "left" | "center" | "right";
export type Side = "player" | "alien";

export type Entity = {
  id: string;
  side: Side;
  type: string;        // robot_id or alien_id
  name: string;
  kind: "ground" | "air";
  hp: number;
  max_hp: number;
  atk: number;
  speed: number;       // units per sec
  range: number;       // effective attack distance
  atk_rate: number;    // seconds between attacks
  atk_cooldown: number;
  lane: Lane;
  y: number;           // 0 (player base) → 100 (alien base)
  stun: number;        // seconds of stun remaining
  color: string;
  size: number;
};

export type BattleState = {
  playing: boolean;
  outcome: "win" | "lose" | null;
  time: number;               // seconds elapsed
  energy: number;
  energy_max: number;
  earth_hp: number;
  earth_max_hp: number;
  alien_hp: number;
  alien_max_hp: number;
  entities: Entity[];
  wave_index: number;
  ability_charge: number;     // 0..1
  overclock_until: number;    // time when overclock ends
  ability_id: string;
  ability: V2Ability | null;
  target_time: number;
  robots: Record<string, V2Robot>;
  aliens: Record<string, V2Alien>;
  robot_levels: Record<string, number>;
  events: string[];
};

const ENERGY_REGEN_PER_SEC = 0.5;
const ABILITY_CHARGE_PER_SEC = 1 / 30; // full in 30s
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

export function initBattle(
  level: V2Level,
  robots: V2Robot[],
  aliens: V2Alien[],
  abilities: V2Ability[],
  deck: string[],
  robot_levels: Record<string, number>,
  ability_id: string,
): BattleState {
  const rMap: Record<string, V2Robot> = {};
  robots.forEach((r) => (rMap[r.id] = r));
  const aMap: Record<string, V2Alien> = {};
  aliens.forEach((a) => (aMap[a.id] = a));
  return {
    playing: true,
    outcome: null,
    time: 0,
    energy: level.energy_start,
    energy_max: 10,
    earth_hp: 500,
    earth_max_hp: 500,
    alien_hp: level.core_hp,
    alien_max_hp: level.core_hp,
    entities: [],
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
  };
}

export function deployRobot(state: BattleState, robotId: string, lane: Lane): boolean {
  if (!state.playing) return false;
  const r = state.robots[robotId];
  if (!r) return false;
  if (state.energy < r.cost) return false;
  const level = state.robot_levels[robotId] || 1;
  const s = robotStats(r, level);
  state.energy -= r.cost;
  state.entities.push({
    id: uid(), side: "player", type: r.id, name: r.name, kind: r.kind,
    hp: s.hp, max_hp: s.hp, atk: s.atk, speed: r.speed, range: r.range,
    atk_rate: r.atk_rate, atk_cooldown: 0, lane, y: 8, stun: 0,
    color: ROBOT_COLORS[r.id] || "#00E5FF", size: r.id === "titan" ? 18 : r.id === "tank" ? 16 : 12,
  });
  state.events.push(`▮ ${r.name} deployed`);
  if (state.events.length > 8) state.events.shift();
  return true;
}

function spawnAlien(state: BattleState, wave: { type: string; lane: Lane }, level: V2Level) {
  const a = state.aliens[wave.type];
  if (!a) return;
  const diff = level.difficulty;
  state.entities.push({
    id: uid(), side: "alien", type: a.id, name: a.name, kind: a.kind,
    hp: Math.round(a.hp * diff), max_hp: Math.round(a.hp * diff),
    atk: Math.round(a.atk * diff), speed: a.speed, range: a.range,
    atk_rate: a.atk_rate, atk_cooldown: 0, lane: wave.lane, y: 92, stun: 0,
    color: ALIEN_COLORS[a.id] || "#FF00FF", size: a.boss ? 22 : a.id === "brute" ? 16 : 12,
  });
}

export function tick(state: BattleState, level: V2Level, dt: number): BattleState {
  if (!state.playing) return state;
  state.time += dt;
  state.energy = Math.min(state.energy_max, state.energy + ENERGY_REGEN_PER_SEC * dt);
  state.ability_charge = Math.min(1, state.ability_charge + ABILITY_CHARGE_PER_SEC * dt);

  // Spawn waves
  while (state.wave_index < level.waves.length && level.waves[state.wave_index].at <= state.time) {
    spawnAlien(state, level.waves[state.wave_index], level);
    state.events.push(`▮ ${state.aliens[level.waves[state.wave_index].type]?.name || "?"} incoming`);
    if (state.events.length > 8) state.events.shift();
    state.wave_index++;
  }

  // Spawn a boss around time 45 for boss level 10
  if (level.boss && state.time > 45 && !state.entities.some((e) => e.type === level.boss)) {
    spawnAlien(state, { type: level.boss, lane: "center" }, level);
    state.events.push(`⚠ BOSS: ${state.aliens[level.boss!]?.name}`);
    if (state.events.length > 8) state.events.shift();
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
      e.y += dir * e.speed * (1 + boost) * dt * 4.0;
    } else if (target && bestDist > e.range) {
      const dir = target.y > e.y ? 1 : -1;
      e.y += dir * e.speed * (1 + boost) * dt * 4.0;
    } else {
      // Attack
      e.atk_cooldown -= dt;
      if (e.atk_cooldown <= 0) {
        const atk = e.atk * (1 + (e.side === "player" ? boost : 0));
        if (useCore) {
          if (e.side === "player") state.alien_hp = Math.max(0, state.alien_hp - atk);
          else state.earth_hp = Math.max(0, state.earth_hp - atk);
        } else if (target) {
          target.hp = Math.max(0, target.hp - atk);
        }
        e.atk_cooldown = e.atk_rate;
      }
    }
  }

  // Cleanup dead & clamp y
  state.entities = state.entities.filter((e) => e.hp > 0);
  for (const e of state.entities) e.y = Math.max(4, Math.min(96, e.y));

  // Check outcome
  if (state.alien_hp <= 0) { state.playing = false; state.outcome = "win"; }
  else if (state.earth_hp <= 0) { state.playing = false; state.outcome = "lose"; }
  else if (state.time > 240) { state.playing = false; state.outcome = "lose"; }

  return state;
}

export function useAbility(state: BattleState): BattleState {
  if (!state.playing || state.ability_charge < 1 || !state.ability) return state;
  const abil = state.ability;
  state.ability_charge = 0;
  if (abil.id === "orbital") {
    const dmg = abil.damage || 180;
    for (const e of state.entities) {
      if (e.side === "alien") e.hp = Math.max(0, e.hp - dmg);
    }
    state.events.push("◆ ORBITAL STRIKE");
  } else if (abil.id === "emp") {
    const s = abil.stun || 3;
    for (const e of state.entities) if (e.side === "alien") e.stun = s;
    state.events.push("◆ EMP PULSE");
  } else if (abil.id === "repair") {
    const p = abil.heal_pct || 0.4;
    for (const e of state.entities) if (e.side === "player") e.hp = Math.min(e.max_hp, e.hp + e.max_hp * p);
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
  if (state.earth_hp / state.earth_max_hp > 0.5) stars = 2;
  if (state.time <= level.target_time) stars = Math.max(stars, 3);
  return stars;
}
