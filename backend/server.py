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
            }},
        )
        return Player(**existing)

    p = Player(codename=codename)
    p.resources_updated_at = datetime.now(timezone.utc).isoformat()
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

    cost = robot_cost(parts)
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
