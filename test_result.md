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
