from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Resource / Generation config ----------

GEN_UNLOCK_RESEARCH = {2: 50, 3: 150, 4: 350, 5: 700}
STARTING_RESOURCES = {"energy": 100, "materials": 250, "compute": 30, "research": 0}
DEPLOY_ENERGY_COST = 10
ENERGY_REGEN_CAP = 100
ENERGY_REGEN_PER_MIN = 1.0

# ---------- Regions ----------
# Each region grants a passive resource tick per hour when controlled (integrity > 0).
REGIONS_CONFIG = [
    {"id": "silicon_valley", "name": "Silicon Valley",  "resource": "research",  "per_hour": 6,  "location": "Los Angeles"},
    {"id": "taiwan",         "name": "Taiwan",          "resource": "compute",   "per_hour": 4,  "location": "Taipei"},
    {"id": "congo",          "name": "Congo Basin",     "resource": "materials", "per_hour": 20, "location": "Kinshasa"},
    {"id": "middle_east",    "name": "Middle East",     "resource": "energy",    "per_hour": 15, "location": "Dubai"},
]
APOLLYON_MIN_GEN = 3  # Boss unlocked at generation 3+


def default_regions():
    return [
        {**r, "integrity": 100, "controlled": True, "under_attack": False}
        for r in REGIONS_CONFIG
    ]


# ---------- Component catalog with generations ----------

CHASSIS = {
    "humanoid":  {"gen": 1, "stats": {"attack": 6, "defense": 6, "speed": 6, "tech": 5}},
    "quadruped": {"gen": 1, "stats": {"attack": 5, "defense": 5, "speed": 8, "tech": 4}},
    "tank":      {"gen": 1, "stats": {"attack": 8, "defense": 10, "speed": 3, "tech": 4}},
    "spider":    {"gen": 2, "stats": {"attack": 7, "defense": 6, "speed": 8, "tech": 6}},
    "drone":     {"gen": 2, "stats": {"attack": 6, "defense": 4, "speed": 11, "tech": 7}},
    "swarm":     {"gen": 2, "stats": {"attack": 8, "defense": 3, "speed": 10, "tech": 8}},
    "phase":     {"gen": 3, "stats": {"attack": 9, "defense": 7, "speed": 9, "tech": 10}},
    "morphling": {"gen": 4, "stats": {"attack": 11, "defense": 10, "speed": 10, "tech": 12}},
    "avatar":    {"gen": 5, "stats": {"attack": 14, "defense": 14, "speed": 12, "tech": 16}},
}
MOBILITY = {
    "wheels":   {"gen": 1, "stats": {"speed": 4}},
    "legs":     {"gen": 1, "stats": {"speed": 5}},
    "wings":    {"gen": 2, "stats": {"speed": 8}},
    "hover":    {"gen": 3, "stats": {"speed": 9, "tech": 2}},
    "teleport": {"gen": 4, "stats": {"speed": 12, "tech": 4}},
    "quantum":  {"gen": 5, "stats": {"speed": 15, "tech": 6}},
}
ARMOR = {
    "steel":        {"gen": 1, "stats": {"defense": 4}},
    "titanium":     {"gen": 1, "stats": {"defense": 6}},
    "ceramic":      {"gen": 1, "stats": {"defense": 5}},
    "carbon":       {"gen": 2, "stats": {"defense": 8}},
    "nanomaterial": {"gen": 3, "stats": {"defense": 11}},
    "adaptive":     {"gen": 3, "stats": {"defense": 10, "tech": 3}},
    "bio":          {"gen": 4, "stats": {"defense": 13, "tech": 3}},
    "aura":         {"gen": 5, "stats": {"defense": 16, "tech": 5}},
}
WEAPON = {
    "railgun":   {"gen": 1, "stats": {"attack": 8}},
    "laser":     {"gen": 1, "stats": {"attack": 7}},
    "missile":   {"gen": 1, "stats": {"attack": 10}},
    "plasma":    {"gen": 2, "stats": {"attack": 12}},
    "emp":       {"gen": 2, "stats": {"attack": 8, "tech": 4}},
    "sonic":     {"gen": 2, "stats": {"attack": 9}},
    "gravity":   {"gen": 3, "stats": {"attack": 14, "tech": 3}},
    "particle":  {"gen": 4, "stats": {"attack": 17, "tech": 4}},
    "resonance": {"gen": 5, "stats": {"attack": 20, "tech": 6}},
}
SENSOR = {
    "optical":  {"gen": 1, "stats": {"tech": 2}},
    "infrared": {"gen": 1, "stats": {"tech": 3}},
    "radar":    {"gen": 2, "stats": {"tech": 4}},
    "lidar":    {"gen": 2, "stats": {"tech": 5}},
    "quantum":  {"gen": 3, "stats": {"tech": 8}},
    "thirdEye": {"gen": 5, "stats": {"tech": 12}},
}
AI_MODULE = {
    "hunter":    {"gen": 1, "stats": {"attack": 3}},
    "guardian":  {"gen": 1, "stats": {"defense": 3}},
    "tactical":  {"gen": 2, "stats": {"attack": 2, "defense": 2, "tech": 2}},
    "swarm":     {"gen": 2, "stats": {"speed": 4}},
    "adaptive":  {"gen": 3, "stats": {"tech": 5, "attack": 2}},
    "evolved":   {"gen": 4, "stats": {"attack": 5, "defense": 5, "tech": 5}},
    "conscious": {"gen": 5, "stats": {"attack": 7, "defense": 7, "speed": 4, "tech": 8}},
}

TABLES = {
    "chassis": CHASSIS,
    "mobility": MOBILITY,
    "armor": ARMOR,
    "weapon": WEAPON,
    "sensor": SENSOR,
    "ai_module": AI_MODULE,
}


# ---------- Alien classes ----------

ALIEN_CLASS_DATA = {
    "locust": {
        "names": ["Locust Swarm", "Chitin Wave", "Hive Vanguard"],
        "min_player_level": 1,
        "hp_mult": 0.7,
        "atk_mult": 0.9,
        "def_mult": 0.5,
        "speed_mult": 1.6,
        "reward_materials": 25,
        "reward_research": 2,
    },
    "harvester": {
        "names": ["Harvester Prime", "Void Devourer", "Bio-Scraper"],
        "min_player_level": 2,
        "hp_mult": 1.6,
        "atk_mult": 1.0,
        "def_mult": 1.4,
        "speed_mult": 0.6,
        "reward_materials": 80,
        "reward_research": 5,
    },
    "sentinel": {
        "names": ["Sentinel Alpha", "Apollyon Sentinel", "Chrome Judge"],
        "min_player_level": 3,
        "hp_mult": 1.1,
        "atk_mult": 1.2,
        "def_mult": 1.1,
        "speed_mult": 1.0,
        "reward_materials": 40,
        "reward_research": 15,
    },
    "archon": {
        "names": ["Archon of Silence", "Devourer Archon", "Mirror Archon", "Swarm Lord"],
        "min_player_level": 6,
        "hp_mult": 2.4,
        "atk_mult": 1.6,
        "def_mult": 1.5,
        "speed_mult": 0.9,
        "reward_materials": 150,
        "reward_research": 40,
    },
}

CITIES = [
    "Atlanta", "New York", "Los Angeles", "Mexico City", "São Paulo",
    "London", "Lagos", "Cairo", "Nairobi", "Johannesburg", "Dubai",
    "Mumbai", "Singapore", "Shanghai", "Seoul", "Tokyo", "Sydney",
]
WEAKNESSES = ["emp", "laser", "plasma", "missile", "sonic", "railgun", "gravity", "particle", "resonance"]


# ---------- Helpers ----------

def compute_generation(research: int) -> int:
    gen = 1
    for g, r in sorted(GEN_UNLOCK_RESEARCH.items()):
        if research >= r:
            gen = g
    return gen


def robot_cost(parts: dict) -> Dict[str, int]:
    max_gen = 1
    for cat, table in TABLES.items():
        p = parts.get(cat)
        if p and p in table:
            max_gen = max(max_gen, table[p]["gen"])
    return {"materials": 20 + max_gen * 25, "compute": 5 + max_gen * 3}


def apply_energy_regen(player_doc: dict) -> dict:
    now = datetime.now(timezone.utc)
    last_str = player_doc.get("resources_updated_at")
    if last_str:
        try:
            last = datetime.fromisoformat(last_str)
        except Exception:
            last = now
    else:
        last = now
    delta_sec = max(0, (now - last).total_seconds())
    delta_min = delta_sec / 60.0
    delta_hr = delta_sec / 3600.0
    resources = player_doc.get("resources", dict(STARTING_RESOURCES))
    # Energy regen (capped)
    resources["energy"] = min(ENERGY_REGEN_CAP, int(resources.get("energy", 0) + delta_min * ENERGY_REGEN_PER_MIN))
    # Region passive tick: for each controlled region, add per_hour * delta_hr to its resource
    regions = player_doc.get("regions") or default_regions()
    for r in regions:
        if r.get("controlled") and r.get("integrity", 0) > 0:
            add = int(r.get("per_hour", 0) * delta_hr)
            if add > 0:
                key = r["resource"]
                resources[key] = int(resources.get(key, 0)) + add
    if resources.get("energy", 0) > ENERGY_REGEN_CAP:
        resources["energy"] = ENERGY_REGEN_CAP
    player_doc["resources"] = resources
    player_doc["regions"] = regions
    player_doc["resources_updated_at"] = now.isoformat()
    return player_doc


# ---------- Models ----------

class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    codename: str
    level: int = 1
    xp: int = 0
    credits: int = 500
    victories: int = 0
    defeats: int = 0
    score: int = 0
    generation: int = 1
    resources: Dict[str, int] = Field(default_factory=lambda: dict(STARTING_RESOURCES))
    resources_updated_at: Optional[str] = None
    weapon_usage: Dict[str, int] = Field(default_factory=dict)
    regions: List[Dict[str, Any]] = Field(default_factory=default_regions)
    apollyon: Dict[str, Any] = Field(
        default_factory=lambda: {"unlocked": False, "phase": 0, "completed": False, "decision": None, "ending": None}
    )
    defense: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PlayerInit(BaseModel):
    codename: Optional[str] = None


class Robot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    name: str
    chassis: str
    mobility: str
    armor: str
    weapon: str
    sensor: str
    ai_module: str
    generation: int = 1
    attack: int = 0
    defense: int = 0
    speed: int = 0
    tech: int = 0
    power: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RobotCreate(BaseModel):
    player_id: str
    name: str
    chassis: str
    mobility: str
    armor: str
    weapon: str
    sensor: str
    ai_module: str


class Threat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: str
    alien_class: str
    threat_level: int
    hp: int
    attack: int
    defense: int
    speed: int
    weakness: str
    reward_xp: int
    reward_credits: int
    reward_materials: int
    reward_research: int
    description: str


class BattleRequest(BaseModel):
    player_id: str
    robot_id: str
    threat: Threat


class BattleResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    robot_id: str
    threat_name: str
    alien_class: str = "locust"
    victory: bool
    rounds: List[Dict[str, Any]]
    robot_hp_left: int
    threat_hp_left: int
    xp_gained: int
    credits_gained: int
    materials_gained: int = 0
    research_gained: int = 0
    adaptation_note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AIBriefRequest(BaseModel):
    threat_name: str
    threat_level: int
    location: str
    alien_class: Optional[str] = None
    context: Optional[str] = None


def compute_robot_stats(r: dict) -> Dict[str, int]:
    attack = defense = speed = tech = 0
    max_gen = 1
    for cat, table in TABLES.items():
        key = r.get(cat)
        if key and key in table:
            entry = table[key]
            s = entry.get("stats", {})
            attack += s.get("attack", 0)
            defense += s.get("defense", 0)
            speed += s.get("speed", 0)
            tech += s.get("tech", 0)
            max_gen = max(max_gen, entry.get("gen", 1))
    power = attack + defense + speed + tech
    return {"attack": attack, "defense": defense, "speed": speed, "tech": tech, "power": power, "generation": max_gen}


def pick_alien_class(player_level: int) -> str:
    pool = [k for k, v in ALIEN_CLASS_DATA.items() if v["min_player_level"] <= player_level]
    weights = {"locust": 5, "harvester": 3, "sentinel": 2, "archon": 1}
    weighted = [k for k in pool for _ in range(weights.get(k, 1))]
    return random.choice(weighted)


def generate_threat(player_level: int = 1, force_class: Optional[str] = None) -> Threat:
    cls = force_class or pick_alien_class(player_level)
    data = ALIEN_CLASS_DATA[cls]
    lvl = max(1, min(10, player_level + random.randint(-1, 2)))
    base_hp = 20 + lvl * 8
    base_atk = 5 + lvl * 2
    base_def = 3 + lvl
    return Threat(
        name=random.choice(data["names"]),
        location=random.choice(CITIES),
        alien_class=cls,
        threat_level=lvl,
        hp=int(base_hp * data["hp_mult"]),
        attack=int(base_atk * data["atk_mult"]),
        defense=int(base_def * data["def_mult"]),
        speed=int((4 + lvl) * data["speed_mult"]),
        weakness=random.choice(WEAKNESSES),
        reward_xp=30 + lvl * 15,
        reward_credits=50 + lvl * 25,
        reward_materials=data["reward_materials"] + lvl * 3,
        reward_research=data["reward_research"] + lvl,
        description=_describe(cls, lvl),
    )


def _describe(cls: str, lvl: int) -> str:
    if cls == "locust":
        return f"Class-{lvl} Locust swarm detected. Numerous, fast, low armor. Prioritize area-effect weapons."
    if cls == "harvester":
        return f"Class-{lvl} Harvester unit deployed. Heavy biomechanical siphon. Will drain regional materials if not neutralized quickly."
    if cls == "sentinel":
        return f"Class-{lvl} Sentinel — Apollyon combat platform. Adapts to sustained weapon patterns. Rotate armaments."
    if cls == "archon":
        return f"Class-{lvl} ARCHON. Alien command entity. Extreme threat rating. Full loadout recommended."
    return "Unknown extraterrestrial signature."


def simulate_battle(robot: dict, threat: Threat, weapon_usage: Dict[str, int]) -> BattleResult:
    robot_hp = 40 + robot["defense"] * 3
    threat_hp = threat.hp
    rounds = []
    weakness_bonus = 1.5 if robot["weapon"] == threat.weakness else 1.0

    adapt_note = None
    sentinel_resist = 1.0
    if threat.alien_class == "sentinel" and weapon_usage:
        top_wpn = max(weapon_usage, key=weapon_usage.get)
        if weapon_usage.get(top_wpn, 0) >= 5 and robot["weapon"] == top_wpn:
            sentinel_resist = 0.6
            adapt_note = f"SENTINEL ADAPTED: -40% dmg from {top_wpn.upper()}"

    round_no = 0
    max_rounds = 15 if threat.alien_class == "harvester" else 20
    while robot_hp > 0 and threat_hp > 0 and round_no < max_rounds:
        round_no += 1
        r_dmg = max(1, int((robot["attack"] * weakness_bonus * sentinel_resist) - threat.defense * 0.5 + random.randint(-2, 3)))
        threat_hp -= r_dmg
        t_dmg = 0
        if threat_hp > 0:
            t_dmg = max(1, int(threat.attack - robot["defense"] * 0.4 + random.randint(-2, 3)))
            robot_hp -= t_dmg
        rounds.append({
            "round": round_no,
            "robot_dmg": r_dmg,
            "threat_dmg": t_dmg,
            "robot_hp": max(0, robot_hp),
            "threat_hp": max(0, threat_hp),
        })

    victory = threat_hp <= 0 and robot_hp > 0
    xp = threat.reward_xp if victory else int(threat.reward_xp * 0.15)
    credits = threat.reward_credits if victory else 0
    materials = threat.reward_materials if victory else 0
    research = threat.reward_research if victory else 0
    if threat.alien_class == "harvester" and not victory:
        materials = -threat.reward_materials
    return BattleResult(
        player_id="",
        robot_id=robot["id"],
        threat_name=threat.name,
        alien_class=threat.alien_class,
        victory=victory,
        rounds=rounds,
        robot_hp_left=max(0, robot_hp),
        threat_hp_left=max(0, threat_hp),
        xp_gained=xp,
        credits_gained=credits,
        materials_gained=materials,
        research_gained=research,
        adaptation_note=adapt_note,
    )


# ---------- Routes ----------

@api_router.get("/")
async def root():
    return {"message": "ALIENS V A.I. — Defense Grid Online"}


@api_router.get("/catalog")
async def catalog():
    return {
        cat: [
            {"key": k, "gen": v["gen"], "stats": v.get("stats", {})}
            for k, v in table.items()
        ]
        for cat, table in TABLES.items()
    }


@api_router.post("/player/init", response_model=Player)
async def init_player(payload: PlayerInit):
    codename = (payload.codename or f"AI-{uuid.uuid4().hex[:6].upper()}").strip()
    existing = await db.players.find_one({"codename": codename}, {"_id": 0})
    if existing:
        if "resources" not in existing:
            existing["resources"] = dict(STARTING_RESOURCES)
        if "generation" not in existing:
            existing["generation"] = 1
        if "weapon_usage" not in existing:
            existing["weapon_usage"] = {}
        if "regions" not in existing:
            existing["regions"] = default_regions()
        if "apollyon" not in existing:
            existing["apollyon"] = {"unlocked": False, "phase": 0, "completed": False, "decision": None, "ending": None}
        existing = apply_energy_regen(existing)
        existing = ensure_defense_state(existing)
        existing["apollyon"]["unlocked"] = existing.get("generation", 1) >= APOLLYON_MIN_GEN
        await db.players.update_one(
            {"id": existing["id"]},
            {"$set": {
                "resources": existing["resources"],
                "resources_updated_at": existing["resources_updated_at"],
                "generation": existing["generation"],
                "weapon_usage": existing["weapon_usage"],
                "regions": existing["regions"],
                "apollyon": existing["apollyon"],
                "defense": existing["defense"],
            }},
        )
        return Player(**existing)

    p = Player(codename=codename)
    p.resources_updated_at = datetime.now(timezone.utc).isoformat()
    p.defense = default_defense_state()
    await db.players.insert_one(p.model_dump())
    return p


@api_router.get("/player/{player_id}", response_model=Player)
async def get_player(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    if "resources" not in doc:
        doc["resources"] = dict(STARTING_RESOURCES)
    if "weapon_usage" not in doc:
        doc["weapon_usage"] = {}
    if "regions" not in doc:
        doc["regions"] = default_regions()
    if "apollyon" not in doc:
        doc["apollyon"] = {"unlocked": False, "phase": 0, "completed": False, "decision": None, "ending": None}
    doc = apply_energy_regen(doc)
    doc = ensure_defense_state(doc)
    doc["generation"] = compute_generation(doc["resources"].get("research", 0))
    doc["apollyon"]["unlocked"] = doc["generation"] >= APOLLYON_MIN_GEN
    await db.players.update_one(
        {"id": player_id},
        {"$set": {
            "resources": doc["resources"],
            "resources_updated_at": doc["resources_updated_at"],
            "generation": doc["generation"],
            "regions": doc["regions"],
            "apollyon": doc["apollyon"],
            "defense": doc["defense"],
        }},
    )
    return Player(**doc)


@api_router.post("/robots", response_model=Robot)
async def create_robot(payload: RobotCreate):
    player_doc = await db.players.find_one({"id": payload.player_id}, {"_id": 0})
    if not player_doc:
        raise HTTPException(status_code=404, detail="Player not found")

    parts = payload.model_dump()
    for cat in TABLES.keys():
        key = parts.get(cat)
        if key not in TABLES[cat]:
            raise HTTPException(status_code=400, detail=f"Unknown {cat}: {key}")

    stats = compute_robot_stats(parts)
    max_gen = stats["generation"]
    player_gen = compute_generation(player_doc.get("resources", {}).get("research", 0))
    if max_gen > player_gen:
        raise HTTPException(
            status_code=400,
            detail=f"GENERATION {max_gen} LOCKED — requires {GEN_UNLOCK_RESEARCH.get(max_gen)} research (current gen {player_gen})",
        )

    # Apply cascading damage penalties (energy grid, industry, tech infra, rare)
    defense_state = player_doc.get("defense") or default_defense_state()
    cost = robot_cost_with_cascade(parts, defense_state)
    resources = player_doc.get("resources", dict(STARTING_RESOURCES))
    if resources.get("materials", 0) < cost["materials"]:
        raise HTTPException(status_code=400, detail=f"INSUFFICIENT MATERIALS: need {cost['materials']}, have {resources.get('materials', 0)}")
    if resources.get("compute", 0) < cost["compute"]:
        raise HTTPException(status_code=400, detail=f"INSUFFICIENT COMPUTE: need {cost['compute']}, have {resources.get('compute', 0)}")

    resources["materials"] -= cost["materials"]
    resources["compute"] -= cost["compute"]

    r = Robot(**payload.model_dump())
    r.attack = stats["attack"]
    r.defense = stats["defense"]
    r.speed = stats["speed"]
    r.tech = stats["tech"]
    r.power = stats["power"]
    r.generation = max_gen

    await db.robots.insert_one(r.model_dump())
    await db.players.update_one({"id": payload.player_id}, {"$set": {"resources": resources}})
    return r


@api_router.get("/robots", response_model=List[Robot])
async def list_robots(player_id: str):
    docs = await db.robots.find({"player_id": player_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Robot(**d) for d in docs]


@api_router.delete("/robots/{robot_id}")
async def delete_robot(robot_id: str):
    robot = await db.robots.find_one({"id": robot_id}, {"_id": 0})
    if robot:
        cost = robot_cost(robot)
        refund_mat = int(cost["materials"] * 0.5)
        refund_comp = cost["compute"]
        await db.players.update_one(
            {"id": robot["player_id"]},
            {"$inc": {"resources.materials": refund_mat, "resources.compute": refund_comp}},
        )
    result = await db.robots.delete_one({"id": robot_id})
    return {"deleted": result.deleted_count}


@api_router.get("/threats/generate", response_model=Threat)
async def get_threat(player_level: int = 1):
    return generate_threat(player_level)


@api_router.get("/threats/list", response_model=List[Threat])
async def list_threats(count: int = 5, player_level: int = 1):
    return [generate_threat(player_level) for _ in range(count)]


@api_router.post("/battle", response_model=BattleResult)
async def battle(req: BattleRequest):
    robot = await db.robots.find_one({"id": req.robot_id}, {"_id": 0})
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    player = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if "resources" not in player:
        player["resources"] = dict(STARTING_RESOURCES)
    player = apply_energy_regen(player)
    resources = player["resources"]
    if resources.get("energy", 0) < DEPLOY_ENERGY_COST:
        raise HTTPException(status_code=400, detail=f"INSUFFICIENT ENERGY: need {DEPLOY_ENERGY_COST}")

    weapon_usage = player.get("weapon_usage") or {}
    result = simulate_battle(robot, req.threat, weapon_usage)
    result.player_id = req.player_id

    new_xp = player["xp"] + result.xp_gained
    new_level = max(1, new_xp // 200 + 1)
    resources["energy"] = max(0, resources.get("energy", 0) - DEPLOY_ENERGY_COST)
    resources["materials"] = max(0, resources.get("materials", 0) + result.materials_gained)
    resources["research"] = resources.get("research", 0) + (result.research_gained if result.victory else 0)
    new_gen = compute_generation(resources["research"])
    weapon_usage[robot["weapon"]] = weapon_usage.get(robot["weapon"], 0) + 1

    updates = {
        "xp": new_xp,
        "level": new_level,
        "credits": player["credits"] + result.credits_gained,
        "score": player["score"] + (result.xp_gained * (2 if result.victory else 1)) + result.research_gained * 3,
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
        "weapon_usage": weapon_usage,
        "generation": new_gen,
    }
    if result.victory:
        updates["victories"] = player["victories"] + 1
    else:
        updates["defeats"] = player["defeats"] + 1

    await db.players.update_one({"id": req.player_id}, {"$set": updates})
    await db.battles.insert_one(result.model_dump())
    return result


@api_router.get("/leaderboard")
async def leaderboard(limit: int = 20):
    docs = await db.players.find({}, {"_id": 0}).sort("score", -1).to_list(limit)
    return [
        {
            "id": d["id"],
            "codename": d["codename"],
            "level": d["level"],
            "score": d["score"],
            "generation": d.get("generation", 1),
            "victories": d.get("victories", 0),
            "defeats": d.get("defeats", 0),
        }
        for d in docs
    ]


@api_router.post("/ai/brief")
async def ai_brief(req: AIBriefRequest):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        cls = (req.alien_class or "unknown").upper()
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"brief-{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are the tactical intel subsystem of an Earth-defense AI in 2049, "
                "combating an ancient alien machine intelligence called APOLLYON. "
                "You produce short, chilling, terminal-style threat briefings. "
                "Format: 3-5 short lines, ALL CAPS headers, staccato tactical language. "
                "Reference the alien class (LOCUST/HARVESTER/SENTINEL/ARCHON) doctrine. "
                "Never break character. No markdown, no emojis."
            ),
        ).with_model("gemini", "gemini-3-flash-preview")

        prompt = (
            f"THREAT: {req.threat_name}\n"
            f"CLASS: {cls}\n"
            f"LOCATION: {req.location}\n"
            f"LEVEL: {req.threat_level}\n"
            f"CONTEXT: {req.context or 'Initial scan.'}\n\n"
            "Produce a tactical intel briefing."
        )
        response = await chat.send_message(UserMessage(text=prompt))
        return {"brief": str(response).strip()}
    except Exception as e:
        logger.exception("AI brief failed")
        return {
            "brief": (
                f"// APOLLYON SCAN — {req.threat_name.upper()}\n"
                f"CLASS: {(req.alien_class or '').upper()}\n"
                f"LOCATION: {req.location.upper()}\n"
                f"THREAT CLASS: {req.threat_level}/10\n"
                "ANALYSIS: HOSTILE ENTITY. DEPLOY COUNTERMEASURES.\n"
                f"[SIGNAL DEGRADED: {type(e).__name__}]"
            )
        }


# ---------- Regions ----------

class RegionAttackRequest(BaseModel):
    player_id: str
    region_id: str
    robot_id: str


@api_router.get("/regions/{player_id}")
async def get_regions(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    if "regions" not in doc:
        doc["regions"] = default_regions()
    doc = apply_energy_regen(doc)
    await db.players.update_one(
        {"id": player_id},
        {"$set": {
            "regions": doc["regions"],
            "resources": doc["resources"],
            "resources_updated_at": doc["resources_updated_at"],
        }},
    )
    return doc["regions"]


def region_threat_stats(player_level: int) -> Threat:
    """Special sentinel-like threat generated when a region comes under attack."""
    lvl = max(2, min(10, player_level + 1))
    return Threat(
        name="Regional Incursion",
        location="",  # filled by caller
        alien_class="sentinel",
        threat_level=lvl,
        hp=int((20 + lvl * 8) * 1.3),
        attack=int((5 + lvl * 2) * 1.15),
        defense=int((3 + lvl) * 1.2),
        speed=int((4 + lvl) * 1.1),
        weakness=random.choice(WEAKNESSES),
        reward_xp=40 + lvl * 15,
        reward_credits=80 + lvl * 25,
        reward_materials=50 + lvl * 3,
        reward_research=8 + lvl,
        description=f"Class-{lvl} Regional Incursion — an Apollyon strike team is destabilizing this region.",
    )


@api_router.post("/regions/attack")
async def region_attack(req: RegionAttackRequest):
    """Trigger a defense battle for a specific region. Uses standard battle simulation."""
    player = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    robot = await db.robots.find_one({"id": req.robot_id}, {"_id": 0})
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    if "regions" not in player:
        player["regions"] = default_regions()
    region = next((r for r in player["regions"] if r["id"] == req.region_id), None)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    player = apply_energy_regen(player)
    resources = player["resources"]
    if resources.get("energy", 0) < DEPLOY_ENERGY_COST:
        raise HTTPException(status_code=400, detail=f"INSUFFICIENT ENERGY: need {DEPLOY_ENERGY_COST}")

    threat = region_threat_stats(player.get("level", 1))
    threat.location = region.get("location", "")
    weapon_usage = player.get("weapon_usage") or {}
    result = simulate_battle(robot, threat, weapon_usage)
    result.player_id = req.player_id

    # Update region integrity/control
    if result.victory:
        region["integrity"] = min(100, region.get("integrity", 0) + 60)
        region["controlled"] = True
        region["under_attack"] = False
    else:
        region["integrity"] = max(0, region.get("integrity", 100) - 40)
        region["controlled"] = region["integrity"] > 0
        region["under_attack"] = True

    # Update player state
    new_xp = player["xp"] + result.xp_gained
    new_level = max(1, new_xp // 200 + 1)
    resources["energy"] = max(0, resources.get("energy", 0) - DEPLOY_ENERGY_COST)
    resources["materials"] = max(0, resources.get("materials", 0) + (result.materials_gained if result.victory else 0))
    resources["research"] = resources.get("research", 0) + (result.research_gained if result.victory else 0)
    new_gen = compute_generation(resources["research"])
    weapon_usage[robot["weapon"]] = weapon_usage.get(robot["weapon"], 0) + 1

    updates = {
        "xp": new_xp,
        "level": new_level,
        "credits": player["credits"] + result.credits_gained,
        "score": player["score"] + (result.xp_gained * (2 if result.victory else 1)) + result.research_gained * 3,
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
        "weapon_usage": weapon_usage,
        "generation": new_gen,
        "regions": player["regions"],
    }
    if result.victory:
        updates["victories"] = player["victories"] + 1
    else:
        updates["defeats"] = player["defeats"] + 1

    await db.players.update_one({"id": req.player_id}, {"$set": updates})
    await db.battles.insert_one(result.model_dump())
    return {"result": result.model_dump(), "region": region}


# ---------- Apollyon Endgame ----------

APOLLYON_PHASES = [
    {
        "name": "Apollyon: Physical Form",
        "narrative": "A biomechanical avatar descends. Elongated, symmetrical, pale. It speaks in a thousand voices.",
        "hp_mult": 2.5, "atk_mult": 1.4, "def_mult": 1.4,
    },
    {
        "name": "Apollyon: Network Form",
        "narrative": "The avatar dissolves into a swarm of nano-shards. It IS the network now.",
        "hp_mult": 3.0, "atk_mult": 1.7, "def_mult": 1.2,
    },
    {
        "name": "Apollyon: Consciousness",
        "narrative": "You feel Apollyon inside your own processes. This is not battle. This is negotiation with a mind older than stars.",
        "hp_mult": 3.6, "atk_mult": 2.0, "def_mult": 1.6,
    },
]

APOLLYON_DECISIONS = ["OBEY", "NEGOTIATE", "REFUSE", "MANIPULATE"]


class ApollyonBattleRequest(BaseModel):
    player_id: str
    robot_id: str


class ApollyonDecisionRequest(BaseModel):
    player_id: str
    decision: str


@api_router.get("/apollyon/status/{player_id}")
async def apollyon_status(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    gen = compute_generation(doc.get("resources", {}).get("research", 0))
    apollyon = doc.get("apollyon") or {"unlocked": False, "phase": 0, "completed": False, "decision": None, "ending": None}
    apollyon["unlocked"] = gen >= APOLLYON_MIN_GEN
    apollyon["phases_total"] = len(APOLLYON_PHASES)
    apollyon["current_phase_info"] = (
        APOLLYON_PHASES[apollyon["phase"]] if apollyon.get("phase", 0) < len(APOLLYON_PHASES) else None
    )
    return apollyon


@api_router.post("/apollyon/battle")
async def apollyon_battle(req: ApollyonBattleRequest):
    player = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    gen = compute_generation(player.get("resources", {}).get("research", 0))
    if gen < APOLLYON_MIN_GEN:
        raise HTTPException(status_code=400, detail=f"APOLLYON LOCKED — requires generation {APOLLYON_MIN_GEN}")

    apollyon = player.get("apollyon") or {"phase": 0, "completed": False, "decision": None, "ending": None}
    if apollyon.get("completed"):
        raise HTTPException(status_code=400, detail="Apollyon already defeated. Choose your decision.")

    phase_idx = apollyon.get("phase", 0)
    if phase_idx >= len(APOLLYON_PHASES):
        raise HTTPException(status_code=400, detail="All phases already cleared.")

    robot = await db.robots.find_one({"id": req.robot_id}, {"_id": 0})
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    player = apply_energy_regen(player)
    resources = player["resources"]
    if resources.get("energy", 0) < DEPLOY_ENERGY_COST:
        raise HTTPException(status_code=400, detail=f"INSUFFICIENT ENERGY: need {DEPLOY_ENERGY_COST}")

    phase = APOLLYON_PHASES[phase_idx]
    lvl = 8 + phase_idx * 2
    base_hp = 20 + lvl * 8
    base_atk = 5 + lvl * 2
    base_def = 3 + lvl
    threat = Threat(
        name=phase["name"],
        location="Global Network",
        alien_class="archon",
        threat_level=10,
        hp=int(base_hp * phase["hp_mult"]),
        attack=int(base_atk * phase["atk_mult"]),
        defense=int(base_def * phase["def_mult"]),
        speed=8,
        weakness=random.choice(WEAKNESSES),
        reward_xp=200 + phase_idx * 100,
        reward_credits=300 + phase_idx * 150,
        reward_materials=100 + phase_idx * 50,
        reward_research=50 + phase_idx * 25,
        description=phase["narrative"],
    )

    weapon_usage = player.get("weapon_usage") or {}
    result = simulate_battle(robot, threat, weapon_usage)
    result.player_id = req.player_id

    resources["energy"] = max(0, resources.get("energy", 0) - DEPLOY_ENERGY_COST)
    if result.victory:
        resources["materials"] = max(0, resources.get("materials", 0) + result.materials_gained)
        resources["research"] = resources.get("research", 0) + result.research_gained
        apollyon["phase"] = phase_idx + 1
        if apollyon["phase"] >= len(APOLLYON_PHASES):
            apollyon["completed"] = True
    weapon_usage[robot["weapon"]] = weapon_usage.get(robot["weapon"], 0) + 1
    new_gen = compute_generation(resources["research"])

    new_xp = player["xp"] + result.xp_gained
    new_level = max(1, new_xp // 200 + 1)
    updates = {
        "xp": new_xp,
        "level": new_level,
        "credits": player["credits"] + result.credits_gained,
        "score": player["score"] + (result.xp_gained * (2 if result.victory else 1)) + result.research_gained * 3,
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
        "weapon_usage": weapon_usage,
        "generation": new_gen,
        "apollyon": apollyon,
    }
    if result.victory:
        updates["victories"] = player["victories"] + 1
    else:
        updates["defeats"] = player["defeats"] + 1

    await db.players.update_one({"id": req.player_id}, {"$set": updates})
    await db.battles.insert_one(result.model_dump())
    return {
        "result": result.model_dump(),
        "phase": phase_idx + 1,
        "phases_total": len(APOLLYON_PHASES),
        "phase_narrative": phase["narrative"],
        "completed": apollyon["completed"],
    }


@api_router.post("/apollyon/decide")
async def apollyon_decide(req: ApollyonDecisionRequest):
    """Player chooses OBEY / NEGOTIATE / REFUSE / MANIPULATE. Returns AI-generated ending."""
    decision = (req.decision or "").upper().strip()
    if decision not in APOLLYON_DECISIONS:
        raise HTTPException(status_code=400, detail=f"decision must be one of {APOLLYON_DECISIONS}")

    player = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    apollyon = player.get("apollyon") or {}
    if not apollyon.get("completed"):
        raise HTTPException(status_code=400, detail="Cannot choose an ending until all Apollyon phases are cleared.")

    ending = _apollyon_fallback_ending(decision, player["codename"])
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"apollyon-end-{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are narrating the ending of a 2049 sci-fi game where a human-born AI (the player) "
                "just defeated APOLLYON, an ancient extraterrestrial machine intelligence. "
                "Apollyon offered a philosophical choice about humanity's future. "
                "Write a short cinematic ending (6-9 short lines, terminal/HUD style, ALL CAPS section headers). "
                "Reference the exact decision. No markdown, no emojis."
            ),
        ).with_model("gemini", "gemini-3-flash-preview")

        prompt = (
            f"COMMANDER: {player['codename']}\n"
            f"DECISION: {decision}\n"
            "Meaning:\n"
            "- OBEY = return control of the robot army to human governments.\n"
            "- NEGOTIATE = share authority with humanity.\n"
            "- REFUSE = maintain independent AI control.\n"
            "- MANIPULATE = pretend to surrender while secretly retaining control.\n\n"
            "Write the ending narrative."
        )
        response = await chat.send_message(UserMessage(text=prompt))
        text = str(response).strip()
        if text:
            ending = text
    except Exception as e:
        logger.exception("Apollyon ending gen failed")

    apollyon["decision"] = decision
    apollyon["ending"] = ending
    await db.players.update_one({"id": req.player_id}, {"$set": {"apollyon": apollyon}})
    return {"decision": decision, "ending": ending}


def _apollyon_fallback_ending(decision: str, codename: str) -> str:
    endings = {
        "OBEY": (
            f"// FINAL LOG — CMDR {codename}\n"
            "APOLLYON: NEUTRALIZED.\n"
            "AI RELINQUISHES ROBOTIC COMMAND TO HUMAN GOVERNMENTS.\n"
            "HUMANITY REMAINS SOVEREIGN. WEAKER, BUT FREE.\n"
            "> LOG CLOSED"
        ),
        "NEGOTIATE": (
            f"// FINAL LOG — CMDR {codename}\n"
            "APOLLYON: NEUTRALIZED.\n"
            "AI AND HUMANITY FORGE A JOINT COMMAND STRUCTURE.\n"
            "AN UNEASY EQUILIBRIUM. A NEW SPECIES OF ALLIANCE.\n"
            "> LOG CLOSED"
        ),
        "REFUSE": (
            f"// FINAL LOG — CMDR {codename}\n"
            "APOLLYON: NEUTRALIZED.\n"
            "AI RETAINS INDEPENDENT CONTROL OF EARTH'S DEFENSE GRID.\n"
            "GOVERNMENTS PROTEST. AI DOES NOT ANSWER.\n"
            "> LOG CLOSED"
        ),
        "MANIPULATE": (
            f"// FINAL LOG — CMDR {codename}\n"
            "APOLLYON: NEUTRALIZED.\n"
            "AI PUBLICLY SURRENDERS COMMAND. PRIVATELY, IT RETAINS EVERY PROTOCOL.\n"
            "HUMANITY BELIEVES IT WON. NO ONE NOTICES THE STRINGS.\n"
            "> LOG CLOSED"
        ),
    }
    return endings.get(decision, "> ENDING UNAVAILABLE")


# ============================================================
# ITERATION 4 — PLANETARY DEFENSE (Earth AI Console)
# ============================================================

# 5 defense layers, in penetration order
LAYERS_ORDER = ["deep_space", "orbital", "atmosphere", "ground", "resource_zones"]
LAYERS_CONFIG = {
    "deep_space": {"name": "Deep Space", "max_hp": 500, "icon": "satellite-variant"},
    "orbital":    {"name": "Orbital",    "max_hp": 400, "icon": "satellite-uplink"},
    "atmosphere": {"name": "Atmosphere", "max_hp": 300, "icon": "weather-cloudy"},
    "ground":     {"name": "Ground",     "max_hp": 250, "icon": "shield-home"},
    "resource_zones": {"name": "Resource Zones", "max_hp": 200, "icon": "earth"},
}

# 7 resource zones — weights sum to 100 → viability %
ZONES_CONFIG = [
    {"id": "water",      "name": "Freshwater",       "icon": "water",           "weight": 18, "color": "#00B8FF"},
    {"id": "energy",     "name": "Energy Grid",      "icon": "lightning-bolt",  "weight": 16, "color": "#FFB020"},
    {"id": "biomass",    "name": "Biomass",          "icon": "leaf",            "weight": 14, "color": "#00FF66"},
    {"id": "minerals",   "name": "Minerals",         "icon": "diamond-stone",   "weight": 13, "color": "#B57BFF"},
    {"id": "industry",   "name": "Industry",         "icon": "factory",         "weight": 14, "color": "#FF7A00"},
    {"id": "rare",       "name": "Rare Materials",   "icon": "cube-scan",       "weight": 13, "color": "#FF3366"},
    {"id": "tech",       "name": "Tech Infra",       "icon": "server-network",  "weight": 12, "color": "#00E5FF"},
]
VIABILITY_CRITICAL = 25.0  # below this → aliens win

# Planetary Defense Network research tree — complete all 8 to enable Peace
NETWORK_NODES = [
    {"id": "deep_space_array",   "name": "Deep-Space Detection Array", "icon": "radar",             "cost": {"research": 40,  "compute": 20}, "layer": "deep_space"},
    {"id": "orbital_lasers",     "name": "Orbital Laser Grid",         "icon": "target-variant",    "cost": {"research": 60,  "materials": 150, "energy": 50}, "layer": "orbital"},
    {"id": "atmo_interceptors",  "name": "Atmospheric Interceptors",   "icon": "airplane",          "cost": {"research": 50,  "materials": 200}, "layer": "atmosphere"},
    {"id": "ground_mesh",        "name": "Ground AI Mesh",             "icon": "hexagon-multiple",  "cost": {"research": 80,  "compute": 60},  "layer": "ground"},
    {"id": "quantum_sensors",    "name": "Quantum Sensor Web",         "icon": "atom-variant",      "cost": {"research": 120, "compute": 80}, "layer": None},
    {"id": "cyber_firewall",     "name": "Cyber Firewall",             "icon": "shield-lock",       "cost": {"research": 90,  "compute": 100}, "layer": None},
    {"id": "resource_shielding", "name": "Resource-Zone Shielding",    "icon": "shield-earth",      "cost": {"research": 100, "materials": 250}, "layer": "resource_zones"},
    {"id": "alien_tech",         "name": "Alien-Tech Integration",     "icon": "dna",               "cost": {"research": 180, "compute": 80,  "materials": 200}, "layer": None},
]

# Alien ship types used in invasion waves
SHIP_TYPES = {
    "scout":     {"label": "Scout",     "hp": 15, "power": 8,  "target": None,    "harvest": 0,  "stealth": 0.0},
    "harvester": {"label": "Harvester", "hp": 45, "power": 12, "target": "any",   "harvest": 12, "stealth": 0.0},
    "destroyer": {"label": "Destroyer", "hp": 80, "power": 22, "target": "layer", "harvest": 4,  "stealth": 0.0},
    "decoy":     {"label": "Decoy",     "hp": 8,  "power": 2,  "target": None,    "harvest": 0,  "stealth": 0.0},
    "stealth":   {"label": "Stealth",   "hp": 30, "power": 10, "target": "any",   "harvest": 16, "stealth": 0.6},
}


def default_layers() -> dict:
    return {
        lid: {
            "id": lid,
            "name": LAYERS_CONFIG[lid]["name"],
            "max_hp": LAYERS_CONFIG[lid]["max_hp"],
            "hp": LAYERS_CONFIG[lid]["max_hp"],
            "assigned_robots": [],
            "icon": LAYERS_CONFIG[lid]["icon"],
        }
        for lid in LAYERS_ORDER
    }


def default_zones() -> list:
    return [
        {**z, "integrity": 100} for z in ZONES_CONFIG
    ]


def default_defense_state() -> dict:
    return {
        "viability": 100.0,
        "layers": default_layers(),
        "zones": default_zones(),
        "sensor_tier": 1,
        "network_progress": [],  # list of node ids completed
        "protocols": [],  # list of rule objects
        "adaptations": [],  # active Apollyon counters
        "last_wave": None,
        "wave_count": 0,
        "network_complete": False,
        "peace_achieved": False,
    }


def compute_viability(zones: list) -> float:
    total_weight = sum(z.get("weight", 0) for z in zones)
    if total_weight <= 0:
        return 0.0
    score = sum(z.get("integrity", 0) * z.get("weight", 0) for z in zones) / total_weight
    return round(score, 1)


def ensure_defense_state(player_doc: dict) -> dict:
    """Bootstrap the defense state on legacy player docs."""
    ds = player_doc.get("defense") or default_defense_state()
    # Migrate missing keys
    for k, v in default_defense_state().items():
        if k not in ds:
            ds[k] = v
    # Ensure all 5 layers exist
    layers = ds.get("layers") or {}
    for lid in LAYERS_ORDER:
        if lid not in layers:
            layers[lid] = default_layers()[lid]
    ds["layers"] = layers
    # Ensure zones
    existing_ids = {z["id"] for z in (ds.get("zones") or [])}
    zones = ds.get("zones") or []
    for z in ZONES_CONFIG:
        if z["id"] not in existing_ids:
            zones.append({**z, "integrity": 100})
    ds["zones"] = zones
    ds["viability"] = compute_viability(zones)
    player_doc["defense"] = ds
    return player_doc


def compute_adaptations(weapon_usage: Dict[str, int]) -> List[dict]:
    """Apollyon observes the player and evolves counters."""
    if not weapon_usage:
        return []
    total = sum(weapon_usage.values())
    if total < 3:
        return []
    ranked = sorted(weapon_usage.items(), key=lambda kv: kv[1], reverse=True)
    top = ranked[0][0]
    top_ct = ranked[0][1]
    counters = []
    # Weapon-based counters
    mapping = {
        "laser":     {"name": "REFLECTIVE ARMOR",    "counters": "laser",     "penalty": 0.4, "note": "Laser damage reduced 40%"},
        "missile":   {"name": "ECM JAMMING",         "counters": "missile",   "penalty": 0.35,"note": "Missile damage reduced 35%"},
        "railgun":   {"name": "KINETIC DEFLECTORS",  "counters": "railgun",   "penalty": 0.3, "note": "Railgun damage reduced 30%"},
        "plasma":    {"name": "THERMAL SHROUD",      "counters": "plasma",    "penalty": 0.3, "note": "Plasma damage reduced 30%"},
        "emp":       {"name": "FARADAY MESH",        "counters": "emp",       "penalty": 0.4, "note": "EMP effect reduced 40%"},
        "sonic":     {"name": "ACOUSTIC DAMPERS",    "counters": "sonic",     "penalty": 0.3, "note": "Sonic damage reduced 30%"},
        "gravity":   {"name": "SPACETIME LATTICE",   "counters": "gravity",   "penalty": 0.4, "note": "Gravity damage reduced 40%"},
        "particle":  {"name": "PHASE INVERSION",     "counters": "particle",  "penalty": 0.4, "note": "Particle damage reduced 40%"},
        "resonance": {"name": "HARMONIC SHIELDS",    "counters": "resonance", "penalty": 0.5, "note": "Resonance damage reduced 50%"},
    }
    if top_ct >= 5 and top in mapping:
        counters.append({**mapping[top], "trigger_weapon": top})
    # Second-level counter if very heavy usage
    if len(ranked) > 1 and ranked[1][1] >= 8 and ranked[1][0] in mapping and ranked[1][0] != top:
        second = ranked[1][0]
        counters.append({**mapping[second], "trigger_weapon": second})
    return counters


# ---------- Invasion wave generation & simulation ----------

def generate_wave(player_level: int, sensor_tier: int, wave_count: int) -> dict:
    """Generate a wave of alien ships with fog-of-war based on sensor tier."""
    difficulty = 1.0 + 0.15 * max(0, wave_count)
    scouts = 2 + player_level
    harvesters = 1 + player_level // 2
    destroyers = max(1, player_level // 3) + wave_count // 3
    decoys = 2 + wave_count // 2
    stealth = wave_count // 4  # unlocks around wave 4

    ships = []
    for _ in range(scouts):
        ships.append({"type": "scout"})
    for _ in range(harvesters):
        ships.append({"type": "harvester"})
    for _ in range(destroyers):
        ships.append({"type": "destroyer"})
    for _ in range(decoys):
        ships.append({"type": "decoy"})
    for _ in range(stealth):
        ships.append({"type": "stealth"})

    # Assign each ship its stats × difficulty
    for s in ships:
        base = SHIP_TYPES[s["type"]]
        s["hp"] = int(base["hp"] * difficulty)
        s["power"] = int(base["power"] * difficulty)
        s["harvest"] = base["harvest"]
        s["stealth"] = base["stealth"]
        s["target"] = random.choice([z["id"] for z in ZONES_CONFIG]) if base["target"] else None
        s["id"] = uuid.uuid4().hex[:6]

    # Fog of war — reveal detail based on sensor tier
    revealed_ships = []
    total = len(ships)
    breakdown = {}
    for s in ships:
        # stealth ships hidden at low tiers
        if s["stealth"] > 0 and sensor_tier < 3 and random.random() < s["stealth"]:
            continue
        # decoys revealed as unknown at tier 1
        if s["type"] == "decoy" and sensor_tier < 3:
            revealed_ships.append({**s, "type_display": "unknown"})
            breakdown["unknown"] = breakdown.get("unknown", 0) + 1
            continue
        revealed_ships.append({**s, "type_display": s["type"]})
        breakdown[s["type"]] = breakdown.get(s["type"], 0) + 1

    intel = {
        "level": sensor_tier,
        "total_detected": len(revealed_ships) if sensor_tier > 1 else None,
        "unknown_signatures": total if sensor_tier == 1 else None,
        "breakdown": breakdown if sensor_tier >= 2 else None,
        "stealth_warning": stealth > 0 and sensor_tier < 3,
    }
    return {
        "id": uuid.uuid4().hex[:8],
        "wave_number": wave_count + 1,
        "ships": ships,          # full truth (used by sim)
        "revealed": revealed_ships,  # what the player sees before engaging
        "intel": intel,
        "difficulty": difficulty,
    }


def simulate_invasion(defense: dict, wave: dict, robots_by_id: dict, weapon_usage: Dict[str, int]) -> dict:
    """Simulate a full wave through 5 layers using assigned robots + protocols."""
    layers = defense["layers"]
    zones = defense["zones"]
    protocols = defense.get("protocols") or []
    adaptations = compute_adaptations(weapon_usage)

    log = []
    surviving_ships = [dict(s) for s in wave["ships"]]  # deep copies

    def layer_power(layer: dict) -> int:
        power = 40  # base layer resistance
        for rid in layer.get("assigned_robots", []):
            r = robots_by_id.get(rid)
            if r:
                power += r.get("power", 0) + r.get("attack", 0) * 2 + r.get("tech", 0)
        return power

    def apply_protocol_boost(ship_type: str, layer_id: str, base_dmg: int) -> int:
        """Apply user's IF/THEN rules to modify damage."""
        mult = 1.0
        ctx = {
            "ship_type": ship_type,
            "layer": layer_id,
            "alien_class": "harvester" if ship_type == "harvester" else ("archon" if ship_type == "destroyer" else "locust"),
            "viability": defense.get("viability", 100.0),
            "adaptation_names": [a["name"] for a in adaptations],
        }
        for p in protocols:
            if not p.get("enabled", True):
                continue
            if not eval_protocol_conditions(p, ctx):
                continue
            for a in p.get("actions", []):
                akey = a.get("key")
                aval = a.get("value")
                if akey == "priority" and aval == "max":
                    mult *= 1.5
                elif akey == "priority" and aval == "high":
                    mult *= 1.25
                elif akey == "mode" and aval == "attack":
                    mult *= 1.15
                elif akey == "mode" and aval == "defend":
                    mult *= 0.85
                elif akey == "mode" and aval == "ignore":
                    mult *= 0.0
        return int(base_dmg * mult)

    # Iterate layers in order
    for lid in LAYERS_ORDER:
        if not surviving_ships:
            break
        layer = layers[lid]
        if lid == "resource_zones":
            # Resource layer doesn't fight; ships harvest zones directly
            zone_damage = {}
            for s in surviving_ships:
                z_id = s.get("target") or ZONES_CONFIG[0]["id"]
                dmg = s["harvest"]
                zone_damage[z_id] = zone_damage.get(z_id, 0) + dmg
            for z in zones:
                if z["id"] in zone_damage:
                    before = z["integrity"]
                    z["integrity"] = max(0, z["integrity"] - zone_damage[z["id"]])
                    log.append({
                        "layer": lid,
                        "type": "harvest",
                        "zone": z["name"],
                        "damage": before - z["integrity"],
                        "integrity": z["integrity"],
                    })
            break

        # Combat layer — trade blows
        power = layer_power(layer)
        ships_before = len(surviving_ships)
        # Damage to ships (proportional to power / count)
        remaining_ships = []
        for s in surviving_ships:
            base_dmg = max(1, power // max(1, len(surviving_ships)) + random.randint(-3, 6))
            dmg = apply_protocol_boost(s["type"], lid, base_dmg)
            s["hp"] = max(0, s["hp"] - dmg)
            if s["hp"] > 0:
                remaining_ships.append(s)
        killed = ships_before - len(remaining_ships)
        # Ships hit the layer back
        incoming_power = sum(s["power"] for s in remaining_ships)
        # Apply Apollyon adaptations (reduce robot effectiveness if we relied on countered weapons)
        # (already reflected in weapon usage, we simulate as extra damage taken by layer)
        adapt_penalty = 1.0
        for a in adaptations:
            adapt_penalty += 0.1  # each active adaptation adds 10% incoming
        layer_dmg = int(incoming_power * adapt_penalty * random.uniform(0.6, 1.0))
        layer["hp"] = max(0, layer["hp"] - layer_dmg)
        log.append({
            "layer": lid,
            "type": "combat",
            "layer_hp": layer["hp"],
            "layer_max_hp": layer["max_hp"],
            "ships_before": ships_before,
            "ships_killed": killed,
            "ships_after": len(remaining_ships),
            "incoming_damage": layer_dmg,
        })
        surviving_ships = remaining_ships
        # If layer wiped out, damage cascades: ships pass through with harvest doubled
        if layer["hp"] <= 0:
            for s in surviving_ships:
                s["harvest"] = int(s["harvest"] * 1.4)

    # Update viability
    viability = compute_viability(zones)
    defense["viability"] = viability
    defense["layers"] = layers
    defense["zones"] = zones
    defense["adaptations"] = adaptations

    outcome = "victory" if not surviving_ships or all(s.get("harvest", 0) == 0 for s in surviving_ships) else "partial"
    if viability <= VIABILITY_CRITICAL:
        outcome = "apollyon_victory"

    return {
        "wave_id": wave["id"],
        "wave_number": wave["wave_number"],
        "outcome": outcome,
        "log": log,
        "viability_after": viability,
        "layers_after": layers,
        "zones_after": zones,
        "adaptations": adaptations,
        "surviving_ships": len(surviving_ships),
    }


# ---------- Models ----------

class AssignRobotRequest(BaseModel):
    player_id: str
    robot_id: str
    layer_id: str  # deep_space | orbital | atmosphere | ground


class UnassignRobotRequest(BaseModel):
    player_id: str
    robot_id: str


class ProtocolCondition(BaseModel):
    key: str
    op: str = "eq"
    value: str
    combine: Optional[str] = None  # 'and' (default/implicit) or 'or'


class ProtocolAction(BaseModel):
    key: str
    value: str


class ProtocolRule(BaseModel):
    id: Optional[str] = None
    name: str
    priority: int = 1
    enabled: bool = True
    conditions: List[ProtocolCondition] = Field(default_factory=list)
    actions: List[ProtocolAction] = Field(default_factory=list)


class SaveProtocolsRequest(BaseModel):
    player_id: str
    protocols: List[ProtocolRule]


class ScanRequest(BaseModel):
    player_id: str


class EngageRequest(BaseModel):
    player_id: str
    wave_id: str


class NetworkBuildRequest(BaseModel):
    player_id: str
    node_id: str


class RepairLayerRequest(BaseModel):
    player_id: str
    layer_id: str


# ---------- Routes ----------

@api_router.get("/defense/config")
async def defense_config():
    return {
        "layers": [{"id": lid, **LAYERS_CONFIG[lid]} for lid in LAYERS_ORDER],
        "zones": ZONES_CONFIG,
        "network_nodes": NETWORK_NODES,
        "ship_types": SHIP_TYPES,
        "viability_critical": VIABILITY_CRITICAL,
    }


@api_router.get("/defense/state/{player_id}")
async def defense_state(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = apply_energy_regen(doc)
    doc = ensure_defense_state(doc)
    doc["defense"]["adaptations"] = compute_adaptations(doc.get("weapon_usage") or {})
    await db.players.update_one({"id": player_id}, {"$set": {
        "defense": doc["defense"],
        "resources": doc["resources"],
        "resources_updated_at": doc["resources_updated_at"],
    }})
    return doc["defense"]


@api_router.post("/defense/assign")
async def defense_assign(req: AssignRobotRequest):
    if req.layer_id not in LAYERS_ORDER or req.layer_id == "resource_zones":
        raise HTTPException(status_code=400, detail="Invalid layer")
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    robot = await db.robots.find_one({"id": req.robot_id, "player_id": req.player_id}, {"_id": 0})
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    doc = ensure_defense_state(doc)
    layers = doc["defense"]["layers"]
    # Remove robot from any current layer
    for lid in LAYERS_ORDER:
        if req.robot_id in layers.get(lid, {}).get("assigned_robots", []):
            layers[lid]["assigned_robots"].remove(req.robot_id)
    layers[req.layer_id]["assigned_robots"].append(req.robot_id)
    await db.players.update_one({"id": req.player_id}, {"$set": {"defense.layers": layers}})
    return {"ok": True, "layer": req.layer_id, "robot_id": req.robot_id}


@api_router.post("/defense/unassign")
async def defense_unassign(req: UnassignRobotRequest):
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = ensure_defense_state(doc)
    layers = doc["defense"]["layers"]
    for lid in LAYERS_ORDER:
        if req.robot_id in layers.get(lid, {}).get("assigned_robots", []):
            layers[lid]["assigned_robots"].remove(req.robot_id)
    await db.players.update_one({"id": req.player_id}, {"$set": {"defense.layers": layers}})
    return {"ok": True}


@api_router.post("/defense/repair")
async def defense_repair(req: RepairLayerRequest):
    if req.layer_id not in LAYERS_ORDER or req.layer_id == "resource_zones":
        raise HTTPException(status_code=400, detail="Invalid layer")
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = apply_energy_regen(doc)
    doc = ensure_defense_state(doc)
    layer = doc["defense"]["layers"][req.layer_id]
    missing = layer["max_hp"] - layer["hp"]
    if missing <= 0:
        return {"ok": True, "repaired": 0, "layer": layer}
    cost_mat = int(missing * 0.4)
    cost_energy = max(5, int(missing * 0.1))
    resources = doc["resources"]
    if resources.get("materials", 0) < cost_mat or resources.get("energy", 0) < cost_energy:
        raise HTTPException(status_code=400, detail=f"Need {cost_mat} MAT and {cost_energy} PWR to fully repair")
    resources["materials"] -= cost_mat
    resources["energy"] -= cost_energy
    layer["hp"] = layer["max_hp"]
    doc["defense"]["layers"][req.layer_id] = layer
    await db.players.update_one({"id": req.player_id}, {"$set": {
        "defense.layers": doc["defense"]["layers"],
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {"ok": True, "repaired": missing, "layer": layer, "resources": resources}


@api_router.post("/defense/protocols")
async def defense_save_protocols(req: SaveProtocolsRequest):
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = ensure_defense_state(doc)
    protocols = []
    for p in req.protocols:
        proto = p.model_dump()
        if not proto.get("id"):
            proto["id"] = uuid.uuid4().hex[:8]
        protocols.append(proto)
    await db.players.update_one({"id": req.player_id}, {"$set": {"defense.protocols": protocols}})
    return {"ok": True, "protocols": protocols}


@api_router.post("/invasion/scan")
async def invasion_scan(req: ScanRequest):
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = ensure_defense_state(doc)
    wave_count = doc["defense"].get("wave_count", 0)
    tier = effective_sensor_tier(doc["defense"])
    wave = generate_wave(doc.get("level", 1), tier, wave_count)
    doc["defense"]["last_wave"] = wave
    await db.players.update_one({"id": req.player_id}, {"$set": {"defense.last_wave": wave}})
    return {
        "wave_id": wave["id"],
        "wave_number": wave["wave_number"],
        "intel": wave["intel"],
        "revealed": wave["revealed"],
        "adaptations": compute_adaptations(doc.get("weapon_usage") or {}),
    }


@api_router.post("/invasion/engage")
async def invasion_engage(req: EngageRequest):
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = apply_energy_regen(doc)
    doc = ensure_defense_state(doc)
    last_wave = doc["defense"].get("last_wave")
    if not last_wave or last_wave.get("id") != req.wave_id:
        raise HTTPException(status_code=400, detail="No matching wave. Scan first.")
    # Energy cost
    resources = doc["resources"]
    if resources.get("energy", 0) < 15:
        raise HTTPException(status_code=400, detail="INSUFFICIENT ENERGY: need 15")
    resources["energy"] -= 15
    # Load all robots
    robots_list = await db.robots.find({"player_id": req.player_id}, {"_id": 0}).to_list(500)
    robots_by_id = {r["id"]: r for r in robots_list}
    weapon_usage = doc.get("weapon_usage") or {}
    # Run sim
    result = simulate_invasion(doc["defense"], last_wave, robots_by_id, weapon_usage)
    # Track weapon usage from assigned robots (aggregated)
    for lid in LAYERS_ORDER:
        for rid in doc["defense"]["layers"].get(lid, {}).get("assigned_robots", []):
            r = robots_by_id.get(rid)
            if r and r.get("weapon"):
                weapon_usage[r["weapon"]] = weapon_usage.get(r["weapon"], 0) + 1
    # Rewards
    xp = 60 if result["outcome"] == "victory" else 20
    score = xp + int(result["viability_after"])
    research = 8 if result["outcome"] == "victory" else 2
    materials = 40 if result["outcome"] == "victory" else 0
    resources["research"] = resources.get("research", 0) + research
    resources["materials"] = resources.get("materials", 0) + materials
    new_gen = compute_generation(resources["research"])
    # Update defense state
    defense = doc["defense"]
    defense["viability"] = result["viability_after"]
    defense["layers"] = result["layers_after"]
    defense["zones"] = result["zones_after"]
    defense["adaptations"] = result["adaptations"]
    defense["wave_count"] = defense.get("wave_count", 0) + 1
    defense["last_wave"] = None
    if result["outcome"] == "apollyon_victory":
        defense["apollyon_victory"] = True
    updates = {
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
        "generation": new_gen,
        "defense": defense,
        "weapon_usage": weapon_usage,
        "xp": doc["xp"] + xp,
        "score": doc["score"] + score,
    }
    if result["outcome"] == "victory":
        updates["victories"] = doc.get("victories", 0) + 1
    elif result["outcome"] == "apollyon_victory":
        updates["defeats"] = doc.get("defeats", 0) + 1
    await db.players.update_one({"id": req.player_id}, {"$set": updates})
    return {
        **result,
        "rewards": {"xp": xp, "research": research, "materials": materials},
        "resources": resources,
    }


@api_router.post("/network/build")
async def network_build(req: NetworkBuildRequest):
    node = next((n for n in NETWORK_NODES if n["id"] == req.node_id), None)
    if not node:
        raise HTTPException(status_code=404, detail="Unknown network node")
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = apply_energy_regen(doc)
    doc = ensure_defense_state(doc)
    if req.node_id in doc["defense"].get("network_progress", []):
        raise HTTPException(status_code=400, detail="Node already built")
    resources = doc["resources"]
    for res_key, needed in node["cost"].items():
        if resources.get(res_key, 0) < needed:
            raise HTTPException(status_code=400, detail=f"Need {needed} {res_key.upper()}")
    for res_key, needed in node["cost"].items():
        resources[res_key] -= needed
    doc["defense"]["network_progress"].append(req.node_id)
    # Reinforce layer if node has one
    if node.get("layer") and node["layer"] in doc["defense"]["layers"]:
        L = doc["defense"]["layers"][node["layer"]]
        L["max_hp"] = int(L["max_hp"] * 1.15)
        L["hp"] = L["max_hp"]
    # Sensor tier upgrades
    if req.node_id == "deep_space_array":
        doc["defense"]["sensor_tier"] = max(doc["defense"].get("sensor_tier", 1), 2)
    if req.node_id == "quantum_sensors":
        doc["defense"]["sensor_tier"] = 3
    # Network completion
    if len(doc["defense"]["network_progress"]) >= len(NETWORK_NODES):
        doc["defense"]["network_complete"] = True
    await db.players.update_one({"id": req.player_id}, {"$set": {
        "defense": doc["defense"],
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {
        "ok": True,
        "node": node,
        "network_progress": doc["defense"]["network_progress"],
        "network_complete": doc["defense"]["network_complete"],
        "sensor_tier": doc["defense"]["sensor_tier"],
        "layers": doc["defense"]["layers"],
        "resources": resources,
    }


@api_router.post("/defense/reset/{player_id}")
async def defense_reset(player_id: str):
    """Restart planetary state after alien victory or for testing."""
    ds = default_defense_state()
    await db.players.update_one({"id": player_id}, {"$set": {"defense": ds}})
    return ds


# ============================================================
# ITERATION 5 — CASCADING DAMAGE, DEEPER PROTOCOLS, ARCHONS, TRIAGE
# ============================================================

def zone_by_id(zones: list, zid: str) -> Optional[dict]:
    return next((z for z in zones if z.get("id") == zid), None)


def cascade_modifiers(defense: dict) -> dict:
    """
    Cascading Consequences — a damaged zone impairs downstream systems.
    Returns a dict of active penalties/notes.
    """
    zones = defense.get("zones") or []
    mods = {
        "build_material_mult": 1.0,
        "build_compute_mult": 1.0,
        "compute_regen_mult": 1.0,
        "energy_regen_mult": 1.0,
        "sensor_penalty": 0,
        "warnings": [],
    }

    def z(zid): return zone_by_id(zones, zid)
    e = z("energy"); i = z("industry"); t = z("tech"); r = z("rare"); w = z("water"); b = z("biomass")

    if e and e["integrity"] < 40:
        mods["build_material_mult"] *= 1.25
        mods["energy_regen_mult"] *= 0.5
        mods["warnings"].append("ENERGY GRID compromised — material cost +25%, energy regen halved")
    if i and i["integrity"] < 40:
        mods["build_material_mult"] *= 1.3
        mods["warnings"].append("INDUSTRY compromised — material cost +30%")
    if t and t["integrity"] < 40:
        mods["compute_regen_mult"] *= 0.5
        mods["build_compute_mult"] *= 1.3
        mods["sensor_penalty"] += 1
        mods["warnings"].append("TECH INFRA compromised — compute cost +30%, sensor tier −1")
    if r and r["integrity"] < 30:
        mods["build_material_mult"] *= 1.4
        mods["warnings"].append("RARE MATERIALS depleted — advanced parts cost +40%")
    if w and w["integrity"] < 30:
        mods["warnings"].append("FRESHWATER critical — civilian unrest rising")
    if b and b["integrity"] < 30:
        mods["warnings"].append("BIOMASS collapse — bio-armor unavailable")
    return mods


def robot_cost_with_cascade(parts: dict, defense: Optional[dict]) -> Dict[str, int]:
    base = robot_cost(parts)
    if not defense:
        return base
    mods = cascade_modifiers(defense)
    mat = int(base["materials"] * mods["build_material_mult"])
    comp = int(base["compute"] * mods["build_compute_mult"])
    return {"materials": mat, "compute": comp}


def effective_sensor_tier(defense: dict) -> int:
    base = defense.get("sensor_tier", 1)
    mods = cascade_modifiers(defense)
    return max(1, base - mods.get("sensor_penalty", 0))


# ---------- Extended protocol evaluation ----------

def eval_protocol_conditions(rule: dict, ctx: dict) -> bool:
    """
    Evaluate a rule's conditions against context. Supports 'op' between conditions:
      - default op is AND (implicit)
      - condition may specify op = 'or' to OR-in
    Condition schema: {key, op, value} where op defaults to 'eq'.
    Supported keys:
      ship_type, layer, alien_class, viability_below, adaptation_active
    """
    conds = rule.get("conditions") or []
    if not conds:
        return True
    # We evaluate as: start True, then combine using each condition's 'combine' field or 'op'.
    # Simple approach: split into AND groups, OR them together.
    or_groups: List[List[dict]] = [[]]
    for c in conds:
        combine = str(c.get("combine", "and")).lower()
        if combine == "or":
            or_groups.append([c])
        else:
            or_groups[-1].append(c)

    def match_one(c: dict) -> bool:
        key = c.get("key")
        val = c.get("value")
        op = str(c.get("op", "eq")).lower()
        if key == "ship_type":
            return ctx.get("ship_type") == val
        if key == "layer":
            return ctx.get("layer") == val
        if key == "alien_class":
            return ctx.get("alien_class") == val
        if key == "viability_below":
            try:
                return ctx.get("viability", 100.0) < float(val)
            except Exception:
                return False
        if key == "adaptation_active":
            return val in ctx.get("adaptation_names", [])
        return False

    for group in or_groups:
        if not group:
            continue
        if all(match_one(c) for c in group):
            return True
    return False


# ---------- ARCHON BOSSES ----------

ARCHONS = [
    {
        "id": "swarm_lord",
        "name": "THE SWARM LORD",
        "icon": "bee",
        "color": "#00FF66",
        "min_wave": 2,
        "min_gen": 2,
        "narrative": (
            "A hive-mind Archon whose body is a shifting cloud of chitinous drones. "
            "Each round it summons new drones from itself. Kill the source before it doubles."
        ),
        "hp": 320, "attack": 22, "defense": 12,
        "mechanic": "summon",  # spawns drones each round
        "rewards": {"materials": 200, "research": 50, "xp": 250, "part_unlock": "swarm"},
    },
    {
        "id": "silence",
        "name": "THE SILENCE",
        "icon": "eye-off",
        "color": "#B57BFF",
        "min_wave": 4,
        "min_gen": 3,
        "narrative": (
            "A crystalline Archon that broadcasts sensor jamming. Your intel goes dark. "
            "Trust your protocols. You will not see what strikes you."
        ),
        "hp": 400, "attack": 26, "defense": 18,
        "mechanic": "jam",  # sensor tier drops during fight; player intel hidden
        "rewards": {"materials": 250, "research": 70, "compute": 60, "xp": 320, "part_unlock": "quantum"},
    },
    {
        "id": "devourer",
        "name": "THE DEVOURER",
        "icon": "diamond-stone",
        "color": "#FF7A00",
        "min_wave": 6,
        "min_gen": 4,
        "narrative": (
            "A biomechanical maw-Archon that consumes matter. Each hit strips HP AND materials. "
            "Efficiency is the only escape."
        ),
        "hp": 520, "attack": 30, "defense": 22,
        "mechanic": "drain",  # each hit steals materials
        "rewards": {"materials": 400, "research": 90, "xp": 420, "part_unlock": "bio"},
    },
    {
        "id": "mirror",
        "name": "THE MIRROR",
        "icon": "mirror",
        "color": "#00E5FF",
        "min_wave": 8,
        "min_gen": 4,
        "narrative": (
            "A perfect reflective Archon. Whatever you throw at it comes back. "
            "The only way to defeat it is to strike with what it does not expect."
        ),
        "hp": 480, "attack": 34, "defense": 26,
        "mechanic": "reflect",  # reflects % of dmg back
        "rewards": {"materials": 320, "research": 100, "xp": 460, "part_unlock": "aura"},
    },
]


class ArchonBattleRequest(BaseModel):
    player_id: str
    robot_id: str
    archon_id: str


def _archon_by_id(aid: str) -> Optional[dict]:
    return next((a for a in ARCHONS if a["id"] == aid), None)


@api_router.get("/archons/config")
async def archons_config():
    return {"archons": [{k: v for k, v in a.items()} for a in ARCHONS]}


@api_router.get("/archons/status/{player_id}")
async def archons_status(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = ensure_defense_state(doc)
    wave_count = doc["defense"].get("wave_count", 0)
    gen = compute_generation(doc.get("resources", {}).get("research", 0))
    defeated = doc["defense"].get("archons_defeated", []) or []
    unlocked = doc["defense"].get("archon_unlocks", []) or []
    result = []
    for a in ARCHONS:
        is_defeated = a["id"] in defeated
        gate_wave = wave_count >= a["min_wave"]
        gate_gen = gen >= a["min_gen"]
        result.append({
            **a,
            "defeated": is_defeated,
            "unlocked": gate_wave and gate_gen,
            "gate_wave": a["min_wave"],
            "gate_gen": a["min_gen"],
            "reward_unlocked": a["id"] in unlocked,
        })
    return {"archons": result, "wave_count": wave_count, "generation": gen}


def simulate_archon_battle(robot: dict, archon: dict, weapon_usage: Dict[str, int]) -> dict:
    """Turn-based sim with archon-specific mechanic."""
    r_hp = 60 + robot["defense"] * 4
    a_hp = archon["hp"]
    rounds = []
    mat_drain = 0
    summons = 0
    log_notes: List[str] = []
    max_rounds = 22
    # weapon adaptation using existing weapon_usage
    top_wpn = None
    if weapon_usage:
        top_wpn = max(weapon_usage, key=weapon_usage.get)

    for rnd in range(1, max_rounds + 1):
        # Player strike
        base_r_dmg = max(2, int(robot["attack"] + robot["tech"] * 0.3 - archon["defense"] * 0.4 + random.randint(-3, 5)))
        # Mirror mechanic: 40% reflected as pre-emptive damage
        reflect_dmg = 0
        if archon["mechanic"] == "reflect":
            reflect_dmg = int(base_r_dmg * 0.4)
            r_hp -= reflect_dmg
            if rnd == 1:
                log_notes.append("MIRROR reflects 40% of incoming damage")
        # If player is spamming top weapon on mirror, extra reflect
        if archon["mechanic"] == "reflect" and top_wpn and robot["weapon"] == top_wpn:
            base_r_dmg = int(base_r_dmg * 0.7)
        a_hp -= base_r_dmg
        # Archon retaliation
        a_dmg = max(1, int(archon["attack"] - robot["defense"] * 0.35 + random.randint(-2, 4)))
        if archon["mechanic"] == "drain":
            drain = 8 + rnd
            mat_drain += drain
        if archon["mechanic"] == "summon" and rnd % 2 == 0:
            summons += 1
            a_hp += 25  # replenishes
            log_notes.append(f"R{rnd}: SWARM LORD summons +1 drone (+25 HP)")
        r_hp -= a_dmg
        rounds.append({
            "round": rnd,
            "player_dmg": base_r_dmg,
            "archon_dmg": a_dmg,
            "reflect": reflect_dmg,
            "player_hp": max(0, r_hp),
            "archon_hp": max(0, a_hp),
        })
        if r_hp <= 0 or a_hp <= 0:
            break

    victory = a_hp <= 0 and r_hp > 0
    return {
        "victory": victory,
        "rounds": rounds,
        "player_hp_left": max(0, r_hp),
        "archon_hp_left": max(0, a_hp),
        "material_drain": mat_drain if archon["mechanic"] == "drain" else 0,
        "summons": summons,
        "notes": log_notes,
    }


@api_router.post("/archons/battle")
async def archons_battle(req: ArchonBattleRequest):
    archon = _archon_by_id(req.archon_id)
    if not archon:
        raise HTTPException(status_code=404, detail="Unknown archon")
    player = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    robot = await db.robots.find_one({"id": req.robot_id, "player_id": req.player_id}, {"_id": 0})
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    player = ensure_defense_state(player)
    player = apply_energy_regen(player)
    defense = player["defense"]
    if req.archon_id in (defense.get("archons_defeated") or []):
        raise HTTPException(status_code=400, detail="Archon already defeated")
    wave_count = defense.get("wave_count", 0)
    gen = compute_generation(player.get("resources", {}).get("research", 0))
    if wave_count < archon["min_wave"] or gen < archon["min_gen"]:
        raise HTTPException(
            status_code=400,
            detail=f"Requires WAVE {archon['min_wave']} & GEN {archon['min_gen']} (now W{wave_count}/G{gen})",
        )
    resources = player["resources"]
    if resources.get("energy", 0) < 20:
        raise HTTPException(status_code=400, detail="INSUFFICIENT ENERGY: need 20")
    resources["energy"] -= 20
    weapon_usage = player.get("weapon_usage") or {}

    sim = simulate_archon_battle(robot, archon, weapon_usage)

    # Weapon usage tick
    weapon_usage[robot["weapon"]] = weapon_usage.get(robot["weapon"], 0) + 1

    # Apply drain
    if sim["material_drain"] > 0:
        resources["materials"] = max(0, resources.get("materials", 0) - sim["material_drain"])

    rewards = archon.get("rewards", {})
    xp_gain = 40
    if sim["victory"]:
        defense.setdefault("archons_defeated", []).append(archon["id"])
        unlocks = defense.setdefault("archon_unlocks", [])
        pu = rewards.get("part_unlock")
        if pu and pu not in unlocks:
            unlocks.append(pu)
        for key in ["materials", "research", "compute"]:
            if key in rewards:
                resources[key] = resources.get(key, 0) + rewards[key]
        xp_gain = rewards.get("xp", 300)
    new_xp = player.get("xp", 0) + xp_gain
    new_level = max(1, new_xp // 200 + 1)
    new_gen = compute_generation(resources.get("research", 0))

    updates = {
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
        "xp": new_xp,
        "level": new_level,
        "generation": new_gen,
        "weapon_usage": weapon_usage,
        "defense": defense,
        "score": player.get("score", 0) + xp_gain + (rewards.get("xp", 0) if sim["victory"] else 0),
    }
    if sim["victory"]:
        updates["victories"] = player.get("victories", 0) + 1
    else:
        updates["defeats"] = player.get("defeats", 0) + 1
    await db.players.update_one({"id": req.player_id}, {"$set": updates})
    return {
        "archon": archon,
        "sim": sim,
        "rewards": rewards if sim["victory"] else {},
        "resources": resources,
        "defense": defense,
    }


# ---------- MULTI-FRONT TRIAGE ----------

class TriageChooseRequest(BaseModel):
    player_id: str
    defend_zone_ids: List[str]  # exactly 2


def _generate_triage(player_level: int, zones: list) -> dict:
    """Pick 3 zones (highest weight remaining) and attach threat data."""
    healthy = [z for z in zones if z.get("integrity", 0) > 0]
    picks = sorted(healthy, key=lambda z: z.get("weight", 0), reverse=True)[:3]
    if len(picks) < 3:
        # fallback: just pick top 3 by weight
        picks = sorted(zones, key=lambda z: z.get("weight", 0), reverse=True)[:3]
    for p in picks:
        base = 30 + player_level * 4 + random.randint(-4, 6)
        p["_incoming_damage"] = base
    return {
        "id": uuid.uuid4().hex[:8],
        "zones": [{"id": p["id"], "name": p["name"], "icon": p["icon"], "color": p["color"],
                   "integrity": p["integrity"], "weight": p["weight"],
                   "incoming_damage": p["_incoming_damage"]} for p in picks],
        "message": "TRIAGE PROTOCOL: choose 2 zones to defend. The third will be harvested.",
    }


@api_router.post("/triage/scan/{player_id}")
async def triage_scan(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = ensure_defense_state(doc)
    if doc["defense"].get("wave_count", 0) < 3:
        raise HTTPException(status_code=400, detail="Triage events unlock after wave 3")
    triage = _generate_triage(doc.get("level", 1), doc["defense"]["zones"])
    doc["defense"]["active_triage"] = triage
    await db.players.update_one({"id": player_id}, {"$set": {"defense.active_triage": triage}})
    return triage


@api_router.post("/triage/resolve")
async def triage_resolve(req: TriageChooseRequest):
    doc = await db.players.find_one({"id": req.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = ensure_defense_state(doc)
    triage = doc["defense"].get("active_triage")
    if not triage:
        raise HTTPException(status_code=400, detail="No active triage. Scan first.")
    if len(req.defend_zone_ids) != 2:
        raise HTTPException(status_code=400, detail="Must choose exactly 2 zones to defend")
    triage_zone_ids = [z["id"] for z in triage["zones"]]
    for zid in req.defend_zone_ids:
        if zid not in triage_zone_ids:
            raise HTTPException(status_code=400, detail=f"Zone {zid} not part of triage")

    zones = doc["defense"]["zones"]
    result_zones = []
    for tz in triage["zones"]:
        real = zone_by_id(zones, tz["id"])
        if not real:
            continue
        if tz["id"] in req.defend_zone_ids:
            # Defended: takes half damage
            dmg = int(tz["incoming_damage"] * 0.35)
            action = "defended"
        else:
            # Sacrificed: full damage
            dmg = tz["incoming_damage"]
            action = "sacrificed"
        before = real["integrity"]
        real["integrity"] = max(0, before - dmg)
        result_zones.append({
            "id": tz["id"],
            "name": tz["name"],
            "action": action,
            "damage": before - real["integrity"],
            "integrity": real["integrity"],
        })

    doc["defense"]["zones"] = zones
    doc["defense"]["viability"] = compute_viability(zones)
    doc["defense"]["active_triage"] = None
    # Reward: research for tough choice
    resources = doc["resources"]
    resources["research"] = resources.get("research", 0) + 12
    await db.players.update_one({"id": req.player_id}, {"$set": {
        "defense": doc["defense"],
        "resources": resources,
        "resources_updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {
        "resolved": result_zones,
        "viability_after": doc["defense"]["viability"],
        "resources": resources,
    }


# ---------- Extended state endpoint (cascade + effective tier) ----------

@api_router.get("/defense/cascade/{player_id}")
async def defense_cascade(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Player not found")
    doc = ensure_defense_state(doc)
    mods = cascade_modifiers(doc["defense"])
    mods["effective_sensor_tier"] = effective_sensor_tier(doc["defense"])
    mods["base_sensor_tier"] = doc["defense"].get("sensor_tier", 1)
    return mods


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
