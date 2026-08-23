"""Iteration 2 backend tests: catalog, resources, generations, adaptation, harvester penalty."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend/.env style
    from pathlib import Path
    envp = Path("/app/frontend/.env")
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
API = f"{BASE_URL}/api"

# ---- MongoDB direct access (for seeding) ----
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# --- Catalog ---
def test_catalog_has_six_categories_with_gen_and_stats():
    r = requests.get(f"{API}/catalog", timeout=15)
    assert r.status_code == 200
    data = r.json()
    expected = {"chassis", "mobility", "armor", "weapon", "sensor", "ai_module"}
    assert expected.issubset(set(data.keys()))
    for cat, items in data.items():
        if cat not in expected:
            continue
        assert isinstance(items, list) and len(items) > 0
        for item in items:
            assert "key" in item and "gen" in item and "stats" in item
            assert isinstance(item["gen"], int) and 1 <= item["gen"] <= 5


# --- Player init resources ---
@pytest.fixture(scope="module")
def fresh_player():
    codename = f"TEST_IT2_{uuid.uuid4().hex[:6].upper()}"
    r = requests.post(f"{API}/player/init", json={"codename": codename}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_player_init_starting_resources(fresh_player):
    p = fresh_player
    assert p["generation"] == 1
    assert p["weapon_usage"] == {}
    res = p["resources"]
    assert res["energy"] == 100
    assert res["materials"] == 250
    assert res["compute"] == 30
    assert res["research"] == 0


def test_player_get_applies_regen_and_recomputes_gen(fresh_player):
    # Seed research directly to trigger gen recompute
    pid = fresh_player["id"]
    _run(_db.players.update_one({"id": pid}, {"$set": {"resources.research": 50}}))
    r = requests.get(f"{API}/player/{pid}", timeout=15)
    assert r.status_code == 200
    p = r.json()
    assert p["generation"] == 2
    assert p["resources"]["research"] == 50
    # reset
    _run(_db.players.update_one({"id": pid}, {"$set": {"resources.research": 0, "generation": 1}}))


# --- Robots: gen 1 succeeds & deducts ---
@pytest.fixture(scope="module")
def gen1_robot(fresh_player):
    pid = fresh_player["id"]
    # ensure ample resources & gen1
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.materials": 500, "resources.compute": 60,
        "resources.research": 0, "generation": 1, "weapon_usage": {},
    }}))
    before = requests.get(f"{API}/player/{pid}", timeout=15).json()
    payload = {
        "player_id": pid, "name": "TEST_IT2_G1",
        "chassis": "tank", "mobility": "wheels", "armor": "steel",
        "weapon": "railgun", "sensor": "optical", "ai_module": "hunter",
    }
    r = requests.post(f"{API}/robots", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    robot = r.json()
    assert robot["generation"] == 1
    after = requests.get(f"{API}/player/{pid}", timeout=15).json()
    # cost gen1: mat=45, compute=8
    assert after["resources"]["materials"] == before["resources"]["materials"] - 45
    assert after["resources"]["compute"] == before["resources"]["compute"] - 8
    yield robot
    requests.delete(f"{API}/robots/{robot['id']}", timeout=10)


def test_gen1_robot_created(gen1_robot):
    assert gen1_robot["id"]


# --- Robot gen locked ---
def test_gen2_part_when_gen1_returns_locked(fresh_player):
    pid = fresh_player["id"]
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.research": 0, "generation": 1,
        "resources.materials": 500, "resources.compute": 60,
    }}))
    payload = {
        "player_id": pid, "name": "TEST_LOCKED",
        "chassis": "tank", "mobility": "wheels", "armor": "steel",
        "weapon": "plasma",  # gen 2
        "sensor": "optical", "ai_module": "hunter",
    }
    r = requests.post(f"{API}/robots", json=payload, timeout=15)
    assert r.status_code == 400
    assert "GENERATION 2 LOCKED" in r.json().get("detail", "")


# --- Insufficient materials ---
def test_insufficient_materials(fresh_player):
    pid = fresh_player["id"]
    _run(_db.players.update_one({"id": pid}, {"$set": {"resources.materials": 5, "resources.compute": 60}}))
    payload = {
        "player_id": pid, "name": "TEST_POOR",
        "chassis": "tank", "mobility": "wheels", "armor": "steel",
        "weapon": "railgun", "sensor": "optical", "ai_module": "hunter",
    }
    r = requests.post(f"{API}/robots", json=payload, timeout=15)
    assert r.status_code == 400
    assert "INSUFFICIENT MATERIALS" in r.json().get("detail", "")
    _run(_db.players.update_one({"id": pid}, {"$set": {"resources.materials": 500}}))


# --- Delete refund ---
def test_delete_refunds_half_materials_full_compute(fresh_player):
    pid = fresh_player["id"]
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.materials": 500, "resources.compute": 60, "resources.research": 0, "generation": 1,
    }}))
    payload = {
        "player_id": pid, "name": "TEST_REFUND",
        "chassis": "humanoid", "mobility": "legs", "armor": "titanium",
        "weapon": "laser", "sensor": "infrared", "ai_module": "guardian",
    }
    r = requests.post(f"{API}/robots", json=payload, timeout=15)
    assert r.status_code == 200
    robot_id = r.json()["id"]
    # gen1 cost: mat=45, comp=8; refund mat=22, comp=8
    mid = requests.get(f"{API}/player/{pid}", timeout=15).json()
    del_r = requests.delete(f"{API}/robots/{robot_id}", timeout=15)
    assert del_r.status_code == 200
    after = requests.get(f"{API}/player/{pid}", timeout=15).json()
    assert after["resources"]["materials"] == mid["resources"]["materials"] + 22
    assert after["resources"]["compute"] == mid["resources"]["compute"] + 8


# --- Threats list ---
def test_threats_list_high_level_has_alien_class_and_rewards():
    r = requests.get(f"{API}/threats/list", params={"count": 8, "player_level": 6}, timeout=15)
    assert r.status_code == 200
    threats = r.json()
    assert len(threats) == 8
    allowed = {"locust", "harvester", "sentinel", "archon"}
    for t in threats:
        assert t["alien_class"] in allowed
        assert "reward_materials" in t and "reward_research" in t


# --- Battle consumes energy & increments weapon_usage ---
def test_battle_consumes_energy_and_updates_usage(fresh_player, gen1_robot):
    pid = fresh_player["id"]
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.energy": 100, "resources.materials": 500, "weapon_usage": {},
    }}))
    threat = requests.get(f"{API}/threats/list", params={"count": 1, "player_level": 1}, timeout=15).json()[0]
    r = requests.post(f"{API}/battle", json={
        "player_id": pid, "robot_id": gen1_robot["id"], "threat": threat,
    }, timeout=30)
    assert r.status_code == 200, r.text
    res = r.json()
    after = requests.get(f"{API}/player/{pid}", timeout=15).json()
    assert after["resources"]["energy"] <= 90  # consumed at least 10
    assert after["weapon_usage"].get(gen1_robot["weapon"], 0) >= 1
    if res["victory"]:
        assert res["materials_gained"] > 0
        assert res["research_gained"] >= 0


def test_battle_zero_energy_returns_insufficient(fresh_player, gen1_robot):
    pid = fresh_player["id"]
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.energy": 0,
        "resources_updated_at": "2099-01-01T00:00:00+00:00",  # future so regen adds nothing
    }}))
    threat = requests.get(f"{API}/threats/list", params={"count": 1, "player_level": 1}, timeout=15).json()[0]
    r = requests.post(f"{API}/battle", json={
        "player_id": pid, "robot_id": gen1_robot["id"], "threat": threat,
    }, timeout=15)
    assert r.status_code == 400
    assert "INSUFFICIENT ENERGY" in r.json().get("detail", "")
    # restore
    from datetime import datetime, timezone
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.energy": 100, "resources_updated_at": datetime.now(timezone.utc).isoformat(),
    }}))


# --- Sentinel adaptation ---
def test_sentinel_adaptation_note(fresh_player, gen1_robot):
    pid = fresh_player["id"]
    # gen1_robot uses weapon=railgun
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.energy": 100,
        "weapon_usage": {"railgun": 8},
    }}))
    # force sentinel threat by fabricating locally
    from datetime import datetime, timezone
    threat = {
        "id": str(uuid.uuid4()),
        "name": "Sentinel Alpha",
        "location": "Tokyo",
        "alien_class": "sentinel",
        "threat_level": 3,
        "hp": 80, "attack": 12, "defense": 8, "speed": 6,
        "weakness": "emp",
        "reward_xp": 60, "reward_credits": 100,
        "reward_materials": 40, "reward_research": 15,
        "description": "test",
    }
    r = requests.post(f"{API}/battle", json={
        "player_id": pid, "robot_id": gen1_robot["id"], "threat": threat,
    }, timeout=30)
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["adaptation_note"] is not None
    assert "RAILGUN" in res["adaptation_note"].upper()


# --- Harvester penalty on loss ---
def test_harvester_loss_negative_materials(fresh_player):
    pid = fresh_player["id"]
    # Create a very weak robot to force loss
    _run(_db.players.update_one({"id": pid}, {"$set": {
        "resources.materials": 500, "resources.compute": 60,
        "resources.research": 0, "generation": 1,
        "resources.energy": 100,
    }}))
    weak_payload = {
        "player_id": pid, "name": "TEST_WEAK",
        "chassis": "quadruped", "mobility": "wheels", "armor": "steel",
        "weapon": "laser", "sensor": "optical", "ai_module": "guardian",
    }
    weak = requests.post(f"{API}/robots", json=weak_payload, timeout=15).json()
    # Massive harvester threat
    threat = {
        "id": str(uuid.uuid4()),
        "name": "Harvester Prime",
        "location": "Nairobi",
        "alien_class": "harvester",
        "threat_level": 10,
        "hp": 500, "attack": 30, "defense": 30, "speed": 3,
        "weakness": "emp",
        "reward_xp": 100, "reward_credits": 200,
        "reward_materials": 80, "reward_research": 5,
        "description": "test",
    }
    r = requests.post(f"{API}/battle", json={
        "player_id": pid, "robot_id": weak["id"], "threat": threat,
    }, timeout=30)
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["victory"] is False
    assert res["materials_gained"] < 0, f"expected negative materials, got {res['materials_gained']}"
    requests.delete(f"{API}/robots/{weak['id']}", timeout=10)


# --- Research threshold via battle path ---
def test_research_threshold_makes_gen2(fresh_player):
    pid = fresh_player["id"]
    _run(_db.players.update_one({"id": pid}, {"$set": {"resources.research": 50}}))
    p = requests.get(f"{API}/player/{pid}", timeout=15).json()
    assert p["generation"] == 2
    _run(_db.players.update_one({"id": pid}, {"$set": {"resources.research": 0, "generation": 1}}))


# --- AI brief archon ---
def test_ai_brief_archon_returns_text():
    r = requests.post(f"{API}/ai/brief", json={
        "threat_name": "Archon of Silence",
        "threat_level": 8,
        "location": "Tokyo",
        "alien_class": "archon",
        "context": "Full-loadout deployment",
    }, timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("brief"), str) and len(data["brief"].strip()) > 10
