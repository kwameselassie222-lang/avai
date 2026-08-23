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

## Screens
- `/` — Boot / activate
- `/(tabs)/command` — HUD with resources, gen unlock bar, strategic regions grid, Apollyon CTA (when unlocked), active threats
- `/(tabs)/builder` — gen-locked parts, cost display
- `/(tabs)/fleet` — Fleet hangar
- `/(tabs)/leaderboard` — global ranks
- `/combat` — turn-based combat (accepts threat OR region param)
- `/apollyon` — 3-phase boss duel + decision + ending

## Integrations
- Gemini 3 Flash via Emergent LLM key for AI briefings and Apollyon endings
- MongoDB for persistence
