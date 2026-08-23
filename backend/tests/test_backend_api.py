"""Backend API tests for ALIENS V A.I."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://robot-evolution-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def player():
    r = requests.post(f"{API}/player/init", json={"codename": "TESTER-BE"}, timeout=30)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("id") and p["codename"] == "TESTER-BE"
    return p


@pytest.fixture(scope="module")
def robot(player):
    payload = {
        "player_id": player["id"],
        "name": "TEST_ORION",
        "chassis": "tank", "mobility": "hover", "armor": "nanomaterial",
        "weapon": "plasma", "sensor": "quantum", "ai_module": "tactical",
    }
    r = requests.post(f"{API}/robots", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    robot = r.json()
    yield robot
    requests.delete(f"{API}/robots/{robot['id']}", timeout=15)


# --- player endpoints ---

def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert "message" in r.json()


def test_player_init_and_get(player):
    r = requests.get(f"{API}/player/{player['id']}", timeout=15)
    assert r.status_code == 200
    assert r.json()["id"] == player["id"]


def test_player_init_idempotent(player):
    r = requests.post(f"{API}/player/init", json={"codename": "TESTER-BE"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["id"] == player["id"]


# --- robot endpoints ---

def test_robot_stats_computed(robot):
    for s in ("attack", "defense", "speed", "tech", "power"):
        assert robot[s] > 0, f"{s} should be > 0, got {robot[s]}"
    assert robot["power"] == robot["attack"] + robot["defense"] + robot["speed"] + robot["tech"]


def test_list_robots(player, robot):
    r = requests.get(f"{API}/robots", params={"player_id": player["id"]}, timeout=15)
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert robot["id"] in ids


def test_create_robot_invalid_player():
    payload = {
        "player_id": "no-such-player", "name": "X",
        "chassis": "tank", "mobility": "hover", "armor": "steel",
        "weapon": "laser", "sensor": "radar", "ai_module": "hunter",
    }
    r = requests.post(f"{API}/robots", json=payload, timeout=15)
    assert r.status_code == 404


def test_delete_robot(player):
    payload = {
        "player_id": player["id"], "name": "TEST_TEMP",
        "chassis": "drone", "mobility": "wings", "armor": "carbon",
        "weapon": "laser", "sensor": "lidar", "ai_module": "swarm",
    }
    created = requests.post(f"{API}/robots", json=payload, timeout=15).json()
    r = requests.delete(f"{API}/robots/{created['id']}", timeout=15)
    assert r.status_code == 200
    assert r.json()["deleted"] == 1
    lst = requests.get(f"{API}/robots", params={"player_id": player["id"]}, timeout=15).json()
    assert created["id"] not in [x["id"] for x in lst]


# --- threats ---

def test_list_threats():
    r = requests.get(f"{API}/threats/list", params={"count": 3}, timeout=15)
    assert r.status_code == 200
    threats = r.json()
    assert len(threats) == 3
    for t in threats:
        for k in ("hp", "attack", "weakness", "name", "location", "threat_level"):
            assert k in t


# --- battle ---

def test_battle_flow(player, robot):
    threat = requests.get(f"{API}/threats/list", params={"count": 1}, timeout=15).json()[0]
    before = requests.get(f"{API}/player/{player['id']}", timeout=15).json()

    r = requests.post(f"{API}/battle", json={
        "player_id": player["id"], "robot_id": robot["id"], "threat": threat,
    }, timeout=30)
    assert r.status_code == 200, r.text
    res = r.json()
    assert isinstance(res["rounds"], list) and len(res["rounds"]) > 0
    assert "victory" in res and "xp_gained" in res
    for rnd in res["rounds"]:
        for k in ("round", "robot_dmg", "threat_dmg", "robot_hp", "threat_hp"):
            assert k in rnd

    after = requests.get(f"{API}/player/{player['id']}", timeout=15).json()
    assert after["xp"] >= before["xp"] + res["xp_gained"]
    assert after["score"] >= before["score"]


def test_battle_bad_robot(player):
    threat = requests.get(f"{API}/threats/list", params={"count": 1}, timeout=15).json()[0]
    r = requests.post(f"{API}/battle", json={
        "player_id": player["id"], "robot_id": "does-not-exist", "threat": threat,
    }, timeout=15)
    assert r.status_code == 404


# --- leaderboard ---

def test_leaderboard(player):
    r = requests.get(f"{API}/leaderboard", timeout=15)
    assert r.status_code == 200
    lb = r.json()
    assert isinstance(lb, list) and len(lb) > 0
    scores = [x["score"] for x in lb]
    assert scores == sorted(scores, reverse=True)
    assert any(x["codename"] == "TESTER-BE" for x in lb)


# --- AI brief (Gemini 3 Flash) ---

def test_ai_brief_returns_text():
    r = requests.post(f"{API}/ai/brief", json={
        "threat_name": "Xenon Stalker", "threat_level": 7, "location": "Tokyo",
        "context": "Initial scan pattern anomaly.",
    }, timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("brief"), str) and len(data["brief"].strip()) > 10
