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

export type Region = {
  id: string;
  name: string;
  resource: "energy" | "materials" | "compute" | "research";
  per_hour: number;
  location: string;
  integrity: number;
  controlled: boolean;
  under_attack: boolean;
};

export type ApollyonState = {
  unlocked: boolean;
  phase: number;
  completed: boolean;
  decision: string | null;
  ending: string | null;
  phases_total?: number;
  current_phase_info?: { name: string; narrative: string } | null;
};

// ==== Iteration 4 — Planetary Defense types ====

export type ZoneId = "water" | "energy" | "biomass" | "minerals" | "industry" | "rare" | "tech";
export type LayerId = "deep_space" | "orbital" | "atmosphere" | "ground" | "resource_zones";

export type ResourceZone = {
  id: ZoneId;
  name: string;
  icon: string;
  weight: number;
  color: string;
  integrity: number;
};

export type DefenseLayer = {
  id: LayerId;
  name: string;
  max_hp: number;
  hp: number;
  assigned_robots: string[];
  icon: string;
};

export type Adaptation = {
  name: string;
  counters: string;
  penalty: number;
  note: string;
  trigger_weapon: string;
};

export type ProtocolRule = {
  id?: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: { key: string; op?: string; value: string; combine?: "and" | "or" }[];
  actions: { key: string; value: string }[];
};

export type DefenseState = {
  viability: number;
  layers: Record<LayerId, DefenseLayer>;
  zones: ResourceZone[];
  sensor_tier: 1 | 2 | 3;
  network_progress: string[];
  protocols: ProtocolRule[];
  adaptations: Adaptation[];
  last_wave: any | null;
  wave_count: number;
  network_complete: boolean;
  peace_achieved: boolean;
  apollyon_victory?: boolean;
};

export type NetworkNode = {
  id: string;
  name: string;
  icon: string;
  cost: Partial<Record<"energy" | "materials" | "compute" | "research", number>>;
  layer: LayerId | null;
};

export type WaveIntel = {
  level: number;
  total_detected: number | null;
  unknown_signatures: number | null;
  breakdown: Record<string, number> | null;
  stealth_warning: boolean;
};

export type RevealedShip = {
  id: string;
  type: string;
  type_display: string;
  hp: number;
  power: number;
  harvest: number;
  target: string | null;
};

export type ScanResult = {
  wave_id: string;
  wave_number: number;
  intel: WaveIntel;
  revealed: RevealedShip[];
  adaptations: Adaptation[];
};

export type EngageResult = {
  wave_id: string;
  wave_number: number;
  outcome: "victory" | "partial" | "apollyon_victory";
  log: any[];
  viability_after: number;
  layers_after: Record<LayerId, DefenseLayer>;
  zones_after: ResourceZone[];
  adaptations: Adaptation[];
  surviving_ships: number;
  rewards: { xp: number; research: number; materials: number };
  resources: Resources;
};

// ==== Iteration 5 — Archons, Triage, Cascade, Deeper Protocols ====

export type Archon = {
  id: string;
  name: string;
  icon: string;
  color: string;
  min_wave: number;
  min_gen: number;
  narrative: string;
  hp: number;
  attack: number;
  defense: number;
  mechanic: "summon" | "jam" | "drain" | "reflect";
  rewards: {
    materials?: number;
    research?: number;
    compute?: number;
    xp?: number;
    part_unlock?: string;
  };
  defeated?: boolean;
  unlocked?: boolean;
  gate_wave?: number;
  gate_gen?: number;
  reward_unlocked?: boolean;
};

export type ArchonBattleResult = {
  archon: Archon;
  sim: {
    victory: boolean;
    rounds: { round: number; player_dmg: number; archon_dmg: number; reflect: number; player_hp: number; archon_hp: number }[];
    player_hp_left: number;
    archon_hp_left: number;
    material_drain: number;
    summons: number;
    notes: string[];
  };
  rewards: any;
  resources: Resources;
  defense: DefenseState;
};

export type TriageScan = {
  id: string;
  message: string;
  zones: {
    id: string;
    name: string;
    icon: string;
    color: string;
    integrity: number;
    weight: number;
    incoming_damage: number;
  }[];
};

export type TriageResolve = {
  resolved: { id: string; name: string; action: "defended" | "sacrificed"; damage: number; integrity: number }[];
  viability_after: number;
  resources: Resources;
};

export type CascadeModifiers = {
  build_material_mult: number;
  build_compute_mult: number;
  compute_regen_mult: number;
  energy_regen_mult: number;
  sensor_penalty: number;
  warnings: string[];
  effective_sensor_tier: number;
  base_sensor_tier: number;
};

// ==== Iteration 6 — Doctrines, Zone Repair ====

export type Doctrine = {
  id?: string;
  name: string;
  robot_ids: string[];
  target_layer?: LayerId | null;
  last_deployed_at?: string | null;
  last_deployed_layer?: LayerId | null;
  last_deployed_count?: number | null;
};

// ==== Iteration 7 — Monetization ====
export type Monetization = {
  ai_cores: number;
  remove_ads: boolean;
  cosmetics_owned: string[];
  expansions_owned: string[];
  season_passes: string[];
  season_xp: Record<string, number>;
  season_claimed: Record<string, number[]>;
  transmission_cd: Record<string, string>;
  purchase_log: any[];
};

export type StoreItem = {
  id: string;
  kind: "bundle" | "cosmetic" | "removeads" | "season_pass" | "resources" | "currency" | "expansion";
  name: string;
  price_usd?: number;
  price_ai_cores?: number;
  status?: string;
  grants: Record<string, any>;
};

export type StoreCatalog = {
  featured: StoreItem[];
  cosmetics: StoreItem[];
  resource_packs: StoreItem[];
  expansions: StoreItem[];
};

export type SeasonStatus = {
  id: string;
  name: string;
  narrative: string;
  tiers: number;
  xp_per_tier: number;
  xp: number;
  tier: number;
  next_tier_at: number;
  premium_owned: boolean;
  claimed: number[];
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
  regions: Region[];
  apollyon: ApollyonState;
  defense?: DefenseState | null;
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
  async getRegions(playerId: string): Promise<Region[]> {
    return j(await fetch(`${API}/regions/${playerId}`));
  },
  async attackRegion(payload: {
    player_id: string;
    region_id: string;
    robot_id: string;
  }): Promise<{ result: BattleResult; region: Region }> {
    const res = await fetch(`${API}/regions/attack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async apollyonStatus(playerId: string): Promise<ApollyonState> {
    return j(await fetch(`${API}/apollyon/status/${playerId}`));
  },
  async apollyonBattle(payload: { player_id: string; robot_id: string }): Promise<{
    result: BattleResult;
    phase: number;
    phases_total: number;
    phase_narrative: string;
    completed: boolean;
  }> {
    const res = await fetch(`${API}/apollyon/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async apollyonDecide(payload: { player_id: string; decision: string }): Promise<{
    decision: string;
    ending: string;
  }> {
    const res = await fetch(`${API}/apollyon/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },

  // ==== Iteration 4 — Planetary Defense ====
  async defenseConfig(): Promise<{
    layers: { id: LayerId; name: string; max_hp: number; icon: string }[];
    zones: ResourceZone[];
    network_nodes: NetworkNode[];
    ship_types: Record<string, any>;
    viability_critical: number;
  }> {
    return j(await fetch(`${API}/defense/config`));
  },
  async defenseState(playerId: string): Promise<DefenseState> {
    return j(await fetch(`${API}/defense/state/${playerId}`));
  },
  async defenseAssign(payload: { player_id: string; robot_id: string; layer_id: LayerId }): Promise<any> {
    const res = await fetch(`${API}/defense/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async defenseUnassign(payload: { player_id: string; robot_id: string }): Promise<any> {
    const res = await fetch(`${API}/defense/unassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async defenseRepair(payload: { player_id: string; layer_id: LayerId }): Promise<any> {
    const res = await fetch(`${API}/defense/repair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async saveProtocols(payload: { player_id: string; protocols: ProtocolRule[] }): Promise<any> {
    const res = await fetch(`${API}/defense/protocols`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async invasionScan(playerId: string): Promise<ScanResult> {
    const res = await fetch(`${API}/invasion/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    return j(res);
  },
  async invasionEngage(payload: { player_id: string; wave_id: string }): Promise<EngageResult> {
    const res = await fetch(`${API}/invasion/engage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async networkBuild(payload: { player_id: string; node_id: string }): Promise<any> {
    const res = await fetch(`${API}/network/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async defenseReset(playerId: string): Promise<DefenseState> {
    return j(await fetch(`${API}/defense/reset/${playerId}`, { method: "POST" }));
  },

  // ==== Iteration 5 — Archons, Triage, Cascade ====
  async archonsConfig(): Promise<{ archons: Archon[] }> {
    return j(await fetch(`${API}/archons/config`));
  },
  async archonsStatus(playerId: string): Promise<{ archons: Archon[]; wave_count: number; generation: number }> {
    return j(await fetch(`${API}/archons/status/${playerId}`));
  },
  async archonBattle(payload: { player_id: string; robot_id: string; archon_id: string }): Promise<ArchonBattleResult> {
    const res = await fetch(`${API}/archons/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async triageScan(playerId: string): Promise<TriageScan> {
    const res = await fetch(`${API}/triage/scan/${playerId}`, { method: "POST" });
    return j(res);
  },
  async triageResolve(payload: { player_id: string; defend_zone_ids: string[] }): Promise<TriageResolve> {
    const res = await fetch(`${API}/triage/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async cascadeState(playerId: string): Promise<CascadeModifiers> {
    return j(await fetch(`${API}/defense/cascade/${playerId}`));
  },

  // ==== Iteration 6 — Doctrines & Zone Repair ====
  async listDoctrines(playerId: string): Promise<Doctrine[]> {
    return j(await fetch(`${API}/doctrines/${playerId}`));
  },
  async saveDoctrine(payload: { player_id: string; doctrine: Doctrine }): Promise<{ doctrine: Doctrine; doctrines: Doctrine[] }> {
    const res = await fetch(`${API}/doctrines/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async deleteDoctrine(payload: { player_id: string; doctrine_id: string }): Promise<any> {
    const res = await fetch(`${API}/doctrines/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async deployDoctrine(payload: { player_id: string; doctrine_id: string; layer_id?: LayerId }): Promise<any> {
    const res = await fetch(`${API}/doctrines/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async zoneRepair(payload: { player_id: string; zone_id: string; points: number }): Promise<{ repaired: number; zone: ResourceZone; resources: Resources; viability: number }> {
    const res = await fetch(`${API}/defense/zone_repair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },

  // ==== Iteration 7 — Monetization ====
  async storeCatalog(): Promise<StoreCatalog> {
    return j(await fetch(`${API}/store/catalog`));
  },
  async storeStatus(playerId: string): Promise<Monetization> {
    return j(await fetch(`${API}/store/status/${playerId}`));
  },
  async purchase(payload: { player_id: string; item_id: string }): Promise<{ ok: boolean; item: StoreItem; delta: any; monetization: Monetization; resources: Resources }> {
    const res = await fetch(`${API}/store/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async watchTransmission(payload: { player_id: string; slot: string; context?: any }): Promise<any> {
    const res = await fetch(`${API}/store/transmission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async seasonStatus(playerId: string): Promise<{ seasons: SeasonStatus[] }> {
    return j(await fetch(`${API}/season/status/${playerId}`));
  },
  async seasonClaim(payload: { player_id: string; season_id: string; tier: number }): Promise<any> {
    const res = await fetch(`${API}/season/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async seasonAddXp(payload: { player_id: string; season_id: string; xp: number }): Promise<any> {
    const res = await fetch(`${API}/season/add_xp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },

  // ==== V2 (Simplified lane-battle) ====
  async v2Config(): Promise<V2Config> {
    return j(await fetch(`${API}/v2/config`));
  },
  async v2Player(playerId: string): Promise<V2PlayerResponse> {
    return j(await fetch(`${API}/v2/player/${playerId}`));
  },
  async v2BattleComplete(payload: {
    player_id: string;
    level_id: number;
    victory: boolean;
    stars?: number;
    time_taken_sec?: number;
    core_hp_remaining_pct?: number;
    difficulty?: "normal" | "veteran";
  }): Promise<V2BattleResult> {
    const res = await fetch(`${API}/v2/battle/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async v2UpgradeRobot(payload: { player_id: string; robot_id: string }): Promise<any> {
    const res = await fetch(`${API}/v2/robots/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async v2SetDeck(payload: { player_id: string; deck: string[] }): Promise<any> {
    const res = await fetch(`${API}/v2/deck`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async v2SetAbility(payload: { player_id: string; ability_id: string }): Promise<any> {
    const res = await fetch(`${API}/v2/commander/ability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return j(res);
  },
  async v2Evolve(playerId: string): Promise<any> {
    return j(await fetch(`${API}/v2/commander/evolve?player_id=${playerId}`, { method: "POST" }));
  },
  async v2Story(levelId: number, flavor: boolean = false): Promise<V2Story> {
    return j<V2Story>(await fetch(`${API}/v2/story/${levelId}${flavor ? "?flavor=true" : ""}`));
  },
  async v2StoryEpilogue(): Promise<V2Epilogue> {
    return j<V2Epilogue>(await fetch(`${API}/v2/story/epilogue`));
  },
  async v2StoryChapter(chapterId: number): Promise<V2ChapterOpener> {
    return j<V2ChapterOpener>(await fetch(`${API}/v2/story/chapter/${chapterId}`));
  },
  async v2StoryReveal(revealId: string): Promise<V2Reveal> {
    return j<V2Reveal>(await fetch(`${API}/v2/story/reveal/${revealId}`));
  },
  async v2TTSCreate(text: string, speaker: string): Promise<{ url: string; speaker: string }> {
    return j<{ url: string; speaker: string }>(await fetch(`${API}/v2/tts/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    }));
  },
};

// ==== V2 Story types ====
export type V2Panel = { header: string; body: string };
export type V2Story = {
  level_id: number;
  level_name: string;
  location: string;
  time_stamp: string;
  tagline: string;
  chapter: string | null;
  previously: string | null;
  next_teaser: string | null;
  panels: V2Panel[];
  flavor_line: string | null;
};
export type V2Epilogue = {
  title: string;
  panels: V2Panel[];
};
export type V2ChapterOpener = {
  chapter: string;
  title: string;
  epigraph: string;
  panels: V2Panel[];
};
export type V2Reveal = {
  title: string;
  panels: V2Panel[];
};

// ==== V2 types ====
export type V2Robot = {
  id: string; name: string; cost: number; hp: number; atk: number; speed: number;
  range: number; atk_rate: number; kind: "ground" | "air"; unlock_level: number; flavor: string;
};
export type V2Alien = {
  id: string; name: string; hp: number; atk: number; speed: number; range: number; atk_rate: number;
  kind: "ground" | "air"; reward: number; boss?: boolean;
};
export type V2Wave = { at: number; type: string; lane: "left" | "center" | "right" };
export type V2Surge = { at: number; type: string };
export type V2Level = {
  id: number; name: string; world: number; difficulty: number; energy_start: number;
  target_time: number; waves: V2Wave[]; core_hp: number; boss?: string; surges?: V2Surge[];
};
export type V2Ability = { id: string; name: string; desc: string; damage?: number; stun?: number; heal_pct?: number; duration?: number; boost?: number };
export type V2Stage = { stage: number; name: string; req_stars: number; hp_bonus: number };
export type V2Config = { levels: V2Level[]; robots: V2Robot[]; aliens: V2Alien[]; abilities: V2Ability[]; stages: V2Stage[] };

export type V2Campaign = {
  level: number;
  stars: Record<string, number>;
  parts: number;
  unlocked_robots: string[];
  robot_levels: Record<string, number>;
  commander_stage: number;
  commander_ability: string;
  deck: string[];
};

export type V2PlayerResponse = {
  id: string;
  codename: string;
  campaign: V2Campaign;
  total_stars: number;
};

export type V2BattleResult = {
  victory: boolean;
  stars: number;
  parts_awarded: number;
  campaign: V2Campaign;
  unlocked_robot: string | null;
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
