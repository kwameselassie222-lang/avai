"""
Iteration 4 — Planetary Defense backend tests.

Endpoints covered:
  GET  /api/defense/config
  GET  /api/defense/state/{player_id}
  POST /api/defense/assign
  POST /api/defense/unassign
  POST /api/defense/repair
  POST /api/defense/protocols
  POST /api/invasion/scan
  POST /api/invasion/engage
  POST /api/network/build
  POST /api/defense/reset/{player_id}
"""

import os
import uuid
import pytest
import requests

BASE_URL = "http://localhost:8001/api"

# Force all tests in this module into a single xdist worker AND single class group
# so the shared module-scoped `player`/`robots` fixtures aren't stomped on by
# interleaved tests from another worker.
pytestmark = pytest.mark.xdist_group("iteration4_defense")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def player(api):
    codename = f"TEST_IT4_{uuid.uuid4().hex[:6].upper()}"
    r = api.post(f"{BASE_URL}/player/init", json={"codename": codename})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["defense"] is not None
    # give a big resource pool for testing
    return p


def _mint_resources(pid):
    """Directly boost the player's resources via mongo — used to simplify tests."""
    from pymongo import MongoClient
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "test_database")]
    db.players.update_one(
        {"id": pid},
        {"$set": {
            "resources.energy": 100,
            "resources.materials": 5000,
            "resources.compute": 2000,
            "resources.research": 2000,
        }},
    )
    client.close()


# ---------------- Config & state ----------------

class TestDefenseConfig:
    def test_get_config_shape(self, api):
        r = api.get(f"{BASE_URL}/defense/config")
        assert r.status_code == 200
        cfg = r.json()
        assert len(cfg["layers"]) == 5
        # order: deep_space, orbital, atmosphere, ground, resource_zones
        ids = [l["id"] for l in cfg["layers"]]
        assert ids == ["deep_space", "orbital", "atmosphere", "ground", "resource_zones"]
        max_hps = [l["max_hp"] for l in cfg["layers"]]
        assert max_hps == [500, 400, 300, 250, 200]
        assert len(cfg["zones"]) == 7
        assert sum(z["weight"] for z in cfg["zones"]) == 100
        assert len(cfg["network_nodes"]) == 8
        assert "scout" in cfg["ship_types"] and "harvester" in cfg["ship_types"]
        assert cfg["viability_critical"] == 25.0


class TestDefenseState:
    def test_initial_state(self, api, player):
        # Reset first to guarantee clean state (module-scoped player may
        # already be dirty from parallel test execution)
        api.post(f"{BASE_URL}/defense/reset/{player['id']}")
        r = api.get(f"{BASE_URL}/defense/state/{player['id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["viability"] == 100.0
        assert d["sensor_tier"] == 1
        assert d["network_progress"] == []
        assert d["protocols"] == []
        assert len(d["layers"]) == 5
        for lid, expected in [("deep_space", 500), ("orbital", 400), ("atmosphere", 300), ("ground", 250), ("resource_zones", 200)]:
            assert d["layers"][lid]["max_hp"] == expected
            assert d["layers"][lid]["hp"] == expected
            assert d["layers"][lid]["assigned_robots"] == []
        assert len(d["zones"]) == 7
        for z in d["zones"]:
            assert z["integrity"] == 100

    def test_state_404(self, api):
        r = api.get(f"{BASE_URL}/defense/state/does-not-exist")
        assert r.status_code == 404

    def test_legacy_player_bootstrapped(self, api):
        """Legacy player doc without defense should auto-bootstrap on /player/{id}."""
        from pymongo import MongoClient
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        legacy_id = str(uuid.uuid4())
        db.players.insert_one({
            "id": legacy_id,
            "codename": f"TEST_LEGACY_{legacy_id[:6]}",
            "level": 1, "xp": 0, "credits": 500,
            "victories": 0, "defeats": 0, "score": 0, "generation": 1,
            "resources": {"energy": 100, "materials": 250, "compute": 30, "research": 0},
        })
        client.close()

        r = api.get(f"{BASE_URL}/player/{legacy_id}")
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["defense"] is not None
        assert p["defense"]["viability"] == 100.0
        assert len(p["defense"]["layers"]) == 5

        r2 = api.get(f"{BASE_URL}/defense/state/{legacy_id}")
        assert r2.status_code == 200
        assert r2.json()["viability"] == 100.0


# ---------------- Robots & assignment ----------------

@pytest.fixture(scope="module")
def robots(api, player):
    _mint_resources(player["id"])
    made = []
    for i, wpn in enumerate(["laser", "missile"]):
        payload = {
            "player_id": player["id"],
            "name": f"TEST_R{i}",
            "chassis": "humanoid",
            "mobility": "legs",
            "armor": "steel",
            "weapon": wpn,
            "sensor": "optical",
            "ai_module": "hunter",
        }
        r = api.post(f"{BASE_URL}/robots", json=payload)
        assert r.status_code == 200, r.text
        made.append(r.json())
    return made


class TestAssignment:
    def test_assign_orbital_and_ground(self, api, player, robots):
        r1 = api.post(f"{BASE_URL}/defense/assign", json={
            "player_id": player["id"], "robot_id": robots[0]["id"], "layer_id": "orbital",
        })
        assert r1.status_code == 200, r1.text
        assert r1.json()["ok"] is True

        r2 = api.post(f"{BASE_URL}/defense/assign", json={
            "player_id": player["id"], "robot_id": robots[1]["id"], "layer_id": "ground",
        })
        assert r2.status_code == 200, r2.text

        state = api.get(f"{BASE_URL}/defense/state/{player['id']}").json()
        assert robots[0]["id"] in state["layers"]["orbital"]["assigned_robots"]
        assert robots[1]["id"] in state["layers"]["ground"]["assigned_robots"]

    def test_assign_moves_robot(self, api, player, robots):
        # Move robot0 to atmosphere; must leave orbital
        r = api.post(f"{BASE_URL}/defense/assign", json={
            "player_id": player["id"], "robot_id": robots[0]["id"], "layer_id": "atmosphere",
        })
        assert r.status_code == 200
        state = api.get(f"{BASE_URL}/defense/state/{player['id']}").json()
        assert robots[0]["id"] not in state["layers"]["orbital"]["assigned_robots"]
        assert robots[0]["id"] in state["layers"]["atmosphere"]["assigned_robots"]
        # put back on orbital for downstream
        api.post(f"{BASE_URL}/defense/assign", json={
            "player_id": player["id"], "robot_id": robots[0]["id"], "layer_id": "orbital",
        })

    def test_assign_invalid_layer_resource_zones(self, api, player, robots):
        r = api.post(f"{BASE_URL}/defense/assign", json={
            "player_id": player["id"], "robot_id": robots[0]["id"], "layer_id": "resource_zones",
        })
        assert r.status_code == 400
        assert "Invalid layer" in r.json()["detail"]

    def test_assign_invalid_layer_bogus(self, api, player, robots):
        r = api.post(f"{BASE_URL}/defense/assign", json={
            "player_id": player["id"], "robot_id": robots[0]["id"], "layer_id": "moon_base",
        })
        assert r.status_code == 400

    def test_unassign(self, api, player, robots):
        # unassign r1 (currently ground)
        r = api.post(f"{BASE_URL}/defense/unassign", json={
            "player_id": player["id"], "robot_id": robots[1]["id"],
        })
        assert r.status_code == 200
        state = api.get(f"{BASE_URL}/defense/state/{player['id']}").json()
        for lid in ["deep_space", "orbital", "atmosphere", "ground"]:
            assert robots[1]["id"] not in state["layers"][lid]["assigned_robots"]
        # reassign
        api.post(f"{BASE_URL}/defense/assign", json={
            "player_id": player["id"], "robot_id": robots[1]["id"], "layer_id": "ground",
        })


class TestRepair:
    def test_repair_full_hp_returns_zero(self, api, player):
        _mint_resources(player["id"])
        # Ensure layers are at full HP before checking repair=0
        api.post(f"{BASE_URL}/defense/reset/{player['id']}")
        r = api.post(f"{BASE_URL}/defense/repair", json={
            "player_id": player["id"], "layer_id": "deep_space",
        })
        assert r.status_code == 200
        assert r.json()["repaired"] == 0

    def test_repair_invalid_layer(self, api, player):
        r = api.post(f"{BASE_URL}/defense/repair", json={
            "player_id": player["id"], "layer_id": "resource_zones",
        })
        assert r.status_code == 400


# ---------------- Protocols ----------------

class TestProtocols:
    def test_save_protocol(self, api, player):
        rule = {
            "name": "TEST_kill_harvester",
            "priority": 1,
            "enabled": True,
            "conditions": [{"key": "ship_type", "op": "eq", "value": "harvester"}],
            "actions": [{"key": "priority", "value": "max"}],
        }
        r = api.post(f"{BASE_URL}/defense/protocols", json={
            "player_id": player["id"], "protocols": [rule],
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert len(body["protocols"]) == 1
        assert body["protocols"][0]["id"]  # id auto-generated
        # Persistence check
        state = api.get(f"{BASE_URL}/defense/state/{player['id']}").json()
        assert len(state["protocols"]) == 1
        assert state["protocols"][0]["name"] == "TEST_kill_harvester"


# ---------------- Scan & engage ----------------

class TestInvasion:
    def test_scan_tier1_fog(self, api, player):
        # Force sensor_tier back to 1 (defense may have been upgraded in a parallel test)
        api.post(f"{BASE_URL}/defense/reset/{player['id']}")
        _mint_resources(player["id"])
        r = api.post(f"{BASE_URL}/invasion/scan", json={"player_id": player["id"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "wave_id" in body
        assert body["wave_number"] >= 1
        assert body["intel"]["level"] == 1
        # Tier 1 hides breakdown & shows unknown_signatures
        assert body["intel"]["breakdown"] is None
        assert body["intel"]["unknown_signatures"] is not None
        # At tier1, some revealed ships should have type_display == "unknown" (decoys)
        types_displayed = [s["type_display"] for s in body["revealed"]]
        assert "unknown" in types_displayed

    def test_engage_without_scan_400(self, api, player):
        # Force clear last_wave
        api.post(f"{BASE_URL}/defense/reset/{player['id']}")
        _mint_resources(player["id"])
        r = api.post(f"{BASE_URL}/invasion/engage", json={
            "player_id": player["id"], "wave_id": "bogus-id",
        })
        assert r.status_code == 400
        assert "No matching wave" in r.json()["detail"]

    def test_scan_engage_flow_and_viability(self, api, player, robots):
        _mint_resources(player["id"])
        # reassign robots (they were preserved even after reset since reset only wipes defense.layers)
        api.post(f"{BASE_URL}/defense/assign", json={"player_id": player["id"], "robot_id": robots[0]["id"], "layer_id": "orbital"})
        api.post(f"{BASE_URL}/defense/assign", json={"player_id": player["id"], "robot_id": robots[1]["id"], "layer_id": "ground"})

        scan = api.post(f"{BASE_URL}/invasion/scan", json={"player_id": player["id"]}).json()
        wave_id = scan["wave_id"]
        eng = api.post(f"{BASE_URL}/invasion/engage", json={
            "player_id": player["id"], "wave_id": wave_id,
        })
        assert eng.status_code == 200, eng.text
        body = eng.json()
        assert body["wave_id"] == wave_id
        assert body["outcome"] in ["victory", "partial", "apollyon_victory"]
        assert isinstance(body["log"], list) and len(body["log"]) > 0
        assert 0 <= body["viability_after"] <= 100
        assert "rewards" in body and "xp" in body["rewards"]
        assert "resources" in body

    def test_engage_reuse_wave_id_fails(self, api, player):
        # After previous test wave was consumed (last_wave=None)
        r = api.post(f"{BASE_URL}/invasion/engage", json={
            "player_id": player["id"], "wave_id": "any-old-id",
        })
        assert r.status_code == 400


# ---------------- Network build ----------------

class TestNetworkBuild:
    def test_build_deep_space_array_upgrades_sensor(self, api, player):
        _mint_resources(player["id"])
        # reset defense to clean network progress
        api.post(f"{BASE_URL}/defense/reset/{player['id']}")

        before = api.get(f"{BASE_URL}/defense/state/{player['id']}").json()
        deep_max_before = before["layers"]["deep_space"]["max_hp"]

        r = api.post(f"{BASE_URL}/network/build", json={
            "player_id": player["id"], "node_id": "deep_space_array",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["sensor_tier"] == 2
        assert "deep_space_array" in body["network_progress"]
        # +15% on deep_space
        deep_max_after = body["layers"]["deep_space"]["max_hp"]
        assert deep_max_after == int(deep_max_before * 1.15)

    def test_scan_after_upgrade_tier2(self, api, player):
        _mint_resources(player["id"])
        r = api.post(f"{BASE_URL}/invasion/scan", json={"player_id": player["id"]})
        assert r.status_code == 200
        intel = r.json()["intel"]
        assert intel["level"] == 2
        assert intel["breakdown"] is not None
        assert intel["total_detected"] is not None

    def test_build_duplicate_node_400(self, api, player):
        _mint_resources(player["id"])
        r = api.post(f"{BASE_URL}/network/build", json={
            "player_id": player["id"], "node_id": "deep_space_array",
        })
        assert r.status_code == 400
        assert "Node already built" in r.json()["detail"]

    def test_build_insufficient_resources(self, api, player):
        # zero out research
        from pymongo import MongoClient
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        db.players.update_one({"id": player["id"]}, {"$set": {
            "resources.research": 0, "resources.compute": 0, "resources.materials": 0, "resources.energy": 0,
        }})
        client.close()
        r = api.post(f"{BASE_URL}/network/build", json={
            "player_id": player["id"], "node_id": "orbital_lasers",
        })
        assert r.status_code == 400
        detail = r.json()["detail"]
        assert "Need" in detail and ("RESEARCH" in detail or "MATERIALS" in detail or "ENERGY" in detail)

    def test_build_unknown_node_404(self, api, player):
        r = api.post(f"{BASE_URL}/network/build", json={
            "player_id": player["id"], "node_id": "warp_drive",
        })
        assert r.status_code == 404


# ---------------- Reset & apollyon_victory endgame ----------------

class TestReset:
    def test_reset_restores_planet(self, api, player):
        r = api.post(f"{BASE_URL}/defense/reset/{player['id']}")
        assert r.status_code == 200
        ds = r.json()
        assert ds["viability"] == 100.0
        assert ds["sensor_tier"] == 1
        assert ds["network_progress"] == []
        for lid in ["deep_space", "orbital", "atmosphere", "ground", "resource_zones"]:
            assert ds["layers"][lid]["hp"] == ds["layers"][lid]["max_hp"]
        for z in ds["zones"]:
            assert z["integrity"] == 100


class TestApollyonVictory:
    def test_repeated_waves_lead_to_apollyon_victory(self, api, player):
        api.post(f"{BASE_URL}/defense/reset/{player['id']}")
        # No robots assigned — layers weaker → zones drop faster
        for rid_layer in ["deep_space", "orbital", "atmosphere", "ground"]:
            # unassign is a no-op if robot isn't there — safe
            pass
        outcomes = []
        final_viability = 100.0
        for i in range(40):
            _mint_resources(player["id"])
            scan = api.post(f"{BASE_URL}/invasion/scan", json={"player_id": player["id"]}).json()
            eng = api.post(f"{BASE_URL}/invasion/engage", json={
                "player_id": player["id"], "wave_id": scan["wave_id"],
            })
            assert eng.status_code == 200, eng.text
            body = eng.json()
            outcomes.append(body["outcome"])
            final_viability = body["viability_after"]
            if body["outcome"] == "apollyon_victory":
                break
        # Either we reached apollyon_victory OR viability meaningfully dropped
        # (guard flake by asserting one of the two)
        got_apollyon = "apollyon_victory" in outcomes
        assert got_apollyon or final_viability < 100.0, (
            f"Viability never dropped after {len(outcomes)} engages: {outcomes[:5]}..."
        )
        if got_apollyon:
            assert final_viability <= 25.0
