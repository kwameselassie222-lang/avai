import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, V2Config, V2Campaign, V2Level } from "@/src/api";
import {
  BattleState, initBattle, tick, deployRobot, useAbility as applyAbility,
  computeStars, Lane, drainSounds, SoundEvent,
} from "@/src/game/engine";

const LANES: Lane[] = ["left", "center", "right"];

// Sound assets
const SFX = {
  deploy: require("../assets/sfx/deploy.wav"),
  hit: require("../assets/sfx/hit.wav"),
  explode: require("../assets/sfx/explode.wav"),
  ability: require("../assets/sfx/ability.wav"),
  win: require("../assets/sfx/win.wav"),
  lose: require("../assets/sfx/lose.wav"),
  combo: require("../assets/sfx/combo.wav"),
  boss: require("../assets/sfx/boss.wav"),
};
const BG_LOOP = require("../assets/sfx/bg_loop.wav");

export default function BattleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();
  const levelId = Number(params.level || 1);
  const [config, setConfig] = useState<V2Config | null>(null);
  const [camp, setCamp] = useState<V2Campaign | null>(null);
  const [level, setLevel] = useState<V2Level | null>(null);
  const [ready, setReady] = useState(false);
  // Frame counter used purely to force re-renders — the source of truth lives in stateRef
  const [, forceRender] = useState(0);
  const stateRef = useRef<BattleState | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [rewardShown, setRewardShown] = useState(false);
  const [result, setResult] = useState<{
    victory: boolean; stars: number; parts: number; unlocked: string | null;
  } | null>(null);
  const [starsShown, setStarsShown] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const paused = useRef(false);

  // ---- Audio players (loaded once) ----
  const bgPlayer = useAudioPlayer(BG_LOOP);
  const deployP = useAudioPlayer(SFX.deploy);
  const hitP = useAudioPlayer(SFX.hit);
  const explodeP = useAudioPlayer(SFX.explode);
  const abilityP = useAudioPlayer(SFX.ability);
  const winP = useAudioPlayer(SFX.win);
  const loseP = useAudioPlayer(SFX.lose);
  const comboP = useAudioPlayer(SFX.combo);
  const bossP = useAudioPlayer(SFX.boss);
  const soundsRef = useRef<Record<SoundEvent, ReturnType<typeof useAudioPlayer>>>({
    deploy: deployP, hit: hitP, explode: explodeP, ability: abilityP,
    win: winP, lose: loseP, combo: comboP, boss: bossP,
  });
  soundsRef.current = {
    deploy: deployP, hit: hitP, explode: explodeP, ability: abilityP,
    win: winP, lose: loseP, combo: comboP, boss: bossP,
  };

  // Throttling for hit sfx so we don't spam the audio engine
  const lastHitAt = useRef<number>(0);

  // Configure audio mode + start bg loop once state is loaded
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      bgPlayer.loop = true;
      bgPlayer.volume = 0.35;
      bgPlayer.play();
    } catch {}
    return () => {
      try { bgPlayer.pause(); } catch {}
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const playSfx = (kind: SoundEvent) => {
    const p = soundsRef.current[kind];
    if (!p) return;
    try {
      if (kind === "hit") {
        // throttle to at most every 40ms
        const now = Date.now();
        if (now - lastHitAt.current < 40) return;
        lastHitAt.current = now;
        p.volume = 0.35;
      } else if (kind === "deploy") { p.volume = 0.55; }
      else if (kind === "explode") { p.volume = 0.7; }
      else if (kind === "ability") { p.volume = 0.7; }
      else if (kind === "combo") { p.volume = 0.75; try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); } catch {} }
      else if (kind === "boss") { p.volume = 0.85; try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); } catch {} }
      else { p.volume = 0.8; }
      p.seekTo(0);
      p.play();
    } catch {}
  };

  // Load config & init battle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await storage.getPlayerId();
      if (!id) return;
      const [p, c] = await Promise.all([api.v2Player(id), api.v2Config()]);
      if (cancelled) return;
      const L = c.levels.find((x) => x.id === levelId) || c.levels[0];
      setConfig(c); setCamp(p.campaign); setLevel(L);
      const deck = (p.campaign.deck && p.campaign.deck.length > 0)
        ? p.campaign.deck
        : p.campaign.unlocked_robots.slice(0, 6);
      const st = initBattle(L, c.robots, c.aliens, c.abilities, deck, p.campaign.robot_levels, p.campaign.commander_ability);
      const stage = c.stages.find((s) => s.stage === p.campaign.commander_stage);
      if (stage) {
        st.earth_max_hp = Math.round(st.earth_max_hp * (1 + stage.hp_bonus / 100));
        st.earth_hp = st.earth_max_hp;
      }
      stateRef.current = st;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [levelId]);

  // Game loop — single stable RAF driven only by level/ready. Reads/writes stateRef.
  useEffect(() => {
    if (!ready || !level) return;
    lastTsRef.current = 0;
    const loop = (ts: number) => {
      if (paused.current) { rafRef.current = requestAnimationFrame(loop); return; }
      const st = stateRef.current;
      if (!st || st.outcome) { rafRef.current = null; return; }
      const last = lastTsRef.current || ts;
      const dt = Math.min(0.08, (ts - last) / 1000);
      lastTsRef.current = ts;
      tick(st, level, dt); // mutates in place
      // Drain sounds
      const toPlay = drainSounds(st);
      for (const s of toPlay) playSfx(s);
      // Force React re-render for this frame
      forceRender((n) => (n + 1) & 0xffff);
      if (!st.outcome) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [ready, level]);

  // Handle outcome — report to server once. Watches stateRef via forceRender frame tick.
  const outcome = stateRef.current?.outcome || null;
  useEffect(() => {
    (async () => {
      const st = stateRef.current;
      if (!st || !st.outcome || !level || !camp || rewardShown) return;
      setRewardShown(true);
      try { bgPlayer.pause(); } catch {}
      try {
        Haptics.notificationAsync(st.outcome === "win"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error).catch(() => {});
      } catch {}
      const id = await storage.getPlayerId();
      if (!id) return;
      const stars = computeStars(st, level);
      try {
        const res = await api.v2BattleComplete({
          player_id: id,
          level_id: level.id,
          victory: st.outcome === "win",
          stars,
          time_taken_sec: st.time,
          core_hp_remaining_pct: (st.earth_hp / st.earth_max_hp) * 100,
        });
        setResult({
          victory: st.outcome === "win",
          stars,
          parts: res.parts_awarded || 0,
          unlocked: res.unlocked_robot || null,
        });
        if (st.outcome === "win" && stars > 0) {
          for (let i = 1; i <= stars; i++) {
            setTimeout(() => setStarsShown(i), 350 * i);
          }
        }
      } catch (e: any) {
        Alert.alert("SYNC FAILED", String(e.message));
      }
    })();
  }, [outcome, camp, level, router, rewardShown, bgPlayer]);

  if (!ready || !level || !config || !camp || !stateRef.current) {
    return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const state = stateRef.current;

  const deployAt = (lane: Lane) => {
    if (!selectedRobot || !stateRef.current) return;
    const ok = deployRobot(stateRef.current, selectedRobot, lane);
    if (ok) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } catch {}
      const toPlay = drainSounds(stateRef.current);
      for (const s of toPlay) playSfx(s);
      forceRender((n) => (n + 1) & 0xffff);
    }
  };

  const triggerAbility = () => {
    if (!stateRef.current || !stateRef.current.ability || stateRef.current.ability_charge < 1) return;
    applyAbility(stateRef.current);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); } catch {}
    const toPlay = drainSounds(stateRef.current);
    for (const s of toPlay) playSfx(s);
    forceRender((n) => (n + 1) & 0xffff);
  };

  const deck = camp.deck.length > 0 ? camp.deck : camp.unlocked_robots.slice(0, 6);

  // Screen shake offset
  const shake = state.screen_shake;
  const shakeX = shake > 0 ? Math.sin(state.time * 60) * 6 * shake : 0;
  const shakeY = shake > 0 ? Math.cos(state.time * 55) * 4 * shake : 0;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Top HUD */}
      <View style={styles.topHud}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} />
        </Pressable>
        <View style={styles.hpWrap}>
          <Text style={styles.hpLabel}>ALIEN CORE</Text>
          <View style={styles.hpBar}>
            <View style={[styles.hpFill, { width: `${(state.alien_hp / state.alien_max_hp) * 100}%`, backgroundColor: colors.brandSecondary }]} />
          </View>
        </View>
        <Text style={styles.timer}>{Math.floor(state.time)}s</Text>
      </View>

      {/* Battlefield with shake */}
      <View style={[styles.field, { transform: [{ translateX: shakeX }, { translateY: shakeY }] }]}>
        {/* Alien core */}
        <View style={styles.alienBase}>
          <MaterialCommunityIcons name="alien" size={40} color={colors.brandSecondary} />
        </View>
        {/* Lane dividers */}
        <View style={[styles.laneDivider, { left: "33.3%" }]} />
        <View style={[styles.laneDivider, { left: "66.6%" }]} />

        {/* Deploy zones (bottom half only) */}
        {selectedRobot && LANES.map((lane, i) => (
          <Pressable
            key={lane}
            onPress={() => deployAt(lane)}
            style={[styles.deployZone, { left: `${i * 33.3}%` }]}
            testID={`deploy-${lane}`}
          >
            <Text style={styles.deployText}>TAP TO DEPLOY</Text>
          </Pressable>
        ))}

        {/* Explosion & hit particles */}
        {state.particles.map((p) => {
          const laneIdx = p.lane === "left" ? 0 : p.lane === "center" ? 1 : 2;
          const age = Math.max(0, state.time - p.born_at);
          const prog = Math.min(1, age / p.ttl);
          const scale = p.kind === "explode" ? 0.4 + prog * 1.8 : 0.6 + prog * 1.2;
          const opacity = 1 - prog;
          return (
            <View
              key={p.id}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: `${laneIdx * 33.3 + 16.6}%`,
                bottom: `${p.y}%`,
                width: p.size,
                height: p.size,
                transform: [{ translateX: -p.size / 2 }, { translateY: p.size / 2 }, { scale }],
                borderRadius: p.size,
                borderWidth: p.kind === "explode" ? 3 : 2,
                borderColor: p.color,
                backgroundColor: p.kind === "explode" ? `${p.color}22` : `${p.color}66`,
                opacity,
              }}
            />
          );
        })}

        {/* Entities */}
        {state.entities.map((e) => {
          const laneIdx = e.lane === "left" ? 0 : e.lane === "center" ? 1 : 2;
          // landing scale-in over 0.3s
          const spawnAge = state.time - e.spawn_time;
          const landScale = spawnAge < 0.3 ? 0.4 + (spawnAge / 0.3) * 0.6 : 1;
          // hit flash overlay if last hit < 0.15s
          const hitAge = state.time - e.last_hit_at;
          const flash = hitAge >= 0 && hitAge < 0.15;
          return (
            <View
              key={e.id}
              style={[
                styles.entity,
                {
                  left: `${laneIdx * 33.3 + 16.6}%`,
                  bottom: `${e.y}%`,
                  transform: [{ translateX: -e.size / 2 }, { translateY: e.size / 2 }, { scale: landScale }],
                  width: e.size, height: e.size,
                  backgroundColor: flash ? "#FFFFFF" : e.color,
                  borderColor: flash ? "#FFFFFF" : (e.side === "player" ? colors.brandPrimary : colors.brandSecondary),
                  borderWidth: 2,
                  borderRadius: e.kind === "air" ? e.size / 2 : 2,
                  opacity: e.stun > 0 ? 0.5 : 1,
                  shadowColor: e.color,
                  shadowOpacity: flash ? 1 : 0.6,
                  shadowRadius: flash ? 8 : 3,
                },
              ]}
            >
              <View style={styles.entityHp}>
                <View style={[styles.entityHpFill, { width: `${(e.hp / e.max_hp) * 100}%`, backgroundColor: e.side === "player" ? colors.success : colors.brandSecondary }]} />
              </View>
              {/* Stun ring */}
              {e.stun > 0 && (
                <View pointerEvents="none" style={{
                  position: "absolute", left: -4, top: -4, right: -4, bottom: -4,
                  borderRadius: e.size, borderWidth: 2, borderColor: "#88CCFF",
                  opacity: 0.7,
                }} />
              )}
            </View>
          );
        })}

        {/* Earth base */}
        <View style={styles.earthBase}>
          <MaterialCommunityIcons name="earth" size={40} color={colors.brandPrimary} />
        </View>

        {/* Combo banner (fades out after 1.4s) */}
        {state.combo && state.time - state.combo.time < 1.4 && (
          <View pointerEvents="none" style={[
            styles.comboBanner,
            { opacity: Math.max(0, 1 - (state.time - state.combo.time) / 1.4) },
          ]}>
            <MaterialCommunityIcons name="fire" size={22} color="#FFEE55" />
            <Text style={styles.comboText}>COMBO x{state.combo.count}</Text>
            <Text style={styles.comboSub}>+{2}⚡  +30% ATK</Text>
          </View>
        )}

        {/* Boss cinematic (2s slam-in) */}
        {state.boss_intro_at !== null && state.time - state.boss_intro_at < 2.0 && (() => {
          const age = state.time - (state.boss_intro_at || 0);
          const scale = age < 0.35
            ? 0.2 + (age / 0.35) * 1.6   // slam-in
            : age < 1.4
              ? 1.8 - (age - 0.35) * 0.6  // settle
              : 1.2 * (1 - (age - 1.4) / 0.6); // fade
          const opacity = age > 1.4 ? Math.max(0, 1 - (age - 1.4) / 0.6) : 1;
          return (
            <View pointerEvents="none" style={styles.bossOverlay}>
              <View style={{ transform: [{ scale }], opacity, alignItems: "center" }}>
                <MaterialCommunityIcons name="alien" size={90} color={colors.brandSecondary} />
                <Text style={styles.bossTitle}>HIVE QUEEN</Text>
                <Text style={styles.bossSub}>AWAKENED</Text>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Bottom HUD */}
      <View style={styles.bottomHud}>
        <View style={styles.hpWrap}>
          <View style={styles.hpBar}>
            <View style={[styles.hpFill, { width: `${(state.earth_hp / state.earth_max_hp) * 100}%`, backgroundColor: colors.success }]} />
          </View>
          <Text style={styles.hpLabelBottom}>EARTH CORE</Text>
        </View>

        <View style={styles.energyRow}>
          <MaterialCommunityIcons name="lightning-bolt" size={16} color={colors.warning} />
          <Text style={styles.energyText}>{Math.floor(state.energy)}/{state.energy_max}</Text>
          <Pressable
            onPress={triggerAbility}
            disabled={state.ability_charge < 1}
            style={[styles.abilityBtn, { borderColor: state.ability_charge >= 1 ? colors.warning : colors.border, opacity: state.ability_charge >= 1 ? 1 : 0.5 }]}
            testID="btn-ability"
          >
            <MaterialCommunityIcons name="flash" size={12} color={colors.warning} />
            <Text style={styles.abilityText}>{state.ability?.name || "—"}</Text>
            <View style={styles.chargeBar}>
              <View style={[styles.chargeFill, { width: `${state.ability_charge * 100}%` }]} />
            </View>
          </Pressable>
        </View>

        <View style={styles.deck}>
          {deck.map((rid) => {
            const r = config.robots.find((x) => x.id === rid);
            if (!r) return null;
            const canAfford = state.energy >= r.cost;
            const selected = selectedRobot === rid;
            return (
              <Pressable
                key={rid}
                onPress={() => setSelectedRobot(selected ? null : rid)}
                disabled={!canAfford}
                style={[
                  styles.card,
                  { borderColor: selected ? colors.brandPrimary : colors.borderStrong, backgroundColor: canAfford ? colors.surfaceSecondary : colors.surfaceTertiary, opacity: canAfford ? 1 : 0.5 },
                ]}
                testID={`card-${rid}`}
              >
                <View style={styles.cardCost}><Text style={styles.costText}>{r.cost}⚡</Text></View>
                <MaterialCommunityIcons name={r.kind === "air" ? "quadcopter" : "robot"} size={22} color={selected ? colors.brandPrimary : colors.onSurface} />
                <Text style={[styles.cardName, { color: selected ? colors.brandPrimary : colors.onSurface }]}>{r.name.split(" ")[0]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Victory / Defeat overlay */}
      {result && level && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.overlay}>
            <View style={[
              styles.overlayCard,
              { borderColor: result.victory ? colors.brandPrimary : colors.brandSecondary },
            ]}>
              <View style={styles.overlayHeader}>
                <MaterialCommunityIcons
                  name={result.victory ? "trophy-variant" : "skull-crossbones"}
                  size={44}
                  color={result.victory ? colors.brandPrimary : colors.brandSecondary}
                />
                <Text style={[
                  styles.overlayTitle,
                  { color: result.victory ? colors.brandPrimary : colors.brandSecondary },
                ]}>
                  {result.victory ? "VICTORY" : "DEFEAT"}
                </Text>
              </View>

              <Text style={styles.overlaySub}>{level.name.toUpperCase()}</Text>

              {result.victory ? (
                <>
                  <View style={styles.starRow}>
                    {[1, 2, 3].map((n) => (
                      <View key={n} style={styles.starWrap}>
                        <MaterialCommunityIcons
                          name={n <= starsShown ? "star" : "star-outline"}
                          size={n <= starsShown ? 48 : 36}
                          color={n <= starsShown ? colors.warning : colors.border}
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.rewardRow}>
                    <MaterialCommunityIcons name="cog" size={16} color={colors.warning} />
                    <Text style={styles.rewardText}>+{result.parts} PARTS</Text>
                  </View>
                  {result.unlocked && (
                    <View style={[styles.unlockBox, { borderColor: colors.brandPrimary }]}>
                      <Text style={styles.unlockLabel}>◆ ROBOT UNLOCKED</Text>
                      <Text style={styles.unlockName}>{result.unlocked.toUpperCase()}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.defeatMsg}>Earth core destroyed.{"\n"}The invasion continues.</Text>
              )}

              <View style={styles.overlayActions}>
                <Pressable
                  onPress={() => router.replace("/(tabs)/fleet")}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                >
                  <MaterialCommunityIcons name="map" size={16} color={colors.onSurface} />
                  <Text style={styles.actionText}>MAP</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    // Special: L10 victory → epilogue
                    if (result.victory && level.id === 10) {
                      setRewardShown(false);
                      setResult(null);
                      setStarsShown(0);
                      stateRef.current = null;
                      setReady(false);
                      setSelectedRobot(null);
                      router.replace("/epilogue");
                      return;
                    }
                    const nextId = result.victory ? Math.min(level.id + 1, 10) : level.id;
                    setRewardShown(false);
                    setResult(null);
                    setStarsShown(0);
                    stateRef.current = null;
                    setReady(false);
                    setSelectedRobot(null);
                    // Victory → route through /story so a new level gets its intro
                    if (result.victory) {
                      router.replace(`/story?level=${nextId}`);
                    } else {
                      router.replace(`/battle?level=${nextId}`);
                    }
                  }}
                  style={[styles.actionBtn, {
                    borderColor: result.victory ? colors.brandPrimary : colors.brandSecondary,
                    backgroundColor: result.victory ? "rgba(0,229,255,0.15)" : "rgba(255,51,102,0.15)",
                  }]}
                >
                  <MaterialCommunityIcons
                    name={result.victory ? "arrow-right-bold" : "refresh"}
                    size={16}
                    color={result.victory ? colors.brandPrimary : colors.brandSecondary}
                  />
                  <Text style={[styles.actionText, {
                    color: result.victory ? colors.brandPrimary : colors.brandSecondary,
                  }]}>
                    {result.victory ? (level.id === 10 ? "EPILOGUE" : "NEXT") : "RETRY"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050810" },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  topHud: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  iconBtn: { padding: 4 },
  hpWrap: { flex: 1 },
  hpLabel: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  hpLabelBottom: { fontFamily: fonts.displayBold, color: colors.success, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  hpBar: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 2, overflow: "hidden" },
  hpFill: { height: 6 },
  timer: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm, letterSpacing: 1 },
  field: {
    flex: 1,
    backgroundColor: "#0A0F1F",
    position: "relative",
    overflow: "hidden",
  },
  alienBase: {
    position: "absolute", top: 8, left: "50%", transform: [{ translateX: -20 }],
    alignItems: "center", justifyContent: "center",
    width: 60, height: 60, borderWidth: 2, borderColor: colors.brandSecondary,
    borderRadius: 30, backgroundColor: "rgba(255,51,102,0.1)",
  },
  earthBase: {
    position: "absolute", bottom: 8, left: "50%", transform: [{ translateX: -20 }],
    alignItems: "center", justifyContent: "center",
    width: 60, height: 60, borderWidth: 2, borderColor: colors.brandPrimary,
    borderRadius: 30, backgroundColor: "rgba(0,229,255,0.1)",
  },
  laneDivider: {
    position: "absolute", top: 0, bottom: 0, width: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  deployZone: {
    position: "absolute", bottom: 0, height: "45%", width: "33.3%",
    borderWidth: 1, borderColor: "rgba(0,229,255,0.3)", borderStyle: "dashed",
    alignItems: "center", justifyContent: "flex-end", paddingBottom: 70,
    backgroundColor: "rgba(0,229,255,0.04)",
  },
  deployText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: 10, letterSpacing: 1.5 },
  entity: { position: "absolute" },
  entityHp: { position: "absolute", top: -6, left: 0, right: 0, height: 2, backgroundColor: "rgba(0,0,0,0.6)" },
  entityHpFill: { height: 2 },

  bottomHud: {
    padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderStrong, backgroundColor: colors.surface,
  },
  energyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 6 },
  energyText: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.sm, letterSpacing: 1 },
  abilityBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md,
  },
  abilityText: { flex: 1, fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: 10, letterSpacing: 1 },
  chargeBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: colors.surfaceTertiary },
  chargeFill: { height: 2, backgroundColor: colors.warning },
  deck: { flexDirection: "row", gap: 4, justifyContent: "center" },
  card: {
    flex: 1, borderWidth: 1, padding: 4, alignItems: "center", borderRadius: radius.md,
    minHeight: 60, justifyContent: "center", position: "relative",
  },
  cardCost: {
    position: "absolute", top: 2, right: 2,
    backgroundColor: "rgba(255,176,32,0.2)", paddingHorizontal: 3, borderRadius: 2,
  },
  costText: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: 9, letterSpacing: 0.5 },
  cardName: { fontFamily: fonts.displayBold, fontSize: 9, letterSpacing: 1, marginTop: 2 },

  // Overlay
  overlay: {
    flex: 1, backgroundColor: "rgba(5,8,16,0.92)",
    alignItems: "center", justifyContent: "center", padding: spacing.xl,
  },
  overlayCard: {
    width: "100%", maxWidth: 360, borderWidth: 2, borderRadius: radius.md,
    backgroundColor: colors.surface, padding: spacing.xl, alignItems: "center",
    shadowColor: colors.brandPrimary, shadowOpacity: 0.4, shadowRadius: 16,
  },
  overlayHeader: {
    alignItems: "center", marginBottom: spacing.md,
  },
  overlayTitle: {
    fontFamily: fonts.displayBold, fontSize: fontSize.xxxl, letterSpacing: 6,
    marginTop: spacing.sm,
  },
  overlaySub: {
    fontFamily: fonts.mono, color: colors.onSurfaceSecondary, fontSize: fontSize.sm,
    letterSpacing: 1, marginBottom: spacing.lg, textAlign: "center",
  },
  starRow: {
    flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg, alignItems: "center",
  },
  starWrap: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  rewardRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.warning,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, marginBottom: spacing.md,
    backgroundColor: "rgba(255,176,32,0.08)",
  },
  rewardText: {
    fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.base, letterSpacing: 1.5,
  },
  unlockBox: {
    borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, marginBottom: spacing.md, alignItems: "center",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  unlockLabel: {
    fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: 10, letterSpacing: 2,
  },
  unlockName: {
    fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.lg, letterSpacing: 3, marginTop: 2,
  },
  defeatMsg: {
    fontFamily: fonts.body, color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm, textAlign: "center", marginBottom: spacing.lg, lineHeight: 20,
  },
  overlayActions: {
    flexDirection: "row", gap: spacing.md, width: "100%", marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, paddingVertical: spacing.md, borderRadius: radius.md,
  },
  actionText: {
    fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm, letterSpacing: 2,
  },

  // Combo banner
  comboBanner: {
    position: "absolute", top: "45%", left: "50%",
    transform: [{ translateX: -80 }, { translateY: -30 }],
    width: 160, alignItems: "center", justifyContent: "center",
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: "rgba(255,238,85,0.15)",
    borderWidth: 2, borderColor: "#FFEE55", borderRadius: radius.md,
  },
  comboText: {
    fontFamily: fonts.displayBold, color: "#FFEE55", fontSize: fontSize.lg,
    letterSpacing: 3, marginTop: 2,
  },
  comboSub: {
    fontFamily: fonts.displayBold, color: colors.warning, fontSize: 10, letterSpacing: 2, marginTop: 2,
  },

  // Boss overlay
  bossOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,0,10,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  bossTitle: {
    fontFamily: fonts.displayBold, color: colors.brandSecondary,
    fontSize: fontSize.xxxl, letterSpacing: 8, marginTop: spacing.sm,
    textShadowColor: colors.brandSecondary, textShadowRadius: 12,
  },
  bossSub: {
    fontFamily: fonts.displayBold, color: colors.onSurface,
    fontSize: fontSize.lg, letterSpacing: 6, marginTop: 4,
  },
});
