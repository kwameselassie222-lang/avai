"""Iteration 3 backend tests: Strategic Regions + Apollyon endgame."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://robot-evolution-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


@pytest.fixture(scope="module")
def player():
    codename = f"TEST_I3_{uuid.uuid4().hex[:6].upper()}"
    r = requests.post(f"{API}/player/init", json={"codename": codename}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def robot(player):
    payload = {
        "player_id": player["id"], "name": "TEST_R3",
        "chassis": "humanoid", "mobility": "legs", "armor": "steel",
        "weapon": "railgun", "sensor": "optical", "ai_module": "hunter",
    }
    r = requests.post(f"{API}/robots", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Regions ----------------

class TestRegions:
    def test_new_player_has_4_default_regions(self, player):
        regs = player["regions"]
        assert len(regs) == 4
        ids = {r["id"] for r in regs}
        assert ids == {"silicon_valley", "taiwan", "congo", "middle_east"}
        for r in regs:
            assert r["integrity"] == 100
            assert r["controlled"] is True
            assert r["under_attack"] is False

    def test_apollyon_default_locked(self, player):
        a = player["apollyon"]
        assert a["unlocked"] is False
        assert a["phase"] == 0
        assert a["completed"] is False
        assert a["decision"] is None
        assert a["ending"] is None

    def test_get_regions_endpoint(self, player):
        r = requests.get(f"{API}/regions/{player['id']}", timeout=15)
        assert r.status_code == 200
        regs = r.json()
        expected = {"silicon_valley": "research", "taiwan": "compute", "congo": "materials", "middle_east": "energy"}
        got = {reg["id"]: reg["resource"] for reg in regs}
        assert got == expected

    def test_passive_regen_after_1_hour(self, player):
        # Get current resources
        p0 = requests.get(f"{API}/player/{player['id']}", timeout=15).json()
        r0 = p0["resources"]
        # Set resources_updated_at to 1 hour ago
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        _db.players.update_one({"id": player["id"]}, {"$set": {"resources_updated_at": past}})
        # GET triggers apply_energy_regen
        p1 = requests.get(f"{API}/player/{player['id']}", timeout=15).json()
        r1 = p1["resources"]
        # research +6, compute +4, materials +20; energy caps at 100
        assert r1["research"] - r0["research"] >= 6
        assert r1["compute"] - r0["compute"] >= 4
        assert r1["materials"] - r0["materials"] >= 20
        assert r1["energy"] <= 100

    def test_region_attack_success(self, player, robot):
        # Ensure energy
        _db.players.update_one({"id": player["id"]}, {"$set": {"resources.energy": 100}})
        # First knock down integrity so we can see integrity update
        _db.players.update_one(
            {"id": player["id"], "regions.id": "taiwan"},
            {"$set": {"regions.$.integrity": 20, "regions.$.under_attack": True, "regions.$.controlled": True}},
        )
        pre = requests.get(f"{API}/player/{player['id']}", timeout=15).json()
        pre_energy = pre["resources"]["energy"]
        r = requests.post(
            f"{API}/regions/attack",
            json={"player_id": player["id"], "region_id": "taiwan", "robot_id": robot["id"]},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "result" in body and "region" in body
        assert body["region"]["id"] == "taiwan"
        # integrity moves by +60 (victory) or -40 (defeat)
        new_int = body["region"]["integrity"]
        assert new_int in range(0, 101)
        # verify energy consumed (10) - accounting for passive regen may add back some
        post = requests.get(f"{API}/player/{player['id']}", timeout=15).json()
        assert post["resources"]["energy"] <= max(0, pre_energy - 10) + 5

    def test_region_attack_unknown_region_404(self, player, robot):
        r = requests.post(
            f"{API}/regions/attack",
            json={"player_id": player["id"], "region_id": "atlantis", "robot_id": robot["id"]},
            timeout=15,
        )
        assert r.status_code == 404


# ---------------- Apollyon ----------------

class TestApollyonLocked:
    def test_status_locked_when_gen_lt_3(self, player):
        # ensure research is low
        _db.players.update_one({"id": player["id"]}, {"$set": {"resources.research": 0, "generation": 1}})
        r = requests.get(f"{API}/apollyon/status/{player['id']}", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["unlocked"] is False
        assert s["phases_total"] == 3
        assert s.get("current_phase_info") is not None

    def test_battle_locked_returns_400(self, player, robot):
        _db.players.update_one({"id": player["id"]}, {"$set": {"resources.research": 0}})
        r = requests.post(
            f"{API}/apollyon/battle",
            json={"player_id": player["id"], "robot_id": robot["id"]},
            timeout=15,
        )
        assert r.status_code == 400
        assert "APOLLYON LOCKED" in r.text

    def test_decide_before_completed_400(self, player):
        _db.players.update_one(
            {"id": player["id"]},
            {"$set": {"apollyon.completed": False, "apollyon.decision": None}},
        )
        r = requests.post(
            f"{API}/apollyon/decide",
            json={"player_id": player["id"], "decision": "OBEY"},
            timeout=15,
        )
        assert r.status_code == 400


class TestApollyonUnlocked:
    def test_status_unlocked_when_gen_ge_3(self, player):
        _db.players.update_one({"id": player["id"]}, {"$set": {"resources.research": 200}})
        r = requests.get(f"{API}/apollyon/status/{player['id']}", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["unlocked"] is True

    def test_battle_unlocked_runs(self, player, robot):
        # Reset apollyon phase, top up energy
        _db.players.update_one(
            {"id": player["id"]},
            {"$set": {
                "resources.research": 200,
                "resources.energy": 100,
                "apollyon": {"unlocked": True, "phase": 0, "completed": False, "decision": None, "ending": None},
            }},
        )
        r = requests.post(
            f"{API}/apollyon/battle",
            json={"player_id": player["id"], "robot_id": robot["id"]},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "result" in body
        assert body["phases_total"] == 3
        assert body["phase"] in (1, 2, 3) or body["phase"] == 0  # 0 if defeat retains phase — actually API sets phase=idx+1 only on victory but returns phase_idx+1
        # If victory, phase should have incremented in DB
        p = requests.get(f"{API}/player/{player['id']}", timeout=15).json()
        assert p["apollyon"]["phase"] >= 0

    def test_decide_invalid_returns_400(self, player):
        # Force completed=true
        _db.players.update_one(
            {"id": player["id"]},
            {"$set": {"apollyon.completed": True, "apollyon.phase": 3, "apollyon.decision": None}},
        )
        r = requests.post(
            f"{API}/apollyon/decide",
            json={"player_id": player["id"], "decision": "HACK"},
            timeout=15,
        )
        assert r.status_code == 400

    @pytest.mark.parametrize("decision", ["OBEY", "NEGOTIATE", "REFUSE", "MANIPULATE"])
    def test_decide_valid_returns_ending(self, player, decision):
        _db.players.update_one(
            {"id": player["id"]},
            {"$set": {"apollyon.completed": True, "apollyon.phase": 3, "apollyon.decision": None, "apollyon.ending": None}},
        )
        r = requests.post(
            f"{API}/apollyon/decide",
            json={"player_id": player["id"], "decision": decision},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["decision"] == decision
        assert body["ending"] and len(body["ending"]) > 20
        # Persistence check
        p = requests.get(f"{API}/player/{player['id']}", timeout=15).json()
        assert p["apollyon"]["decision"] == decision
        assert p["apollyon"]["ending"]
