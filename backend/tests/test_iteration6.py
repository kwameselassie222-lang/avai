"""
Iteration 6 backend tests — NEW endpoints only:
  - GET  /api/doctrines/{player_id}
  - POST /api/doctrines/save
  - POST /api/doctrines/delete
  - POST /api/doctrines/deploy
  - POST /api/defense/zone_repair

We do NOT re-run iteration 4/5 tests here, and we do NOT hit the Apollyon LLM
endpoint.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from pathlib import Path


# ---------- URL resolution ----------
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    env = (Path(__file__).parent.parent.parent / "frontend" / ".env").read_text()
    for line in env.splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = (BASE_URL or "http://localhost:8001").rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- Fixtures ----------
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
    codename = codename or f"IT6_{uuid.uuid4().hex[:6].upper()}"
    r = api.post(f"{BASE_URL}/api/player/init", json={"codename": codename})
    assert r.status_code == 200, r.text
    return r.json()


def _mongo_set_resources(mongo, player_id, **kwargs):
    """Directly set player resources (materials, energy, etc.)."""
    mongo.players.update_one({"id": player_id}, {"$set": {f"resources.{k}": v for k, v in kwargs.items()}})


def _create_robot(api, player_id, name=None):
    parts = {
        "player_id": player_id,
        "name": name or f"BOT_{uuid.uuid4().hex[:4]}",
        "chassis": "humanoid",
        "mobility": "wheels",
        "armor": "steel",
        "weapon": "laser",
        "sensor": "optical",
        "ai_module": "hunter",
    }
    r = api.post(f"{BASE_URL}/api/robots", json=parts)
    assert r.status_code == 200, f"robot create failed: {r.status_code} {r.text}"
    return r.json()


# ==================================================================
# DOCTRINES
# ==================================================================
class TestDoctrines:
    # ---------- listing / create / update ----------
    def test_empty_list_for_new_player(self, api):
        p = _init_player(api)
        r = api.get(f"{BASE_URL}/api/doctrines/{p['id']}")
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_list_unknown_player_404(self, api):
        r = api.get(f"{BASE_URL}/api/doctrines/does-not-exist")
        assert r.status_code == 404

    def test_save_no_id_generates_hex_id(self, api, mongo):
        p = _init_player(api)
        # give the player enough resources to build 2 robots
        _mongo_set_resources(mongo, p["id"], materials=2000, compute=2000, energy=500)
        r1 = _create_robot(api, p["id"], name="Alpha")
        r2 = _create_robot(api, p["id"], name="Bravo")

        payload = {
            "player_id": p["id"],
            "doctrine": {
                "name": "Front Line",
                "robot_ids": [r1["id"], r2["id"]],
                "target_layer": "orbital",
            },
        }
        r = api.post(f"{BASE_URL}/api/doctrines/save", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        d = body["doctrine"]
        assert "id" in d and d["id"], "expected auto-generated id"
        # matches uuid4().hex[:8] shape
        assert len(d["id"]) == 8 and all(c in "0123456789abcdef" for c in d["id"])
        assert d["name"] == "Front Line"
        assert d["target_layer"] == "orbital"
        assert d["robot_ids"] == [r1["id"], r2["id"]]
        assert len(body["doctrines"]) == 1

        # GET reflects it
        r = api.get(f"{BASE_URL}/api/doctrines/{p['id']}")
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["id"] == d["id"]

    def test_save_with_id_updates_in_place(self, api, mongo):
        p = _init_player(api)
        _mongo_set_resources(mongo, p["id"], materials=2000, compute=2000, energy=500)
        r1 = _create_robot(api, p["id"])

        # first save (create)
        r = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"name": "V1", "robot_ids": [r1["id"]], "target_layer": "ground"},
        })
        assert r.status_code == 200, r.text
        d_id = r.json()["doctrine"]["id"]

        # save again with same id, new name
        r = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"id": d_id, "name": "V2", "robot_ids": [r1["id"]], "target_layer": "ground"},
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["doctrine"]["id"] == d_id
        assert body["doctrine"]["name"] == "V2"
        assert len(body["doctrines"]) == 1

        # confirmed by GET
        r = api.get(f"{BASE_URL}/api/doctrines/{p['id']}")
        assert len(r.json()) == 1
        assert r.json()[0]["name"] == "V2"

    def test_save_bogus_robot_id_400(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"name": "bad", "robot_ids": ["ghost-robot"], "target_layer": "orbital"},
        })
        assert r.status_code == 400, r.text
        assert "ghost-robot" in r.text or "not found" in r.text.lower()

    def test_save_bogus_target_layer_resource_zones_400(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"name": "bad", "robot_ids": [], "target_layer": "resource_zones"},
        })
        assert r.status_code == 400, r.text
        assert "target_layer" in r.text.lower() or "invalid" in r.text.lower()

    def test_save_bogus_target_layer_nope_400(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"name": "bad", "robot_ids": [], "target_layer": "nope"},
        })
        assert r.status_code == 400, r.text

    # ---------- deploy ----------
    def test_deploy_assigns_robots_to_target_layer(self, api, mongo):
        p = _init_player(api)
        _mongo_set_resources(mongo, p["id"], materials=2000, compute=2000, energy=500)
        r1 = _create_robot(api, p["id"])
        r2 = _create_robot(api, p["id"])

        s = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"name": "Orbit", "robot_ids": [r1["id"], r2["id"]], "target_layer": "orbital"},
        })
        d_id = s.json()["doctrine"]["id"]

        r = api.post(f"{BASE_URL}/api/doctrines/deploy", json={
            "player_id": p["id"],
            "doctrine_id": d_id,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["layer"] == "orbital"
        assert body["assigned"] == 2
        # layers dict has the two robots in orbital
        assert set(body["layers"]["orbital"]["assigned_robots"]) == {r1["id"], r2["id"]}
        # and they are NOT in any other combat layer
        for lid in ("deep_space", "atmosphere", "ground"):
            assert r1["id"] not in body["layers"][lid].get("assigned_robots", [])
            assert r2["id"] not in body["layers"][lid].get("assigned_robots", [])

        # /defense/state confirms persistence (layers is a dict keyed by layer id)
        st = api.get(f"{BASE_URL}/api/defense/state/{p['id']}")
        assert st.status_code == 200
        layers = st.json()["layers"]
        assert set(layers["orbital"]["assigned_robots"]) == {r1["id"], r2["id"]}

    def test_deploy_layer_id_override(self, api, mongo):
        p = _init_player(api)
        _mongo_set_resources(mongo, p["id"], materials=2000, compute=2000, energy=500)
        r1 = _create_robot(api, p["id"])
        r2 = _create_robot(api, p["id"])

        s = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"name": "Orbit", "robot_ids": [r1["id"], r2["id"]], "target_layer": "orbital"},
        })
        d_id = s.json()["doctrine"]["id"]

        # deploy first to orbital
        api.post(f"{BASE_URL}/api/doctrines/deploy", json={"player_id": p["id"], "doctrine_id": d_id})

        # now override to ground
        r = api.post(f"{BASE_URL}/api/doctrines/deploy", json={
            "player_id": p["id"],
            "doctrine_id": d_id,
            "layer_id": "ground",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["layer"] == "ground"
        assert set(body["layers"]["ground"]["assigned_robots"]) == {r1["id"], r2["id"]}
        # removed from orbital
        assert r1["id"] not in body["layers"]["orbital"].get("assigned_robots", [])
        assert r2["id"] not in body["layers"]["orbital"].get("assigned_robots", [])

    def test_deploy_bogus_doctrine_id_404(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/doctrines/deploy", json={
            "player_id": p["id"],
            "doctrine_id": "does-not-exist",
        })
        assert r.status_code == 404

    # ---------- delete ----------
    def test_delete_removes_doctrine(self, api, mongo):
        p = _init_player(api)
        _mongo_set_resources(mongo, p["id"], materials=2000, compute=2000, energy=500)
        r1 = _create_robot(api, p["id"])

        s = api.post(f"{BASE_URL}/api/doctrines/save", json={
            "player_id": p["id"],
            "doctrine": {"name": "Temp", "robot_ids": [r1["id"]], "target_layer": "atmosphere"},
        })
        d_id = s.json()["doctrine"]["id"]

        # confirm present
        assert len(api.get(f"{BASE_URL}/api/doctrines/{p['id']}").json()) == 1

        r = api.post(f"{BASE_URL}/api/doctrines/delete", json={
            "player_id": p["id"],
            "doctrine_id": d_id,
        })
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        # next list is empty
        r = api.get(f"{BASE_URL}/api/doctrines/{p['id']}")
        assert r.status_code == 200
        assert r.json() == []


# ==================================================================
# ZONE REPAIR
# ==================================================================
def _damage_zone(mongo, player_id, zone_id, integrity):
    """Direct mongo update to damage a specific zone."""
    r = mongo.players.update_one(
        {"id": player_id, "defense.zones.id": zone_id},
        {"$set": {"defense.zones.$.integrity": integrity}},
    )
    assert r.matched_count == 1, f"failed to damage zone {zone_id}"


def _get_zone_integrity(mongo, player_id, zone_id):
    doc = mongo.players.find_one({"id": player_id}, {"defense.zones": 1})
    for z in doc["defense"]["zones"]:
        if z["id"] == zone_id:
            return z["integrity"]
    return None


class TestZoneRepair:
    def test_zero_points_returns_400(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": 0,
        })
        assert r.status_code == 400
        assert "positive" in r.text.lower()

    def test_negative_points_returns_400(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": -5,
        })
        assert r.status_code == 400

    def test_full_healed_zone_returns_repaired_zero(self, api):
        p = _init_player(api)
        # new player: all zones at 100
        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": 10,
        })
        assert r.status_code == 200, r.text
        assert r.json()["repaired"] == 0

    def test_unknown_zone_id_404(self, api):
        p = _init_player(api)
        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "atlantis", "points": 5,
        })
        assert r.status_code == 404

    def test_unknown_player_404(self, api):
        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": "ghost", "zone_id": "water", "points": 5,
        })
        assert r.status_code == 404

    def test_repair_valid_points_deducts_and_caps(self, api, mongo):
        """
        cost formula:
          cost_mat = actual * 3
          cost_energy = max(1, (actual // 5) * 1)

        We damage water to 30, then repair 20 points.
          actual = min(70, 20) = 20
          cost_mat = 60, cost_energy = max(1, 4) = 4
        Note: server-side energy is capped at ENERGY_REGEN_CAP=100, so we start
        from 100 (max) — apply_energy_regen caps any higher value on entry.
        """
        p = _init_player(api)
        _damage_zone(mongo, p["id"], "water", 30)
        # set resources to a known state (energy at cap)
        _mongo_set_resources(mongo, p["id"], materials=500, energy=100)

        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": 20,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["repaired"] == 20
        assert body["zone"]["integrity"] == 50
        # 500 - 60 = 440
        assert body["resources"]["materials"] == 500 - 60
        # 100 - 4 = 96
        assert body["resources"]["energy"] == 100 - 4
        # viability recalculated (float between 0 and 100)
        assert "viability" in body
        assert 0 <= body["viability"] <= 100

        # persisted in mongo
        assert _get_zone_integrity(mongo, p["id"], "water") == 50

    def test_repair_caps_at_100(self, api, mongo):
        """
        Damage zone to 90, request 30 points. actual = min(10, 30) = 10.
        cost_mat = 30, cost_energy = max(1, 2) = 2. Integrity capped at 100.
        """
        p = _init_player(api)
        _damage_zone(mongo, p["id"], "biomass", 90)
        _mongo_set_resources(mongo, p["id"], materials=500, energy=100)

        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "biomass", "points": 30,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["repaired"] == 10
        assert body["zone"]["integrity"] == 100
        assert body["resources"]["materials"] == 500 - 30
        assert body["resources"]["energy"] == 100 - 2

    def test_repair_min_1_energy(self, api, mongo):
        """
        Damage water to 98, request 2 pts. actual=2. cost_mat=6, cost_energy=max(1, 0)=1.
        """
        p = _init_player(api)
        _damage_zone(mongo, p["id"], "water", 98)
        _mongo_set_resources(mongo, p["id"], materials=500, energy=100)

        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": 2,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["repaired"] == 2
        assert body["resources"]["materials"] == 500 - 6
        assert body["resources"]["energy"] == 100 - 1

    def test_insufficient_materials_400(self, api, mongo):
        p = _init_player(api)
        _damage_zone(mongo, p["id"], "water", 40)
        # actual = min(60, 20) = 20, cost_mat=60. Give only 10 materials.
        _mongo_set_resources(mongo, p["id"], materials=10, energy=200)

        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": 20,
        })
        assert r.status_code == 400, r.text
        assert "INSUFFICIENT MATERIALS" in r.text
        # verify nothing was mutated
        assert _get_zone_integrity(mongo, p["id"], "water") == 40

    def test_insufficient_energy_400(self, api, mongo):
        p = _init_player(api)
        _damage_zone(mongo, p["id"], "water", 40)
        # actual=20, cost_mat=60, cost_energy=max(1,4)=4. Give 500 mat, 0 energy.
        _mongo_set_resources(mongo, p["id"], materials=500, energy=0)
        # apply_energy_regen may top up energy; force resources_updated_at=now
        from datetime import datetime, timezone
        mongo.players.update_one(
            {"id": p["id"]},
            {"$set": {"resources_updated_at": datetime.now(timezone.utc).isoformat()}},
        )

        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": 20,
        })
        assert r.status_code == 400, r.text
        assert "INSUFFICIENT ENERGY" in r.text
        # zone must not have been repaired
        assert _get_zone_integrity(mongo, p["id"], "water") == 40

    def test_repair_updates_viability(self, api, mongo):
        """Damage many zones, verify viability goes up after repair."""
        p = _init_player(api)
        _damage_zone(mongo, p["id"], "water", 20)
        _mongo_set_resources(mongo, p["id"], materials=5000, energy=100)

        # get pre-repair viability
        st = api.get(f"{BASE_URL}/api/defense/state/{p['id']}").json()
        v_before = st["viability"]

        r = api.post(f"{BASE_URL}/api/defense/zone_repair", json={
            "player_id": p["id"], "zone_id": "water", "points": 80,
        })
        assert r.status_code == 200, r.text
        v_after = r.json()["viability"]
        assert v_after > v_before
