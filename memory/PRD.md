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

## Iteration 5 (Archons + Cascade + Triage + Deeper Protocols)

- **4 Archon Mini-Bosses** with signature mechanics:
  - THE SWARM LORD (W2/G2) — summons +1 drone every 2 rounds (+25 HP). Unlocks `swarm` chassis
  - THE SILENCE (W4/G3) — sensor jamming during fight. Unlocks `quantum` sensor
  - THE DEVOURER (W6/G4) — drains player materials each hit. Unlocks `bio` armor
  - THE MIRROR (W8/G4) — reflects 40% incoming damage. Unlocks `aura` field
- **Cascading Damage** — Zone integrity dictates system health:
  - Energy Grid <40% → build cost +25%, energy regen halved
  - Industry <40% → build cost +30%
  - Tech Infra <40% → compute cost +30%, sensor tier −1
  - Rare Materials <30% → advanced part cost +40%
  - Robot creation (`POST /api/robots`) applies these multipliers live
- **Multi-Front Triage** — after wave 3, 3 zones attacked simultaneously. Player picks 2 to defend at 35% damage; the sacrificed zone takes full damage. Awards +12 research
- **Deeper Protocol Logic**:
  - `combine: 'and' | 'or'` between conditions
  - New condition keys: `alien_class`, `viability_below`, `adaptation_active`
  - Evaluated as OR-groups of AND-clauses

## New Endpoints (iteration 5)
- `GET /api/defense/cascade/{id}` → active penalties + effective sensor tier
- `GET /api/archons/config`, `GET /api/archons/status/{id}`, `POST /api/archons/battle`
- `POST /api/triage/scan/{id}`, `POST /api/triage/resolve`

## New Screens (iteration 5)
- `/defense/archons` — Archon list, cinematic engage, round log with reflects/summons/drain
- `/defense/triage` — 3-zone attack, pick 2 to defend, outcome report

## Iteration 6 (Cinematics + Doctrines + Zone Repair + Apollyon Rewrite)

- **Cinematic Archon Intros** — Full-screen animated overlay before every Archon fight (icon scale-in, terminal signature lines, flash transition, tap-to-skip)
- **Adaptive Fleet Doctrine** — Named robot loadouts saved on the player. Assign target layer, then deploy the whole loadout to that layer in one action
- **Zone Repair Console** — Actively repair resource zones with materials (3/pt) + energy (1/5pt). Improves viability immediately
- **Apollyon Cinematic Rewrite** — Final ending prompt now includes viability, network completion status, and which Archons were defeated vs spared. Each defeated Archon carries emotional echoes in the narrative

## New endpoints (iteration 6)
- `GET /api/doctrines/{id}`, `POST /api/doctrines/save`, `POST /api/doctrines/delete`, `POST /api/doctrines/deploy`
- `POST /api/defense/zone_repair`

## New screens (iteration 6)
- `/defense/doctrines` — Editor + list + deploy
- `/defense/zones` — Repair console + per-zone repair panel

## New component
- `/src/components/archon-cinematic.tsx` — reusable cinematic overlay
