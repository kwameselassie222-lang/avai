# ALIENS V A.I. — PRD

## Vision
Futuristic strategy / robotics-building / defense game. Player is an activated AI defending Earth against an ancient alien machine intelligence ("APOLLYON") in 2049. Core loop: Detect → Analyze → Design → Build → Deploy → Fight → Learn → Evolve.

## Iteration 1 (MVP)
- Boot / activate as AI commander (codename)
- Command Center: global threat map + threat cards
- Robot Builder: modular assembly (chassis, mobility, armor, weapon, sensor, AI module) with live stat computation
- Fleet Hangar: list of built robots with power rating
- Combat: turn-based simulation with animated replay + AI briefing via Gemini 3 Flash
- Global Leaderboard: scores across all commanders

## Iteration 2 (Generations + Resources + Alien Classes)
- **Robot Generations 1–5** with new parts per gen (humanoid → morphling → avatar; railgun → gravity → resonance)
- Gen 2 unlocks at 50 research, Gen 3 at 150, Gen 4 at 350, Gen 5 at 700
- **Resource economy**: Energy (regenerates 1/min, cap 100), Materials, Compute, Research
- Robot builds consume Materials + Compute; dismantle refunds 50% mat + full compute
- Deploy to combat costs 10 Energy
- **Named alien classes** each with distinct combat behavior:
  - LOCUST — swarm, fast, low armor (level 1+)
  - HARVESTER — tanky, drains materials on loss (level 2+)
  - SENTINEL — adaptive, resists most-used weapon (-40% dmg) (level 3+)
  - ARCHON — boss-tier commander (level 6+)
- **Sentinel adaptation**: tracks `weapon_usage`; if a weapon is used ≥5 times, sentinels resist it

## Integrations
- Gemini 3 Flash via Emergent LLM key for APOLLYON tactical briefings
- MongoDB for persistence (players, robots, battles)

## Tech
- Frontend: Expo Router (React Native), Rajdhani + IBM Plex fonts, HUD components (StatBar, HudPanel, Chip)
- Backend: FastAPI, Motor async MongoDB, emergentintegrations

## Screens
- `/` — Boot / activate (codename)
- `/(tabs)/command` — Command Center (resources + gen unlock + threats)
- `/(tabs)/builder` — Robot Builder (gen-gated parts, cost display)
- `/(tabs)/fleet` — Fleet Hangar (gen badges on robots)
- `/(tabs)/leaderboard` — Ranks (level + gen)
- `/combat` — Combat with alien-class banner + adaptation warnings
