import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, V2Config, V2Campaign, V2Level } from "@/src/api";
import { BattleState, initBattle, tick, deployRobot, useAbility as applyAbility, computeStars, Lane } from "@/src/game/engine";

const LANES: Lane[] = ["left", "center", "right"];

export default function BattleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();
  const levelId = Number(params.level || 1);
  const [config, setConfig] = useState<V2Config | null>(null);
  const [camp, setCamp] = useState<V2Campaign | null>(null);
  const [level, setLevel] = useState<V2Level | null>(null);
  const [state, setState] = useState<BattleState | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [rewardShown, setRewardShown] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const paused = useRef(false);

  // Load config & init battle
  useEffect(() => {
    (async () => {
      const id = await storage.getPlayerId();
      if (!id) return;
      const [p, c] = await Promise.all([api.v2Player(id), api.v2Config()]);
      const L = c.levels.find((x) => x.id === levelId) || c.levels[0];
      setConfig(c); setCamp(p.campaign); setLevel(L);
      const deck = (p.campaign.deck && p.campaign.deck.length > 0)
        ? p.campaign.deck
        : p.campaign.unlocked_robots.slice(0, 6);
      const st = initBattle(L, c.robots, c.aliens, c.abilities, deck, p.campaign.robot_levels, p.campaign.commander_ability);
      // Apply commander stage bonus
      const stage = c.stages.find((s) => s.stage === p.campaign.commander_stage);
      if (stage) {
        // Bonus applied at spawn via robot_levels multiplier for HP — approximate:
        st.earth_max_hp = Math.round(st.earth_max_hp * (1 + stage.hp_bonus / 100));
        st.earth_hp = st.earth_max_hp;
      }
      setState(st);
    })();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [levelId]);

  // Game loop
  useEffect(() => {
    if (!state || !level) return;
    if (state.outcome) return;
    const loop = (ts: number) => {
      if (paused.current) { rafRef.current = requestAnimationFrame(loop); return; }
      const last = lastTsRef.current || ts;
      const dt = Math.min(0.08, (ts - last) / 1000);
      lastTsRef.current = ts;
      const newState = { ...tick({ ...state, entities: state.entities.map((e) => ({ ...e })) }, level, dt) };
      setState(newState);
      if (!newState.outcome) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.time, level, state?.outcome]);

  // Handle outcome — report to server once
  useEffect(() => {
    (async () => {
      if (!state || !state.outcome || !level || !camp || rewardShown) return;
      setRewardShown(true);
      const id = await storage.getPlayerId();
      if (!id) return;
      const stars = computeStars(state, level);
      try {
        const res = await api.v2BattleComplete({
          player_id: id,
          level_id: level.id,
          victory: state.outcome === "win",
          stars,
          time_taken_sec: state.time,
          core_hp_remaining_pct: (state.earth_hp / state.earth_max_hp) * 100,
        });
        Alert.alert(
          state.outcome === "win" ? "VICTORY" : "DEFEAT",
          state.outcome === "win"
            ? `⭐ ${stars}/3\n+${res.parts_awarded} PARTS${res.unlocked_robot ? `\n◆ UNLOCKED: ${res.unlocked_robot.toUpperCase()}` : ""}`
            : "Earth core destroyed. Retry?",
          [
            { text: "MAP", onPress: () => router.replace("/(tabs)/fleet") },
            { text: state.outcome === "win" ? "NEXT" : "RETRY", onPress: () => {
              const nextId = state.outcome === "win" ? Math.min(level.id + 1, 10) : level.id;
              router.replace(`/battle?level=${nextId}`);
            } },
          ]
        );
      } catch (e: any) {
        Alert.alert("SYNC FAILED", String(e.message));
      }
    })();
  }, [state?.outcome, camp, level, router, rewardShown, state]);

  if (!state || !level || !config || !camp) {
    return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const deployAt = (lane: Lane) => {
    if (!selectedRobot) return;
    const newState = { ...state, entities: state.entities.map((e) => ({ ...e })) };
    deployRobot(newState, selectedRobot, lane);
    setState(newState);
  };

  const triggerAbility = () => {
    if (!state.ability || state.ability_charge < 1) return;
    const ns = applyAbility({ ...state, entities: state.entities.map((e) => ({ ...e })) });
    setState({ ...ns });
  };

  const deck = camp.deck.length > 0 ? camp.deck : camp.unlocked_robots.slice(0, 6);

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

      {/* Battlefield */}
      <View style={styles.field}>
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

        {/* Entities */}
        {state.entities.map((e) => {
          const laneIdx = e.lane === "left" ? 0 : e.lane === "center" ? 1 : 2;
          return (
            <View
              key={e.id}
              style={[
                styles.entity,
                {
                  left: `${laneIdx * 33.3 + 16.6}%`,
                  bottom: `${e.y}%`,
                  transform: [{ translateX: -e.size / 2 }, { translateY: e.size / 2 }],
                  width: e.size, height: e.size,
                  backgroundColor: e.color,
                  borderColor: e.side === "player" ? colors.brandPrimary : colors.brandSecondary,
                  borderWidth: 2,
                  borderRadius: e.kind === "air" ? e.size / 2 : 2,
                  opacity: e.stun > 0 ? 0.5 : 1,
                },
              ]}
            >
              <View style={styles.entityHp}>
                <View style={[styles.entityHpFill, { width: `${(e.hp / e.max_hp) * 100}%`, backgroundColor: e.side === "player" ? colors.success : colors.brandSecondary }]} />
              </View>
            </View>
          );
        })}

        {/* Earth base */}
        <View style={styles.earthBase}>
          <MaterialCommunityIcons name="earth" size={40} color={colors.brandPrimary} />
        </View>
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
});
