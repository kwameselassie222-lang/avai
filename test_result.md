#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: |
  Iteration 4 — Planetary Defense (Earth AI Console). Massive identity shift:
  Player is Earth's Superintelligence designing planetary defense.

backend:
  - task: "Defense config & state endpoints (GET /api/defense/config, GET /api/defense/state/{id})"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New iteration 4 endpoint. Returns 5 layers, 7 zones, 8 network nodes. State endpoint returns viability, layers with HP, zones, sensor_tier, network_progress, protocols, adaptations."
        - working: true
          agent: "testing"
          comment: "PASSED. /defense/config returns 5 layers in order (deep_space/orbital/atmosphere/ground/resource_zones) with correct max_hp (500/400/300/250/200), 7 zones summing to weight=100, 8 network nodes, ship_types map, viability_critical=25.0. /defense/state returns viability=100, sensor_tier=1, network_progress=[], protocols=[], 5 layers at full HP, 7 zones at 100%. 404 for unknown player."

  - task: "Layer assignment endpoints (POST /api/defense/assign, /unassign, /repair)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Assign robot to one of 4 combat layers (deep_space/orbital/atmosphere/ground). Repair costs materials+energy. Unassign always allowed."
        - working: true
          agent: "testing"
          comment: "PASSED. Assign/unassign/reassign all work; re-assigning a robot correctly removes it from prior layer. Invalid layer 'resource_zones' → 400. Bogus layer 'moon_base' → 400. Repair on full-HP layer returns repaired:0. Repair on 'resource_zones' → 400."

  - task: "Protocol editor endpoint (POST /api/defense/protocols)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Saves list of IF/THEN rules. Rules use conditions {ship_type|layer} and actions {priority|mode}. Applied as damage multipliers during invasion sim."
        - working: true
          agent: "testing"
          comment: "PASSED. Protocol save round-trips; auto-generates rule ID when omitted; persists on subsequent /defense/state call."

  - task: "Invasion scan & engage (POST /api/invasion/scan, /engage)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Scan generates wave with fog-of-war based on sensor_tier. Engage simulates 5-layer penetration, harvests zones, updates viability, awards XP/research. Costs 15 energy."
        - working: true
          agent: "testing"
          comment: "PASSED. Tier-1 scan hides decoys as 'unknown', breakdown=None, unknown_signatures populated. Engage returns outcome/log/viability_after/layers_after/zones_after/adaptations/rewards/resources. Engage with unknown wave_id → 400 'No matching wave'. Engaging same wave_id twice fails (last_wave cleared post-engage). Apollyon-victory scenario reached viability≤25 after repeated undefended waves."

  - task: "Planetary Defense Network build (POST /api/network/build)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "8 nodes. Each costs research + optionally compute/materials/energy. Reinforces layer HP by 15%. Deep-space array unlocks sensor tier 2, quantum sensors unlocks tier 3. All 8 complete = network_complete flag."
        - working: true
          agent: "testing"
          comment: "PASSED. deep_space_array upgrades sensor_tier→2 and boosts deep_space max_hp by exactly 15%. Subsequent scan reports intel.level=2 with breakdown populated. Duplicate build → 400 'Node already built'. Insufficient resources → 400 with 'Need N RESOURCE' message. Unknown node id → 404."

  - task: "Apollyon adaptation compute (weapon_usage → counters)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "compute_adaptations() maps top weapons to counters (laser→REFLECTIVE ARMOR, missile→ECM JAMMING, etc). Surfaced in scan response and defense state."
        - working: true
          agent: "testing"
          comment: "PASSED indirectly — adaptations array returned in /invasion/scan response and /defense/state (empty when weapon_usage<3, populated with reflective/ecm counters after repeated engages)."

  - task: "Defense state migration for legacy players"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "ensure_defense_state() bootstraps missing defense field, missing layers, missing zones. Called in init_player, get_player, and every defense endpoint."
        - working: true
          agent: "testing"
          comment: "PASSED. Inserted a raw legacy player doc into Mongo (no defense field). /player/{id} auto-bootstraps defense with viability=100 and 5 layers. /defense/state/{id} likewise returns full state."

frontend:
  - task: "Earth AI Console (reworked command tab)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/command.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Invasion scan+engage screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/invasion.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Layer assignment screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/layers.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Protocol editor screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/protocols.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Planetary Defense Network screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/network.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

metadata:
  created_by: "main_agent"
  version: "4.0"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus:
    - "Defense config & state endpoints (GET /api/defense/config, GET /api/defense/state/{id})"
    - "Layer assignment endpoints (POST /api/defense/assign, /unassign, /repair)"
    - "Invasion scan & engage (POST /api/invasion/scan, /engage)"
    - "Planetary Defense Network build (POST /api/network/build)"
    - "Protocol editor endpoint (POST /api/defense/protocols)"
    - "Defense state migration for legacy players"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Iteration 4 complete. Please backend-test all Planetary Defense endpoints.
        Full flow to verify:
        1. POST /api/player/init → returns player with .defense (viability=100, 5 layers, 7 zones, sensor_tier=1, network_progress=[])
        2. GET /api/defense/config → static (5 layers, 7 zones, 8 nodes, ship_types map)
        3. GET /api/defense/state/{player_id} → dynamic state
        4. POST /api/robots to create at least 2 robots
        5. POST /api/defense/assign to place robots in 'orbital' and 'ground'
        6. POST /api/defense/protocols with 1 rule {IF ship_type=harvester THEN priority=max}
        7. POST /api/invasion/scan → returns wave with revealed ships (tier-1 sees "unknown" for decoys)
        8. POST /api/invasion/engage with wave_id → returns outcome/log/viability_after; viability should drop when zones harvested
        9. Sensor tier upgrade: POST /api/network/build node_id=deep_space_array; then scan → intel.level should be 2, breakdown populated
        10. Repeated waves should keep reducing viability; if viability <= 25 outcome=apollyon_victory
        11. POST /api/defense/reset/{id} restores planet
        Edge cases:
        - Engage without preceding scan → 400 "No matching wave"
        - Assign to invalid layer 'resource_zones' → 400
        - Build same node twice → 400 "Node already built"
        - Build node with insufficient resources → 400 explaining what's missing
        - Repair fully-healed layer → returns repaired:0
        Do NOT test frontend; that will be tested via user in Expo Go.

    - agent: "testing"
      message: |
        Iteration 4 backend testing complete — 23/23 pytest tests PASSED (0 failures).
        Test file: /app/backend/tests/test_iteration4.py (junit xml: /app/test_reports/pytest/iteration4_results.xml)
        Verified all endpoints and edge cases specified above, plus:
          - Reassigning a robot correctly removes it from its previous layer
          - deep_space_array boosts deep_space max_hp by exactly +15%
          - Tier-1 fog-of-war: decoys shown as 'unknown', breakdown hidden, unknown_signatures populated
          - Tier-2 (after deep_space_array): intel.level=2, breakdown populated
          - Legacy player docs (no `defense` field) auto-bootstrap on /player/{id} AND /defense/state/{id}
          - Repeated undefended waves eventually push viability ≤25 → outcome='apollyon_victory'
          - Duplicate node build → 400 'Node already built'; unknown node id → 404
          - Insufficient-resources build → 400 with 'Need N <RESOURCE>' detail
        No blockers. All iteration 4 backend tasks marked working=true, needs_retesting=false.
        Frontend not tested per request.

# ============ ITERATION 5 ADDITIONS ============

backend:
  - task: "Cascading damage modifiers (GET /api/defense/cascade/{id})"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Compromised zones apply penalties:
            - energy<40 → build_material_mult *1.25, energy_regen_mult *0.5
            - industry<40 → build_material_mult *1.3
            - tech<40 → compute_regen_mult *0.5, build_compute_mult *1.3, sensor_penalty +1
            - rare<30 → build_material_mult *1.4
            Robot creation now uses robot_cost_with_cascade().
            Effective sensor tier used by invasion/scan.

  - task: "Archon endpoints (config, status, battle)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            4 archons: swarm_lord (summon), silence (jam), devourer (drain), mirror (reflect).
            Gates: swarm=W2/G2, silence=W4/G3, devourer=W6/G4, mirror=W8/G4.
            /archons/config returns full list. /archons/status/{id} returns per-player unlocked/defeated flags.
            /archons/battle requires 20 energy, runs turn-based sim with mechanic effects, awards rewards + part_unlock.

  - task: "Multi-front triage (POST /api/triage/scan/{id}, /triage/resolve)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Unlocks after wave 3. Scan picks 3 highest-weight healthy zones, attaches incoming_damage.
            Resolve requires exactly 2 defend_zone_ids; defended takes 35% damage, sacrificed takes full.
            Awards +12 research.

  - task: "Deeper protocol evaluator (AND/OR, alien_class, viability_below, adaptation_active)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            eval_protocol_conditions() splits by 'combine':'or' into OR groups.
            Supports keys: ship_type, layer, alien_class, viability_below, adaptation_active.
            Applied in simulate_invasion via apply_protocol_boost() ctx.

frontend:
  - task: "Command tab: cascade warnings + Archons/Triage CTAs"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/command.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Archons screen (list, engage, result)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/archons.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Triage screen (scan, choose 2, resolve)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/triage.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Protocol editor: AND/OR toggle + new condition keys"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/protocols.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true

test_plan:
  current_focus:
    - "Cascading damage modifiers (GET /api/defense/cascade/{id})"
    - "Archon endpoints (config, status, battle)"
    - "Multi-front triage (POST /api/triage/scan/{id}, /triage/resolve)"
    - "Deeper protocol evaluator (AND/OR, alien_class, viability_below, adaptation_active)"

agent_communication:
    - agent: "main"
      message: |
        Iteration 5 adds:
        1. Cascading damage (zone integrity → build/regen/sensor penalties)
        2. Archon mini-bosses (4 unique mechanics: summon, jam, drain, reflect)
        3. Multi-front triage (choose 2 of 3 zones to defend)
        4. Deeper protocol logic (AND/OR + alien_class + viability_below + adaptation_active)

        Please backend-test:
        A. Cascading:
           - Fresh player has empty warnings, tier 1
           - Manually drop energy zone to 30 → warnings include "ENERGY GRID compromised", build_material_mult=1.25, energy_regen_mult=0.5
           - Drop tech to 25 → adds "TECH INFRA compromised" warning, effective_sensor_tier = max(1, base-1)
           - Create a robot with damaged zones → cost should reflect the multipliers (higher materials/compute)
        B. Archons:
           - GET /archons/config returns 4 archons
           - GET /archons/status/{new_player_id} → all locked (wave/gen too low)
           - Simulate a defeated archon by pushing wave_count via multiple engages, then battle → should succeed if wave/gen met
           - Battle same archon twice → 400 "already defeated"
           - Devourer battle drains materials; Mirror reflects 40%; Swarm Lord summons (log notes contain "SWARM LORD summons")
        C. Triage:
           - triage/scan with wave_count < 3 → 400
           - Advance wave then scan → returns 3 zones with incoming_damage
           - resolve with 1 zone → 400 "exactly 2"
           - resolve with 3 zones → 400
           - resolve with valid 2 → defended zones lose ~35% of dmg, sacrificed loses full
        D. Deeper protocols:
           - Save protocol with 2 conditions, second has combine='or' → returns 200 and stored
           - Save protocol with condition {key:'viability_below', value:'50'} → stored
           - Save protocol with condition {key:'adaptation_active', value:'ECM JAMMING'} → stored
           - Optional: run an engage and confirm rule mult is applied when conditions match

        Do not test frontend. Backend-only.

# ============ ITERATION 6 ADDITIONS ============

backend:
  - task: "Doctrines CRUD & deploy (POST /api/doctrines/save, /delete, /deploy; GET /api/doctrines/{id})"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Doctrines stored in defense.doctrines. Save validates robot ownership.
            Deploy re-assigns robots to a layer atomically (removes from any layer first).
            target_layer must be one of deep_space/orbital/atmosphere/ground.
        - working: true
          agent: "testing"
          comment: |
            PASSED all 12 doctrine tests.
            - GET /doctrines/{new_player} → []
            - GET on unknown player → 404
            - POST /save without id → auto-generates 8-char hex id, doctrines length=1
            - POST /save with same id + new name → updates in place, doctrines length still 1
            - POST /save with unknown robot_id → 400 "Robot {id} not found for player"
            - POST /save with target_layer='resource_zones' → 400 "Invalid target_layer"
            - POST /save with target_layer='nope' → 400
            - POST /deploy → returns {ok, layer, assigned=2, layers dict}. Robots appear in orbital.assigned_robots and are absent from all other combat layers. Confirmed via /defense/state.
            - POST /deploy with layer_id override → moves robots from orbital to ground; removes from orbital.
            - POST /deploy with bogus doctrine_id → 404
            - POST /delete → doctrines list becomes empty on next GET.

  - task: "Zone repair (POST /api/defense/zone_repair)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Costs 3 materials per 1% integrity, 1 energy per 5%.
            Caps at 100%. Updates viability. 400 on missing resources or invalid zone.
        - working: true
          agent: "testing"
          comment: |
            PASSED all 10 zone_repair tests.
            - points=0 / points=-5 → 400 "Points must be positive"
            - fully-healed zone → 200 with repaired=0
            - unknown zone_id → 404
            - unknown player_id → 404
            - valid repair: damage water=30, points=20 → repaired=20, integrity=50, materials -60, energy -4 (100→96)
            - integrity cap: damage biomass=90, points=30 → repaired=10 (capped), integrity=100, materials -30, energy -2
            - min 1 energy: damage water=98, points=2 → cost_energy=max(1, 0)=1 correctly applied
            - insufficient materials → 400 "INSUFFICIENT MATERIALS: need {N}" and zone unchanged
            - insufficient energy → 400 "INSUFFICIENT ENERGY: need {N}" and zone unchanged
            - viability recomputed and returned; increases after successful repair
            NOTE: Because apply_energy_regen caps energy at ENERGY_REGEN_CAP=100, any zone-repair
            request will effectively be limited to ~100 energy per call. Not a bug, just noting
            for FE flow.

  - task: "Apollyon ending includes archon history"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Extended prompt to Gemini includes DEFEATED / SPARED Archon names,
            viability%, network_complete. No structural change—just richer prompt.

frontend:
  - task: "Archon cinematic overlay component"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/archon-cinematic.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false

  - task: "Doctrines screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/doctrines.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Zone repair screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/defense/zones.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

test_plan:
  current_focus:
    - "Doctrines CRUD & deploy (POST /api/doctrines/save, /delete, /deploy; GET /api/doctrines/{id})"
    - "Zone repair (POST /api/defense/zone_repair)"

agent_communication:
    - agent: "main"
      message: |
        Iteration 6 adds cinematics + doctrines + zone repair + apollyon prompt upgrade.
        Backend-test the 2 new endpoint groups only (Apollyon prompt change is not testable via unit,
        it's an LLM prompt edit — do NOT hit the LLM in tests).
        
        Doctrines:
        - GET /api/doctrines/{new_player} → []
        - POST /save (no id) → creates with generated id, returns list
        - POST /save (with id + new name) → updates existing
        - POST /save with bogus robot_id → 400
        - POST /save with bogus target_layer → 400
        - POST /deploy → assigns doctrine's robots to layer, removes them from any prior layer
        - POST /deploy with bogus doctrine_id → 404
        - POST /delete removes the doctrine
        
        Zone repair:
        - POST /defense/zone_repair with 0 points → 400
        - Full-integrity zone → returns repaired:0
        - Damaged zone: correct cost math (3 mat/pt, 1 energy/5pt, min 1 energy)
        - Insufficient materials → 400
        - Insufficient energy → 400
        - Updates viability

    - agent: "testing"
      message: |
        Iteration 6 backend testing complete — 22/22 pytest tests PASSED (0 failures).
        Test file: /app/backend/tests/test_iteration6.py
        JUnit XML: /app/test_reports/pytest/iteration6_results.xml
        JSON report: /app/test_reports/iteration_6.json
        Coverage:
          - Doctrines: empty-list, list-404, save-no-id (hex generated), save-with-id (update-in-place),
            save-bogus-robot (400), save-bad-target_layer x2 (400), deploy-default-layer, deploy-layer-override,
            deploy-bogus-id (404), delete-clears-list.
          - Zone repair: points=0/-5 (400), full-healed (repaired:0), unknown zone/player (404),
            valid math (3 mat/pt, 1 energy/5pt), integrity cap at 100, min-1-energy floor,
            insufficient-materials (400 + no mutation), insufficient-energy (400 + no mutation),
            viability recomputed & returned.
        Did NOT hit Apollyon LLM endpoint (per instructions).
        Observation (informational, not a bug): apply_energy_regen caps energy at
        ENERGY_REGEN_CAP=100 on every zone_repair call, so callers cannot stockpile
        energy above 100 between repair actions. If large multi-zone repairs are a UX
        goal the FE should chain smaller repairs.
        No blockers. Both iteration 6 backend tasks now working=true, needs_retesting=false.
