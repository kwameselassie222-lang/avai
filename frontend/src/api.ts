import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

const PLAYER_KEY = "aliens_vai_player_id";
const CODENAME_KEY = "aliens_vai_codename";

export type Resources = {
  energy: number;
  materials: number;
  compute: number;
  research: number;
};

export type Player = {
  id: string;
  codename: string;
  level: number;
  xp: number;
  credits: number;
  victories: number;
  defeats: number;
  score: number;
  generation: number;
  resources: Resources;
  weapon_usage: Record<string, number>;
};

export type Robot = {
  id: string;
  player_id: string;
  name: string;
  chassis: string;
  mobility: string;
  armor: string;
  weapon: string;
  sensor: string;
  ai_module: string;
  generation: number;
  attack: number;
  defense: number;
  speed: number;
  tech: number;
  power: number;
};

export type AlienClass = "locust" | "harvester" | "sentinel" | "archon";

export type Threat = {
  id: string;
  name: string;
  location: string;
  alien_class: AlienClass;
  threat_level: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  weakness: string;
  reward_xp: number;
  reward_credits: number;
  reward_materials: number;
  reward_research: number;
  description: string;
};

export type BattleRound = {
  round: number;
  robot_dmg: number;
  threat_dmg: number;
  robot_hp: number;
  threat_hp: number;
};

export type BattleResult = {
  id: string;
  player_id: string;
  robot_id: string;
  threat_name: string;
  alien_class: AlienClass;
  victory: boolean;
  rounds: BattleRound[];
  robot_hp_left: number;
  threat_hp_left: number;
  xp_gained: number;
  credits_gained: number;
  materials_gained: number;
  research_gained: number;
  adaptation_note: string | null;
};

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed.detail || body;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const storage = {
  async getPlayerId(): Promise<string | null> {
    return AsyncStorage.getItem(PLAYER_KEY);
  },
  async setPlayer(id: string, codename: string): Promise<void> {
    await AsyncStorage.setItem(PLAYER_KEY, id);
    await AsyncStorage.setItem(CODENAME_KEY, codename);
  },
  async getCodename(): Promise<string | null> {
    return AsyncStorage.getItem(CODENAME_KEY);
  },
  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([PLAYER_KEY, CODENAME_KEY]);
  },
};

export const api = {
  async initPlayer(codename?: string): Promise<Player> {
    const res = await fetch(`${API}/player/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codename }),
    });
    return j<Player>(res);
  },
  async getPlayer(id: string): Promise<Player> {
    return j<Player>(await fetch(`${API}/player/${id}`));
  },
  async createRobot(payload: {
    player_id: string;
    name: string;
    chassis: string;
    mobility: string;
    armor: string;
    weapon: string;
    sensor: string;
    ai_module: string;
  }): Promise<Robot> {
    const res = await fetch(`${API}/robots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j<Robot>(res);
  },
  async listRobots(playerId: string): Promise<Robot[]> {
    return j<Robot[]>(await fetch(`${API}/robots?player_id=${playerId}`));
  },
  async deleteRobot(id: string): Promise<void> {
    await fetch(`${API}/robots/${id}`, { method: "DELETE" });
  },
  async listThreats(count = 5, playerLevel = 1): Promise<Threat[]> {
    return j<Threat[]>(
      await fetch(`${API}/threats/list?count=${count}&player_level=${playerLevel}`)
    );
  },
  async battle(payload: {
    player_id: string;
    robot_id: string;
    threat: Threat;
  }): Promise<BattleResult> {
    const res = await fetch(`${API}/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j<BattleResult>(res);
  },
  async leaderboard(): Promise<
    { id: string; codename: string; level: number; score: number; generation: number; victories: number; defeats: number }[]
  > {
    return j(await fetch(`${API}/leaderboard`));
  },
  async brief(threat: Threat): Promise<{ brief: string }> {
    const res = await fetch(`${API}/ai/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threat_name: threat.name,
        threat_level: threat.threat_level,
        location: threat.location,
        alien_class: threat.alien_class,
        context: threat.description,
      }),
    });
    return j(res);
  },
};

// -------- Catalog (mirror of backend TABLES) --------

export type PartDef = { key: string; label: string; icon: string; gen: number };

export const CATALOG: Record<
  "chassis" | "mobility" | "armor" | "weapon" | "sensor" | "ai_module",
  PartDef[]
> = {
  chassis: [
    { key: "humanoid", label: "Humanoid", icon: "robot", gen: 1 },
    { key: "quadruped", label: "Quadruped", icon: "dog", gen: 1 },
    { key: "tank", label: "Tank", icon: "tank", gen: 1 },
    { key: "spider", label: "Spider", icon: "spider", gen: 2 },
    { key: "drone", label: "Wraith", icon: "quadcopter", gen: 2 },
    { key: "swarm", label: "Swarm", icon: "bee", gen: 2 },
    { key: "phase", label: "Phase-Mech", icon: "atom-variant", gen: 3 },
    { key: "morphling", label: "Morphling", icon: "shape-outline", gen: 4 },
    { key: "avatar", label: "Avatar", icon: "meditation", gen: 5 },
  ],
  mobility: [
    { key: "wheels", label: "Wheels", icon: "car-wireless", gen: 1 },
    { key: "legs", label: "Legs", icon: "walk", gen: 1 },
    { key: "wings", label: "Wings", icon: "airplane", gen: 2 },
    { key: "hover", label: "Hover", icon: "helicopter", gen: 3 },
    { key: "teleport", label: "Teleport", icon: "orbit", gen: 4 },
    { key: "quantum", label: "Quantum", icon: "infinity", gen: 5 },
  ],
  armor: [
    { key: "steel", label: "Steel", icon: "shield", gen: 1 },
    { key: "titanium", label: "Titanium", icon: "shield-half-full", gen: 1 },
    { key: "ceramic", label: "Ceramic", icon: "shield-outline", gen: 1 },
    { key: "carbon", label: "Carbon", icon: "shield-star", gen: 2 },
    { key: "nanomaterial", label: "Nano", icon: "shield-sun", gen: 3 },
    { key: "adaptive", label: "Adaptive", icon: "shield-refresh", gen: 3 },
    { key: "bio", label: "Bio-Armor", icon: "shield-sync", gen: 4 },
    { key: "aura", label: "Aura Field", icon: "shield-account", gen: 5 },
  ],
  weapon: [
    { key: "railgun", label: "Railgun", icon: "rocket-launch", gen: 1 },
    { key: "laser", label: "Laser", icon: "flash", gen: 1 },
    { key: "missile", label: "Missile", icon: "rocket", gen: 1 },
    { key: "plasma", label: "Plasma", icon: "atom", gen: 2 },
    { key: "emp", label: "EMP", icon: "lightning-bolt-circle", gen: 2 },
    { key: "sonic", label: "Sonic", icon: "waveform", gen: 2 },
    { key: "gravity", label: "Gravity", icon: "chart-donut", gen: 3 },
    { key: "particle", label: "Particle", icon: "atom-variant", gen: 4 },
    { key: "resonance", label: "Resonance", icon: "sine-wave", gen: 5 },
  ],
  sensor: [
    { key: "optical", label: "Optical", icon: "eye", gen: 1 },
    { key: "infrared", label: "Infrared", icon: "thermometer", gen: 1 },
    { key: "radar", label: "Radar", icon: "radar", gen: 2 },
    { key: "lidar", label: "Lidar", icon: "map-marker-radius", gen: 2 },
    { key: "quantum", label: "Quantum", icon: "atom-variant", gen: 3 },
    { key: "thirdEye", label: "Third Eye", icon: "eye-outline", gen: 5 },
  ],
  ai_module: [
    { key: "hunter", label: "Hunter", icon: "target", gen: 1 },
    { key: "guardian", label: "Guardian", icon: "shield-check", gen: 1 },
    { key: "tactical", label: "Tactical", icon: "chess-knight", gen: 2 },
    { key: "swarm", label: "Swarm", icon: "bee", gen: 2 },
    { key: "adaptive", label: "Adaptive", icon: "brain", gen: 3 },
    { key: "evolved", label: "Evolved", icon: "dna", gen: 4 },
    { key: "conscious", label: "Conscious", icon: "eye-plus", gen: 5 },
  ],
};

export type CatalogCategory = keyof typeof CATALOG;

// Part -> stat contribution (mirror of backend)
export const PART_STATS: Record<CatalogCategory, Record<string, Partial<{ attack: number; defense: number; speed: number; tech: number }>>> = {
  chassis: {
    humanoid: { attack: 6, defense: 6, speed: 6, tech: 5 },
    quadruped: { attack: 5, defense: 5, speed: 8, tech: 4 },
    tank: { attack: 8, defense: 10, speed: 3, tech: 4 },
    spider: { attack: 7, defense: 6, speed: 8, tech: 6 },
    drone: { attack: 6, defense: 4, speed: 11, tech: 7 },
    swarm: { attack: 8, defense: 3, speed: 10, tech: 8 },
    phase: { attack: 9, defense: 7, speed: 9, tech: 10 },
    morphling: { attack: 11, defense: 10, speed: 10, tech: 12 },
    avatar: { attack: 14, defense: 14, speed: 12, tech: 16 },
  },
  mobility: {
    wheels: { speed: 4 }, legs: { speed: 5 }, wings: { speed: 8 },
    hover: { speed: 9, tech: 2 }, teleport: { speed: 12, tech: 4 }, quantum: { speed: 15, tech: 6 },
  },
  armor: {
    steel: { defense: 4 }, titanium: { defense: 6 }, ceramic: { defense: 5 },
    carbon: { defense: 8 }, nanomaterial: { defense: 11 }, adaptive: { defense: 10, tech: 3 },
    bio: { defense: 13, tech: 3 }, aura: { defense: 16, tech: 5 },
  },
  weapon: {
    railgun: { attack: 8 }, laser: { attack: 7 }, missile: { attack: 10 },
    plasma: { attack: 12 }, emp: { attack: 8, tech: 4 }, sonic: { attack: 9 },
    gravity: { attack: 14, tech: 3 }, particle: { attack: 17, tech: 4 }, resonance: { attack: 20, tech: 6 },
  },
  sensor: {
    optical: { tech: 2 }, infrared: { tech: 3 }, radar: { tech: 4 },
    lidar: { tech: 5 }, quantum: { tech: 8 }, thirdEye: { tech: 12 },
  },
  ai_module: {
    hunter: { attack: 3 }, guardian: { defense: 3 },
    tactical: { attack: 2, defense: 2, tech: 2 }, swarm: { speed: 4 },
    adaptive: { tech: 5, attack: 2 }, evolved: { attack: 5, defense: 5, tech: 5 },
    conscious: { attack: 7, defense: 7, speed: 4, tech: 8 },
  },
};

export function computeStats(sel: Record<CatalogCategory, string>) {
  let attack = 0, defense = 0, speed = 0, tech = 0, gen = 1;
  (Object.keys(sel) as CatalogCategory[]).forEach((cat) => {
    const key = sel[cat];
    const s = PART_STATS[cat][key] || {};
    attack += s.attack || 0;
    defense += s.defense || 0;
    speed += s.speed || 0;
    tech += s.tech || 0;
    const def = CATALOG[cat].find((p) => p.key === key);
    if (def) gen = Math.max(gen, def.gen);
  });
  const cost = { materials: 20 + gen * 25, compute: 5 + gen * 3 };
  return { attack, defense, speed, tech, power: attack + defense + speed + tech, gen, cost };
}

export const GEN_UNLOCK_RESEARCH: Record<number, number> = {
  2: 50, 3: 150, 4: 350, 5: 700,
};

export const ALIEN_CLASS_META: Record<AlienClass, { label: string; icon: string; color: string; tag: string }> = {
  locust:    { label: "LOCUST",    icon: "bee",           color: "#00FF66", tag: "SWARM · FAST" },
  harvester: { label: "HARVESTER", icon: "shape-square-plus", color: "#FFB020", tag: "TANK · DRAIN" },
  sentinel:  { label: "SENTINEL",  icon: "robot-industrial", color: "#00E5FF", tag: "ADAPTIVE" },
  archon:    { label: "ARCHON",    icon: "crown",         color: "#FF3366", tag: "COMMANDER · BOSS" },
};
