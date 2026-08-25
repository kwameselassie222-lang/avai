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

## Iteration 7 (Monetization — Phase 1 MVP)

**F2P hybrid model**: game stays free, monetization is optional, no pay-to-win.

- **Premium Currency: AI CORES (⬡)** — earned through gameplay (season tiers, transmissions, milestones) and buyable
- **Sponsored Transmissions** (sci-fi rewarded ads) with 4 slots:
  - `alien_tech` — ALIEN TECHNOLOGY RECOVERED (+ research + materials + cores). 60s cooldown
  - `emergency_energy` — PLANETARY ENERGY CRITICAL (+60 energy). 5min cooldown. Auto-prompted on Command tab when energy < 15
  - `double_rewards` — PLANETARY DEFENSE SUCCESSFUL (double wave rewards). 30s cooldown. Shown after victorious invasion
  - `emergency_repair` — DEFENSE GRID COMPROMISED (+25% layer HP). 3min cooldown
  - Modal simulates a 2.4s "sponsor relay" then grants — swap in real AdMob/UnityAds callback on native build
- **Store** (`/store`) with 4 sections: FEATURED, ROBOT DESIGNS, RESOURCE PACKS, EXPANSIONS
- **Store items**:
  - Commander Starter Pack — $3.99
  - Earth Defense License (Remove Ads) — $6.99
  - Season 1 Premium Pass — $7.99
  - 5 cosmetic armor skins (Prototype/Quantum/Seraph/Alien-Hybrid/Apollyon-Inspired) — 40–200 ⬡
  - Resource packs — 15–60 ⬡
  - AI Cores bundles — $1.99–$17.99
  - Expansion campaigns (Mars, Moon, Apollyon's Origin) — coming-soon stubs
- **Season Pass** (`/store/season`) — Season 1 "The Arrival" with 20 tiers, free + premium tracks, distinct reward tables per tier
- **Server-side purchase log + analytics stub** — every purchase timestamps a receipt

### Endpoints
- `GET /api/store/catalog`, `GET /api/store/status/{id}`
- `POST /api/store/purchase`, `POST /api/store/transmission`
- `GET /api/season/status/{id}`, `POST /api/season/add_xp`, `POST /api/season/claim`

### Screens / components added
- `/app/store/index.tsx` — Store hub
- `/app/store/season.tsx` — Season Pass
- `/src/components/transmission-modal.tsx` — Sponsored transmission modal (used in Command + Invasion)

### NOT INCLUDED (needs native build)
- Real AdMob/UnityAds SDK integration — currently uses a 2.4s simulated relay. Swap the timeout in `transmission-modal.tsx` for `AdMob.showRewarded()` and only call `api.watchTransmission()` in the onCompleted callback
- Real IAP (RevenueCat / Stripe) — currently mocked; server accepts and grants immediately. Wrap `store_purchase` behind receipt verification on native

## Iteration 8 — REDESIGN: Simple Lane-Battle MVP

Complete gameplay redesign per user's new master prompt. The game is now a **clean, arcade-simple lane-defense** rather than a complex logic simulator.

**Core loop (30-second learnable):**
Choose robot card → Tap lane → Robot auto-fights → Destroy alien core → Earn parts → Upgrade → Next level

**New game structure:**
- **HOME** — A.I. Unit One card + big BATTLE button + tiles
- **ROBOTS** — 7-robot collection, upgrade with parts, 6-card deck builder
- **MAP** — 10-level linear campaign, Atlanta → Tokyo, boss on Level 10 (HIVE QUEEN)
- **COMMANDER** — 5 evolution stages gated by total stars, 4 commander abilities to choose (Orbital Strike / EMP Pulse / Repair Wave / Overclock)

**Battle screen:**
- Vertical battlefield, 3 lanes (left/center/right)
- Bottom: Earth Core HP bar + energy 0-10 (regens 0.5/s) + ability button + 6 robot cards
- Top: Alien Core HP bar + timer
- Tap card → tap deploy zone → robot spawns and auto-fights
- Client-side game engine at 60fps via requestAnimationFrame

**Starter roster (7 robots):**
Scout (2⚡ swarm rusher), Guardian (3⚡ tank), Drone (3⚡ air), Striker (4⚡ balanced), Sniper (4⚡ long-range), Tank Bot (6⚡ heavy), Titan (7⚡ ultimate)

**4 alien types + 1 boss:**
Crawler, Spitter, Brute, Flyer, HIVE QUEEN (L10)

**3-star ratings per level:** Complete / Core > 50% HP / Within target time

**Backend endpoints (v2):**
- `GET /api/v2/config`
- `GET /api/v2/player/{id}` (auto-bootstraps campaign)
- `POST /api/v2/battle/complete` (awards parts, unlocks next robot)
- `POST /api/v2/robots/upgrade` (30 parts + 25 per level)
- `POST /api/v2/deck` (max 6)
- `POST /api/v2/commander/ability`, `POST /api/v2/commander/evolve`

**Legacy screens** (defense/*, store/*, apollyon, combat, invasion, network, archons, doctrines, zones, protocols, triage, layers) remain in the codebase but are removed from the tab nav. They can be deep-linked but the primary UX is the new lane-battle. This preserves all iteration 1–7 work for potential future depth.

**Client-side files:**
- `src/game/engine.ts` — full battle engine (init, tick, deploy, ability, stars)
- `app/battle.tsx` — battle screen
- 4 rewritten tabs

## Iteration 9 — Battle Feedback FX & Sound (June 2026)

### Visual FX (in battle.tsx + engine.ts)
- **Landing scale-in**: newly deployed entities scale from 0.4→1.0 over 0.3s
- **Hit flash**: entities briefly turn white for 150ms after taking damage
- **Hit particles**: colored rings spawn at hit points, expand + fade over 180ms
- **Explosion particles**: on entity death, larger rings expand 0.4→2.2× over 550ms
- **Screen shake**: field translates ±6px on explosions and Orbital Strike
- **Stun ring**: light-blue outline around stunned aliens (EMP)
- **Core-hit sparks**: colored flash when Earth/Alien core takes damage

### Audio (expo-audio ~1.1)
- Local WAV assets bundled at `/frontend/assets/sfx/`:
  - `deploy.wav` — mechanical thud + rising blip
  - `hit.wav` — short zap (throttled to 40ms)
  - `explode.wav` — low boom + noise wash
  - `ability.wav` — sci-fi charge/whoosh
  - `win.wav` — triumphant chord
  - `lose.wav` — descending sad tone
  - `bg_loop.wav` — 9.6s tense synth-wave loop (100 BPM, minor arpeggio + kick + pad)
- `useAudioPlayer` per SFX for zero-latency retrigger via `seekTo(0); play()`
- Background loop starts on battle load, pauses on outcome
- `setAudioModeAsync({ playsInSilentMode: true })` for iOS silent-mode playback
- Haptics: medium impact on deploy, heavy on ability, success/error on outcome

### Victory / Defeat Overlay
- Full-screen modal replaces Alert
- Animated star reveal (staggered 350ms each) up to 3 stars
- +PARTS reward badge with warning color
- Robot-unlocked banner when a new bot is earned
- MAP / NEXT (or RETRY) actions

## Iteration 10 — Feel & Progression (June 2026)

### Level 1 Tuning (tutorial-friendly)
- `energy_start`: 4 → 6 (players can afford 3 scouts to combo immediately)
- `core_hp`: 300 → 220 (destructible in a comfortable window)
- Waves: 4 → 3 crawlers (fewer overwhelming threats)

### Robot Roster Preview Modal (Robots tab)
- Tap any card (locked or unlocked) opens a full-screen preview:
  - Large colored icon (with lock overlay if locked)
  - Name • ◆ GROUND / ◆ AIR • Range
  - Flavor description
  - Full stat row: COST / HP / ATK / SPEED / RATE
  - "🔑 UNLOCKS BY BEATING LEVEL X" hint for locked robots
- Backdrop tap or CLOSE button dismisses
- Inner buttons (Deck/Upgrade) stopPropagation so they don't open the preview

### Combo Deploys
- Engine tracks `recent_deploys: {lane, time}[]` in a 4-second sliding window
- 3+ deploys in the same lane within window → combo trigger:
  - +2⚡ energy refund (capped at 10)
  - +30% ATK to all same-lane player robots
  - Golden "COMBO x3" banner fades over 1.4s
  - `combo.wav` (rising 3-note arpeggio) + heavy haptic
  - 5 golden sparkle particles cascade up the lane

### Boss Cinematic (L10)
- On first HIVE QUEEN spawn (~t=45s of L10):
  - Dark-red overlay, giant alien icon
  - "HIVE QUEEN / AWAKENED" text with slam-in scale + settle + fade (~2s total)
  - Max screen shake + `boss.wav` (deep sub-drop + metallic clang + rumble)
  - Warning haptic notification
- One-shot per battle (guarded by `boss_intro_shown`)

### Refactor — Game Loop Race Fix
- Migrated `state` from `useState` to a `useRef<BattleState>` (source of truth)
- RAF loop mutates in place & calls `forceRender((n) => n + 1)` at frame end
- `deployRobot` / `useAbility` mutate the same ref (no race with in-flight setState)
- Effect deps simplified to `[ready, level]` — the RAF no longer restarts every frame

## Iteration 11 — Story Mode (June 2026)

### Backstory Intros (10 comic-book panels)
- Curated 3-panel narratives for every level, comic-book style:
  - Panel 1: Location + situation
  - Panel 2: New threat / hostile intel
  - Panel 3: Directive + A.I. UNIT ONE sign-off
- All 10 levels: Atlanta, Washington DC, NYC, London, Lagos, Cairo, Dubai, Mumbai, Shanghai, Tokyo (final)

### Story Screen (`app/story.tsx`)
- Location badge + UTC timestamp + SKIP top-right
- OPERATION 01-10 label + mission tagline hero title
- Comic panel with big cyan border, numbered badge (1/3), header, staccato body lines
- Threat panel on final page listing incoming enemy types + boss chip
- Progress dots + big cyan DEPLOY / NEXT CTA
- Fade + slide-in animation per panel transition
- Page-turn SFX (reuses deploy.wav quiet)

### Frequency Logic
- First attempt of each level: full intro shown
- Marked seen in AsyncStorage (`aliens_vai_seen_intro_<levelId>`)
- Subsequent /story?level=X auto-forwards to /battle?level=X
- SKIP button also marks seen and forwards
- `?force=1` param overrides (for replay)

### Backend (`GET /api/v2/story/{level_id}`)
- Returns level meta + panels + optional `flavor_line`
- `?flavor=true` uses Gemini 3 Flash (Emergent LLM Key) to generate a fresh comic-panel line
- 10 curated stories keyed by level id

### Epilogue Screen (`app/epilogue.tsx`)
- Triggered after L10 Hive Queen victory
- 3-panel ending: SUNRISE / REPORT / SIGNAL (deep-space uplink teases future content)
- "EARTH SAVED" medal on final panel
- Cyan RETURN HOME CTA routes back to /(tabs)/command
- Backend: `GET /api/v2/story/epilogue`

### Routing Updates
- Map (fleet.tsx): level pins now open `/story?level=X` (not `/battle`)
- Victory NEXT button on levels 1-9 → `/story?level=nextId`
- Victory on L10 → replaces `EPILOGUE` label → `/epilogue` route
- Defeat RETRY → `/battle?level=<same>` (no story replay)

## Iteration 12 — AI Flavor Replay + Codex (June 2026)

### AI Flavor Replay (`?flavor=1`)
- Story screen accepts `?flavor=1` param → fetches `/api/v2/story/{id}?flavor=true`
- Backend uses Gemini 3 Flash (Emergent LLM Key) with a comic-panel system prompt
  ("ALL CAPS headers, staccato bold lines, ≤3 short lines, cinematic")
- Rendered as a dashed orange "◆ FRESH INTEL — A.I. NARRATIVE CORE" banner above the panels
- Markdown asterisks stripped from the AI output for clean display

### Codex Menu (Home)
- New CODEX card on Home (purple), 5th action in the grid
- Sub-label shows how many briefings archived (respects L1 unlock only vs. more)
- Tapping opens a full "WAR CODEX" modal with all 10 level rows:
  - Numbered badge (locked → lock icon)
  - Level name + world tag + BOSS badge on L10
  - Star count per level
  - Purple play-circle icon for unlocked levels
- Tapping an unlocked row navigates to `/story?level=X&force=1&flavor=1`
  → forces the intro to show + adds AI flavor for a fresh comic twist
- Locked rows visually disabled (opacity 0.4, no touch)

## Iteration 13 — Harder Aliens (June 2026)

### Wave Density (5a)
- L1-L2 unchanged (tutorial-safe)
- L3+ significantly denser:
  - L3: 4 → 6 waves
  - L4: 4 → 7 waves
  - L5: 5 → 8 waves
  - L6: 4 → 7 waves
  - L7: 5 → 9 waves
  - L8: 5 → 9 waves
  - L9: 5 → 10 waves
  - L10: 5 → 9 waves (+ Hive Queen)
- Mix rebalanced with earlier Brute appearances, back-to-back multi-lane pressure

### Hive Queen Phase System (4a)
- Phase 1 (100%–66% HP): baseline behavior
- Phase 2 (≤66% HP): **RAGE MODE**
  - +50% movement speed (rage_mult 1.5)
  - Pink pulsing aura on boss entity (4px border, sin-wave scale pulse)
  - Red "HIVE QUEEN — RAGE MODE" banner + boss.wav + haptic
  - 6 red particles burst around queen
- Phase 3 (≤33% HP): **SUMMONING**
  - +70% movement speed (rage_mult 1.7)
  - Magenta aura + faster pulse
  - Summons 2 crawlers in random lanes every 6 seconds
  - Magenta "HIVE QUEEN — SUMMONING" banner + boss.wav
  - 10 magenta particles burst
  - "CRAWLER SWARM SUMMONED" event log entry per swarm
- L10 core HP bumped 1600 → 1800 to accommodate longer phased fight

## Iteration 14 — VETERAN Toggle + Surge Waves (June 2026)

### VETERAN Difficulty Toggle (Map)
- Big top-of-map card toggling between **STANDARD** (cyan, shield icon) and **VETERAN** (red, skull icon)
- Persisted client-side in AsyncStorage (`aliens_vai_difficulty`)
- Attach `?difficulty=veteran` to /story and /battle routes when active
- Level borders and numbered circles turn red in veteran mode for visual state
- Battle screen shows a **VETERAN · 2× REWARDS** badge next to Alien Core HP

### VETERAN Mechanics (engine)
- Each wave is **duplicated** 1.5s later in an adjacent lane → 2× density
- Alien HP + ATK scaled by **+30%** on spawn (via state.difficulty flag)
- Backend `/v2/battle/complete` accepts `difficulty` param and **doubles parts_awarded** when veteran

### Surge Waves (L7+)
- New optional `surges: [{at, type}]` array per level in V2_LEVELS
- L7 → 1 surge (crawler at 22s)
- L8 → 2 surges (flyer 20s, brute 38s)
- L9 → 2 surges (spitter 22s, brute 40s)
- L10 → 2 surges (crawler 18s, flyer 33s)
- On surge time: spawn one alien of same type in **all 3 lanes simultaneously**
- Golden "⚠ SURGE INCOMING — ALL LANES" banner fades over 1.6s
- `boss.wav` sound cue + heavy screen shake to underline the moment
- Levels with surges show "⚡ SURGES" tag in the Map meta line

## Iteration 15 — Story Overhaul (Apollyon Campaign) — June 2026

### Story Always Shows
- Removed "skip on seen" auto-forward in /story
- Every level-tap on Map now shows the intro; SKIP button remains for hurry
- L1 first-visit routes through a Chapter Opener before the story

### Narrative Rewrite (World 1: FIRST CONTACT)
- All 10 L1-L10 rewritten with continuous serious-sci-fi thriller arc:
  - CH 1 (L1-L4) LANDING: aliens invade → discover it's a colony → burn hive
  - CH 2 (L5-L8) TRUTH: ancient tech under pyramids → UNIT ONE is a KILL-SWITCH → aliens were RUNNING FROM SOMETHING
  - CH 3 (L9-L10) CHOICE: Hive Queen speaks — reveals a worse threat is 7 days behind
- Each level story now carries: CHAPTER tag, PREVIOUSLY... callback, NEXT teaser
- Dr. Kaya Renn is the recurring human voice

### Chapter Opener (`/interlude?kind=chapter&id=1`)
- Full-screen intro slide for World 1: title + epigraph quote + 3 panels (EMERGENCY PROTOCOL ACTIVE, ACTIVATE, DR. KAYA RENN)
- BEGIN OPERATION button routes to `/story?level=1`
- Marked seen in AsyncStorage (`aliens_vai_seen_chapter_1`)

### APOLLYON Reveal (`/interlude?kind=reveal&id=world1`)
- L10 Hive Queen victory now routes here BEFORE epilogue
- 4-panel Apollyon transmission: SILENCE, UNKNOWN SIGNAL, THE VOICE, APOLLYON
- Red-tinted background, boss SFX, warning haptic
- CONTINUE routes to /epilogue

### Epilogue Updated
- Now teases Worlds 2-5 coming next: THE SIEGE, MACHINE WAR, FALL OF EARTH, APOLLYON
- Queen's dying signal is now inside UNIT ONE's core — 7-day countdown

### Backend
- New endpoints:
  - `GET /api/v2/story/chapter/{id}` — chapter opener content
  - `GET /api/v2/story/reveal/{id}` — reveal cinematic (currently `world1`)
- Updated `GET /api/v2/story/{level_id}` to include `chapter`, `previously`, `next_teaser` fields
- Gemini system prompt updated for serious-sci-fi + Apollyon lore aware (references only from L7+)

## Iteration 16 — Voice-Over TTS (June 2026)

### Backend (Emergent OpenAI TTS)
- New endpoints:
  - `POST /api/v2/tts/create` — body: {text, speaker}. Cleans text (strips markdown/bullets), generates MP3 via emergentintegrations `OpenAITextToSpeech` (model tts-1). Cached to /tmp/tts_cache keyed by sha256(text|voice|speed). Returns {url, speaker}.
  - `GET /api/v2/tts/{key}.mp3` — serves cached bytes with long cache-control
- Speaker → voice map:
  - `unit_one` → onyx @1.0 (deep authoritative AI)
  - `renn` → coral @1.05 (warm human scientist)
  - `apollyon` → ash @0.88 (cold, articulate, slower)
  - `queen` → shimmer @0.92 (alien)
  - `narrator` → echo @1.0 (calm cinematic)

### Frontend
- New `src/game/voice.ts` helper: `detectSpeaker()` heuristic + `playPanelVoice()` streams TTS via `createAudioPlayer` imperative API + `stopVoice()`
- Every story panel (`/story`) and interlude panel (`/interlude`) now shows a tiny speaker-colored PLAY chip:
  - Volume icon → tap to play; morphs to Stop icon while playing; loading spinner during fetch
  - Speaker label shown next to icon (e.g. "APOLLYON", "DR. RENN")
- Advancing panels (NEXT / SKIP) stops any playing voice
- Speaker chip color-codes: A.I. Unit One cyan · Dr. Renn green · Apollyon red · Hive Queen magenta · Narrator grey

## Iteration 13 (Chess Mode + Resource Pain Economy) — 2026-06
Deep gameplay overhaul making every level significantly harder and more strategic.

### Energy: Deploy + Attack Drain
- Deploying a robot still costs energy (per-robot cost, e.g. Scout 2⚡, Titan 8⚡).
- **NEW:** Each shot a player robot fires drains 0.22⚡ from the shared energy pool. Zero energy → robot misfires.
- Energy regen reduced from 0.5 → 0.4/sec to preserve tension.
- **Lane-lock penalty:** deploying the SAME robot in the SAME lane within 3 sec costs 1.5× energy (encourages lane diversity).

### Rock-Paper-Scissors Matchups
Robot categories: `light` (scout, drone), `heavy` (tank, titan), `ranged` (sniper, striker), `support` (guardian).
Alien categories: `swarm` (crawler), `armored` (brute), `ranged` (spitter), `air` (flyer), `boss` (hive_queen).
Advantage triangle: **ranged > swarm**, **heavy > ranged**, **light > armored**, **air > light**, **swarm > heavy**.
- Advantage: 1.5× damage dealt.
- Disadvantage: 0.7× damage taken.

### Alien Commander AI (counter-deploys)
- After each player deploy, the alien commander MAY spawn a hard-counter alien 3.5–5.5 sec later in the same lane.
- Counter map: light→flyer, heavy→crawler, ranged→brute, support→spitter.
- Cooldown of 8 sec between commander responses to keep it fair.
- On-screen "⚠ COMMANDER RESPONDS" banner with the incoming alien + lane.

### New Alien Abilities (progressive by level)
- **Shielded** (armored L5+, swarm L6+): 60% dmg reduction on first N hits.
- **Dodge** (ranged L3+, air L4+): 20-25% chance to fully negate a hit.
- **Split on death** (swarm L7+): spawns 2 mini crawlers.
- **Resurrect** (armored L9+, boss always): 25-35% chance to revive at 35% HP once.

### Global Difficulty Bump (applies to Normal AND Veteran)
- +35% HP, +25% ATK, +12% speed baseline.
- Veteran stacks another 1.3× on top and doubles wave density.

### Resource Pain Economy 🩸
When aliens hit Earth, they don't just chip HP — they eat *the world's resources*.
- Track 4 resources: **COBALT · NICKEL · IRON · GOLD** (each starts at 100).
- Alien-to-resource mapping (each alien hits a signature resource):
  - Crawler → NICKEL
  - Spitter → COBALT
  - Brute → IRON
  - Flyer → GOLD
  - Hive Queen → IRON (random for core hits)
- Core hit: drains 3–8 units of a random resource + earth_hp.
- Robot hit: drains 1–3 units of the alien's signature resource.
- Depletion cascade: first time a resource hits 0 → Earth loses 20% of max HP + civilian toll message:
  - "COBALT MINES OVERRUN — 40,000 DISPLACED"
  - "NICKEL REFINERY FALLEN — 28,000 DISPLACED"
  - "IRON WORKS OVERRUN — 52,000 DISPLACED"
  - "GOLD RESERVES LOST — MARKETS CRASH"

### Star Bonus Update
- 2⭐ requires either 50%+ Earth HP OR 60%+ average resources.
- 3⭐ requires target time AND no fully-lost resource AND 40%+ average resources.

### UI Additions
- Resource strip below top HUD: 4 compact bars with icons + values, flash red on drain, dim when lost.
- Floating "-N COBALT" damage numbers pop from hit location.
- Counter-deploy banner (pink chess-king icon).
- Deploy toast shows "×1.5 cost" when lane-lock penalty triggers.
