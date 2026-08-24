"""
Iteration 5 backend tests — NEW endpoints only:
  - GET  /api/defense/cascade/{player_id}
  - GET  /api/archons/config
  - GET  /api/archons/status/{player_id}
  - POST /api/archons/battle
  - POST /api/triage/scan/{player_id}
  - POST /api/triage/resolve
  - POST /api/defense/protocols   (extended AND/OR + new condition keys)

We do NOT re-run iteration 4 tests here.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if BASE_URL:
    BASE_URL = BASE_URL.rstrip("/")
else:
    # Fall back to /app/frontend/.env
    from pathlib import Path
    env = (Path(__file__).parent.parent.parent / "frontend" / ".env").read_text()
    for line in env.splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


def _init_player(api, codename=None):
    codename = codename or f"IT5_{uuid.uuid4().hex[:6].upper()}"
    r = api.post(f"{BASE_URL}/api/player/init", json={"codename": codename})
    assert r.status_code == 200, r.text
    return r.json()


def _create_robot(api, player_id, weapon="laser", gen1=True, name=None):
    parts = {
        "player_id": player_id,
        "name": name or f"BOT_{uuid.uuid4().hex[:4]}",
        "chassis": "humanoid",
        "mobility": "wheels",
        "armor": "steel",
        "weapon": weapon,
        "sensor": "optical",
        "ai_module": "hunter",
    }
    r = api.post(f"{BASE_URL}/api/robots", json=parts)
    return r


def _seed_player_full(mongo, player_id, resources=None, wave_count=0, zones_overrides=None,
                     sensor_tier=1, archons_defeated=None):
    """Directly mutate the mongo doc to reach the state we need for tests."""
    doc = mongo.players.find_one({"id": player_id})
    assert doc, f"player {player_id} not found in mongo"
    if resources:
        doc.setdefault("resources", {}).update(resources)
    if "defense" not in doc or not doc["defense"]:
        # trigger endpoint to bootstrap defense
        return None
    doc["defense"]["wave_count"] = wave_count
    doc["defense"]["sensor_tier"] = sensor_tier
    if archons_defeated is not None:
        doc["defense"]["archons_defeated"] = archons_defeated
    if zones_overrides:
        for z in doc["defense"]["zones"]:
            if z["id"] in zones_overrides:
                z["integrity"] = zones_overrides[z["id"]]
    mongo.players.update_one({"id": player_id}, {"$set": {
        "resources": doc["resources"],
        "defense": doc["defense"],
    }})
    return doc


# ========================================================================
# A. CASCADING DAMAGE
# ========================================================================

class TestCascade:
    def test_cascade_fresh_player_no_warnings(self, api):
        p = _init_player(api)
        r = api.get(f"{BASE_URL}/api/defense/cascade/{p['id']}")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["warnings"] == []
        assert j["build_material_mult"] == 1.0
        assert j["build_compute_mult"] == 1.0
        assert j["energy_regen_mult"] == 1.0
        assert j["compute_regen_mult"] == 1.0
        assert j["sensor_penalty"] == 0
        assert j["effective_sensor_tier"] == 1
        assert j["base_sensor_tier"] == 1

    def test_cascade_unknown_player_404(self, api):
        r = api.get(f"{BASE_URL}/api/defense/cascade/does_not_exist_xyz")
        assert r.status_code == 404

    def test_cascade_energy_zone_damaged(self, api, mongo):
        p = _init_player(api)
        _seed_player_full(mongo, p["id"], zones_overrides={"energy": 30})
        r = api.get(f"{BASE_URL}/api/defense/cascade/{p['id']}")
        assert r.status_code == 200
        j = r.json()
        assert any("ENERGY GRID" in w for w in j["warnings"]), j["warnings"]
        assert j["build_material_mult"] == pytest.approx(1.25)
        assert j["energy_regen_mult"] == pytest.approx(0.5)

    def test_cascade_tech_damaged_reduces_sensor(self, api, mongo):
        p = _init_player(api)
        # Bump base sensor tier to 2 so penalty is observable
        _seed_player_full(mongo, p["id"],
                          zones_overrides={"tech": 25}, sensor_tier=2)
        r = api.get(f"{BASE_URL}/api/defense/cascade/{p['id']}")
        assert r.status_code == 200
        j = r.json()
        assert any("TECH INFRA" in w for w in j["warnings"]), j["warnings"]
        assert j["sensor_penalty"] == 1
        assert j["build_compute_mult"] == pytest.approx(1.3)
        assert j["compute_regen_mult"] == pytest.approx(0.5)
        assert j["base_sensor_tier"] == 2
        assert j["effective_sensor_tier"] == 1  # max(1, 2-1)

    def test_cascade_industry_and_rare_damaged(self, api, mongo):
        p = _init_player(api)
        _seed_player_full(mongo, p["id"],
                          zones_overrides={"industry": 30, "rare": 20})
        r = api.get(f"{BASE_URL}/api/defense/cascade/{p['id']}")
        j = r.json()
        assert any("INDUSTRY" in w for w in j["warnings"])
        assert any("RARE MATERIALS" in w for w in j["warnings"])
        # multipliers stack: 1.3 * 1.4 = 1.82
        assert j["build_material_mult"] == pytest.approx(1.3 * 1.4, rel=1e-6)

    def test_cascade_robot_cost_reflects_multipliers(self, api, mongo):
        """Damaged energy zone (30 < 40) → materials cost = 45 * 1.25 = 56 (int truncate)."""
        p = _init_player(api)
        # damage energy → +25% material
        _seed_player_full(mongo, p["id"], zones_overrides={"energy": 30})
        # Gen-1 humanoid+... → base cost {mat: 45, comp: 8}
        # 45 * 1.25 = 56 (int)
        r = _create_robot(api, p["id"], weapon="laser")
        assert r.status_code == 200, r.text
        # Verify player resources deducted the cascaded amount
        pl = api.get(f"{BASE_URL}/api/player/{p['id']}").json()
        # Starting materials = 250, expected new materials = 250 - 56 = 194
        assert pl["resources"]["materials"] == 250 - 56, pl["resources"]

    def test_cascade_insufficient_materials_fires_400(self, api, mongo):
        """Damage multiple zones so cost > available materials."""
        p = _init_player(api)
        # Drain to 40 materials, damage all cost zones
        mongo.players.update_one(
            {"id": p["id"]},
            {"$set": {"resources.materials": 40}},
        )
        _seed_player_full(mongo, p["id"], resources={"materials": 40},
                          zones_overrides={"energy": 30, "industry": 30, "rare": 20})
        r = _create_robot(api, p["id"], weapon="laser")
        assert r.status_code == 400, r.text
        assert "INSUFFICIENT MATERIALS" in r.json().get("detail", "")


# ========================================================================
# B. ARCHONS
# ========================================================================

class TestArchons:
    def test_config_returns_four_archons(self, api):
        r = api.get(f"{BASE_URL}/api/archons/config")
        assert r.status_code == 200
        j = r.json()
        ids = [a["id"] for a in j["archons"]]
        assert set(ids) == {"swarm_lord", "silence", "devourer", "mirror"}
        for a in j["archons"]:
            assert a["mechanic"] in {"summon", "jam", "drain", "reflect"}
            assert "hp" in a and "attack" in a and "defense" in a
            assert "min_wave" in a and "min_gen" in a
            assert "rewards" in a
            assert "part_unlock" in a["rewards"]

    def test_status_fresh_player_all_locked(self, api):
        p = _init_player(api)
        r = api.get(f"{BASE_URL}/api/archons/status/{p['id']}")
        assert r.status_code == 200
        j = r.json()
        assert j["wave_count"] == 0
        assert j["generation"] == 1
        for a in j["archons"]:
            assert a["unlocked"] is False
            assert a["defeated"] is False

    def test_status_unknown_player_404(self, api):
        r = api.get(f"{BASE_URL}/api/archons/status/nope_missing_xyz")
        assert r.status_code == 404

    def test_battle_locked_returns_400(self, api):
        p = _init_player(api)
        rb = _create_robot(api, p["id"], weapon="laser").json()
        r = api.post(f"{BASE_URL}/api/archons/battle",
                     json={"player_id": p["id"], "robot_id": rb["id"],
                           "archon_id": "swarm_lord"})
        assert r.status_code == 400
        assert "WAVE" in r.json()["detail"] and "GEN" in r.json()["detail"]

    def test_battle_unknown_archon_404(self, api, mongo):
        p = _init_player(api)
        rb = _create_robot(api, p["id"]).json()
        r = api.post(f"{BASE_URL}/api/archons/battle",
                     json={"player_id": p["id"], "robot_id": rb["id"],
                           "archon_id": "not_a_real_archon"})
        assert r.status_code == 404

    def test_battle_swarm_lord_unlocked_and_records_note(self, api, mongo):
        p = _init_player(api)
        rb = _create_robot(api, p["id"], weapon="laser").json()  # gen1
        # Seed: wave >= 2, research >= 50 (gen 2), plenty of energy
        mongo.players.update_one({"id": p["id"]},
                                  {"$set": {"resources.research": 60,
                                            "resources.energy": 100,
                                            "resources.materials": 500}})
        _seed_player_full(mongo, p["id"], wave_count=3)
        # Sanity: status now shows swarm_lord unlocked
        st = api.get(f"{BASE_URL}/api/archons/status/{p['id']}").json()
        sl = next(a for a in st["archons"] if a["id"] == "swarm_lord")
        assert sl["unlocked"] is True

        r = api.post(f"{BASE_URL}/api/archons/battle",
                     json={"player_id": p["id"], "robot_id": rb["id"],
                           "archon_id": "swarm_lord"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["archon"]["id"] == "swarm_lord"
        assert isinstance(j["sim"]["rounds"], list) and len(j["sim"]["rounds"]) >= 1
        # summon mechanic notes exist (may be 0 if won in 1 round; assert summons field present)
        assert "summons" in j["sim"]
        # Energy deducted (20)
        assert j["resources"]["energy"] <= 80

    def test_battle_devourer_drains_materials(self, api, mongo):
        p = _init_player(api)
        rb = _create_robot(api, p["id"], weapon="laser").json()
        mongo.players.update_one({"id": p["id"]},
                                  {"$set": {"resources.research": 400,  # gen 4
                                            "resources.energy": 100,
                                            "resources.materials": 5000}})
        _seed_player_full(mongo, p["id"], wave_count=7)
        pre = api.get(f"{BASE_URL}/api/player/{p['id']}").json()
        pre_mat = pre["resources"]["materials"]
        r = api.post(f"{BASE_URL}/api/archons/battle",
                     json={"player_id": p["id"], "robot_id": rb["id"],
                           "archon_id": "devourer"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["sim"]["material_drain"] > 0, j["sim"]
        # Materials must have dropped by at least the drain (rewards may add back if victory)
        post_mat = j["resources"]["materials"]
        # If victory, materials = pre - drain + 400. Otherwise = pre - drain.
        if j["sim"]["victory"]:
            expected_min = pre_mat - j["sim"]["material_drain"] + 400
            assert post_mat >= expected_min - 5  # small tolerance
        else:
            assert post_mat <= pre_mat - j["sim"]["material_drain"] + 5

    def test_battle_mirror_reflect_note(self, api, mongo):
        p = _init_player(api)
        rb = _create_robot(api, p["id"], weapon="laser").json()
        mongo.players.update_one({"id": p["id"]},
                                  {"$set": {"resources.research": 400,
                                            "resources.energy": 100,
                                            "resources.materials": 500}})
        _seed_player_full(mongo, p["id"], wave_count=9)
        r = api.post(f"{BASE_URL}/api/archons/battle",
                     json={"player_id": p["id"], "robot_id": rb["id"],
                           "archon_id": "mirror"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert any("MIRROR" in n or "reflect" in n.lower() for n in j["sim"]["notes"]), j["sim"]["notes"]
        # First round should have non-zero reflect field
        assert j["sim"]["rounds"][0]["reflect"] > 0

    def test_battle_already_defeated_returns_400(self, api, mongo):
        p = _init_player(api)
        rb = _create_robot(api, p["id"], weapon="laser").json()  # gen1
        mongo.players.update_one({"id": p["id"]},
                                  {"$set": {"resources.research": 60,
                                            "resources.energy": 100}})
        _seed_player_full(mongo, p["id"], wave_count=3,
                          archons_defeated=["swarm_lord"])
        r = api.post(f"{BASE_URL}/api/archons/battle",
                     json={"player_id": p["id"], "robot_id": rb["id"],
                           "archon_id": "swarm_lord"})
        assert r.status_code == 400
        assert "already defeated" in r.json()["detail"].lower()

    def test_battle_insufficient_energy_400(self, api, mongo):
        p = _init_player(api)
        rb = _create_robot(api, p["id"]).json()
        mongo.players.update_one({"id": p["id"]},
                                  {"$set": {"resources.research": 60,
                                            "resources.energy": 5}})
        _seed_player_full(mongo, p["id"], wave_count=3)
        r = api.post(f"{BASE_URL}/api/archons/battle",
                     json={"player_id": p["id"], "robot_id": rb["id"],
                           "archon_id": "swarm_lord"})
        assert r.status_code == 400
        assert "ENERGY" in r.json()["detail"].upper()


# ========================================================================
# C. TRIAGE
# ========================================================================

class TestTriage:
    def test_scan_locked_before_wave_3(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/triage/scan/{p['id']}")
        assert r.status_code == 400
        assert "wave 3" in r.json()["detail"].lower()

    def test_scan_unlocked_returns_3_zones(self, api, mongo):
        p = _init_player(api)
        _seed_player_full(mongo, p["id"], wave_count=4)
        r = api.post(f"{BASE_URL}/api/triage/scan/{p['id']}")
        assert r.status_code == 200, r.text
        j = r.json()
        assert len(j["zones"]) == 3
        for z in j["zones"]:
            assert "incoming_damage" in z and z["incoming_damage"] > 0
            assert "id" in z and "name" in z
        # Highest weight zones (water=18, energy=16, biomass=14 or industry=14) expected
        weights = sorted([z["weight"] for z in j["zones"]], reverse=True)
        assert weights[0] == 18  # water

    def test_resolve_requires_active_triage(self, api, mongo):
        p = _init_player(api)
        _seed_player_full(mongo, p["id"], wave_count=4)
        r = api.post(f"{BASE_URL}/api/triage/resolve",
                     json={"player_id": p["id"], "defend_zone_ids": ["water", "energy"]})
        assert r.status_code == 400
        assert "no active triage" in r.json()["detail"].lower()

    def test_resolve_requires_exactly_two(self, api, mongo):
        p = _init_player(api)
        _seed_player_full(mongo, p["id"], wave_count=4)
        triage = api.post(f"{BASE_URL}/api/triage/scan/{p['id']}").json()
        zids = [z["id"] for z in triage["zones"]]

        r1 = api.post(f"{BASE_URL}/api/triage/resolve",
                      json={"player_id": p["id"], "defend_zone_ids": [zids[0]]})
        assert r1.status_code == 400 and "exactly 2" in r1.json()["detail"]

        r3 = api.post(f"{BASE_URL}/api/triage/resolve",
                      json={"player_id": p["id"], "defend_zone_ids": zids})
        assert r3.status_code == 400 and "exactly 2" in r3.json()["detail"]

    def test_resolve_zone_not_in_triage_400(self, api, mongo):
        p = _init_player(api)
        _seed_player_full(mongo, p["id"], wave_count=4)
        triage = api.post(f"{BASE_URL}/api/triage/scan/{p['id']}").json()
        zids = [z["id"] for z in triage["zones"]]
        # Pick 1 from triage + 1 that isn't
        all_zone_ids = {"water", "energy", "biomass", "minerals", "industry", "rare", "tech"}
        outsider = next(iter(all_zone_ids - set(zids)))
        r = api.post(f"{BASE_URL}/api/triage/resolve",
                     json={"player_id": p["id"], "defend_zone_ids": [zids[0], outsider]})
        assert r.status_code == 400
        assert "not part of triage" in r.json()["detail"]

    def test_resolve_defended_gets_35pct_damage(self, api, mongo):
        p = _init_player(api)
        _seed_player_full(mongo, p["id"], wave_count=4)
        triage = api.post(f"{BASE_URL}/api/triage/scan/{p['id']}").json()
        zones = triage["zones"]
        defend_ids = [zones[0]["id"], zones[1]["id"]]
        sacrifice_id = zones[2]["id"]

        pre_state = api.get(f"{BASE_URL}/api/defense/state/{p['id']}").json()
        pre_research = api.get(f"{BASE_URL}/api/player/{p['id']}").json()["resources"]["research"]

        r = api.post(f"{BASE_URL}/api/triage/resolve",
                     json={"player_id": p["id"], "defend_zone_ids": defend_ids})
        assert r.status_code == 200, r.text
        j = r.json()
        assert len(j["resolved"]) == 3

        by_id = {z["id"]: z for z in j["resolved"]}
        by_incoming = {z["id"]: z["incoming_damage"] for z in zones}
        # Defended zones took int(incoming * 0.35)
        for did in defend_ids:
            assert by_id[did]["action"] == "defended"
            expected = int(by_incoming[did] * 0.35)
            assert by_id[did]["damage"] == expected, by_id[did]
        # Sacrificed took full
        assert by_id[sacrifice_id]["action"] == "sacrificed"
        assert by_id[sacrifice_id]["damage"] == by_incoming[sacrifice_id]

        # Research rewarded +12
        assert j["resources"]["research"] == pre_research + 12
        # Active triage cleared
        st = api.get(f"{BASE_URL}/api/defense/state/{p['id']}").json()
        assert st.get("active_triage") in (None, {}, [])


# ========================================================================
# D. DEEPER PROTOCOL EVALUATOR
# ========================================================================

class TestProtocolsDeep:
    def test_protocol_save_and_or_combine(self, api):
        p = _init_player(api)
        payload = {
            "player_id": p["id"],
            "protocols": [{
                "name": "Rule OR combine",
                "priority": 1,
                "enabled": True,
                "conditions": [
                    {"key": "ship_type", "value": "harvester", "op": "eq"},
                    {"key": "ship_type", "value": "stealth", "op": "eq", "combine": "or"},
                ],
                "actions": [{"key": "priority", "value": "max"}],
            }],
        }
        r = api.post(f"{BASE_URL}/api/defense/protocols", json=payload)
        assert r.status_code == 200, r.text
        saved = r.json()["protocols"]
        assert len(saved) == 1
        assert saved[0]["id"]
        # Persisted
        st = api.get(f"{BASE_URL}/api/defense/state/{p['id']}").json()
        assert len(st["protocols"]) == 1
        assert st["protocols"][0]["conditions"][1].get("combine") == "or"

    def test_protocol_viability_below_key(self, api):
        p = _init_player(api)
        payload = {
            "player_id": p["id"],
            "protocols": [{
                "name": "Panic buff",
                "priority": 5,
                "enabled": True,
                "conditions": [{"key": "viability_below", "value": "50", "op": "eq"}],
                "actions": [{"key": "priority", "value": "max"}],
            }],
        }
        r = api.post(f"{BASE_URL}/api/defense/protocols", json=payload)
        assert r.status_code == 200
        st = api.get(f"{BASE_URL}/api/defense/state/{p['id']}").json()
        assert st["protocols"][0]["conditions"][0]["key"] == "viability_below"
        assert st["protocols"][0]["conditions"][0]["value"] == "50"

    def test_protocol_adaptation_active_key(self, api):
        p = _init_player(api)
        payload = {
            "player_id": p["id"],
            "protocols": [{
                "name": "Counter ECM",
                "priority": 2,
                "enabled": True,
                "conditions": [{"key": "adaptation_active", "value": "ECM JAMMING", "op": "eq"}],
                "actions": [{"key": "mode", "value": "attack"}],
            }],
        }
        r = api.post(f"{BASE_URL}/api/defense/protocols", json=payload)
        assert r.status_code == 200
        st = api.get(f"{BASE_URL}/api/defense/state/{p['id']}").json()
        assert st["protocols"][0]["conditions"][0]["key"] == "adaptation_active"
        assert st["protocols"][0]["conditions"][0]["value"] == "ECM JAMMING"

    def test_protocol_alien_class_key(self, api):
        p = _init_player(api)
        payload = {
            "player_id": p["id"],
            "protocols": [{
                "name": "Archon focus",
                "priority": 3,
                "enabled": True,
                "conditions": [{"key": "alien_class", "value": "archon", "op": "eq"}],
                "actions": [{"key": "priority", "value": "high"}],
            }],
        }
        r = api.post(f"{BASE_URL}/api/defense/protocols", json=payload)
        assert r.status_code == 200
        st = api.get(f"{BASE_URL}/api/defense/state/{p['id']}").json()
        assert st["protocols"][0]["conditions"][0]["key"] == "alien_class"
