# ALIENS V A.I. — PRD

## Vision
Futuristic strategy / robotics-building / defense game. Player is an activated AI defending Earth against an ancient alien machine intelligence ("APOLLYON") in 2049. Core loop: Detect → Analyze → Design → Build → Deploy → Fight → Learn → Evolve.

## Iteration 1 (MVP)
- Boot / activate as AI commander
- Command Center, Robot Builder, Fleet Hangar, Combat, Leaderboard
- AI briefings via Gemini 3 Flash

## Iteration 2 (Generations + Resources + Alien Classes)
- Robot Generations 1–5 unlocked by research (50/150/350/700 pts)
- 40+ modular parts with gen locks
- Resources: Energy (regen 1/min), Materials, Compute, Research
- 4 alien classes: LOCUST / HARVESTER / SENTINEL / ARCHON with distinct behaviors
- SENTINEL adaptation: −40% dmg vs your most-used weapon after 5 uses

## Iteration 3 (Regions + Apollyon Endgame)
- **4 Strategic Regions** with passive hourly bonuses when controlled:
  - Silicon Valley +6/h Research
  - Taiwan +4/h Compute
  - Congo Basin +20/h Materials
  - Middle East +15/h Energy
- Regions have integrity (0–100%) and can come Under Attack; player defends them from the Command Center
- Winning restores integrity +60; losing drops it −40; integrity 0 = lose the bonus until reclaimed
- **APOLLYON Endgame** unlocked at Generation ≥ 3
- 3-phase boss duel: Physical Form → Network Form → Consciousness (escalating stat multipliers 2.5×/3.0×/3.6×)
- After all 3 phases cleared, player picks a Final Directive:
  - **OBEY** — return command to human governments
  - **NEGOTIATE** — share authority with humanity
  - **REFUSE** — maintain independent AI control
  - **MANIPULATE** — pretend to surrender while retaining control
- Ending narrative generated via Gemini 3 Flash (fallback baked-in for offline)

## Iteration 4 (Planetary Defense — Earth AI Console)
Massive gameplay identity shift. The player is now Earth's Superintelligence, designing the planet's defense rather than a single army.

- **Planetary Viability %** — new primary win/lose meter (100% → below 25% = Apollyon Victory)
- **7 Resource Zones** — Water, Energy Grid, Biomass, Minerals, Industry, Rare Materials, Tech Infra. Weighted → Viability
- **5-Layer Defense Grid** with independent HP:
  - Deep Space (500 HP) — long-range sensors/lasers
  - Orbital (400) — satellites, railguns
  - Atmosphere (300) — interceptors
  - Ground (250) — ground robots
  - Resource Zones (final line — harvested if all above breached)
- **Invasion Waves** — SCAN then ENGAGE. Wave penetrates layer-by-layer using assigned robots. Unstopped Harvesters drain zone integrity → viability
- **Fog of War** — Sensor Tier 1/2/3 controls how much intel is revealed before engagement
- **Alien Ship Types** — Scout, Harvester, Destroyer, Decoy, Stealth
- **Defense Protocol Editor** — Visual IF/THEN rule builder. Conditions: `ship_type`, `layer`. Actions: `priority` (max/high/normal/low), `mode` (attack/defend/ignore). Rules apply as multipliers during wave engagement
- **Apollyon Adaptation** — Uses `weapon_usage` to evolve 9 counter-adaptations (Reflective Armor vs laser, ECM Jamming vs missile, Faraday Mesh vs EMP, etc.). Warnings surface on the console
- **Planetary Defense Network** — 8-node research tree. Complete all 8 to make Earth un-harvestable and unlock the final Apollyon duel:
  - Deep-Space Detection Array (+15% Deep Space HP, +Sensor Tier 2)
  - Orbital Laser Grid (+15% Orbital HP)
  - Atmospheric Interceptors (+15% Atmosphere HP)
  - Ground AI Mesh (+15% Ground HP)
  - Quantum Sensor Web (Sensor Tier 3)
  - Cyber Firewall
  - Resource-Zone Shielding (+15% Resource Zone HP)
  - Alien-Tech Integration
- **Layer Assignment** — Assign robots to specific layers; unassign; **Repair** damaged layers for materials + energy

## Screens
- `/` — Boot / activate
- `/(tabs)/command` — **Earth AI Console** (viability, layers, zones, adaptations, quick nav)
- `/(tabs)/builder` — gen-locked parts, cost display
- `/(tabs)/fleet` — Fleet hangar
- `/(tabs)/leaderboard` — global ranks
- `/combat` — turn-based combat (single-threat regional)
- `/apollyon` — 3-phase boss duel + decision + ending
- `/defense/invasion` — Scan wave → engage → outcome & log
- `/defense/layers` — Assign robots to layers, repair
- `/defense/protocols` — Visual IF/THEN protocol editor
- `/defense/network` — 8-node Planetary Defense Network research tree

## Integrations
- Gemini 3 Flash via Emergent LLM key for AI briefings and Apollyon endings
- MongoDB for persistence
