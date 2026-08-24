import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, Archon, Robot, ArchonBattleResult } from "@/src/api";
import { TerminalHeader, HudButton } from "@/src/components/hud";

const MECHANIC_LABELS: Record<string, string> = {
  summon: "SUMMONS DRONES EACH ROUND",
  jam: "SENSOR JAMMING",
  drain: "DRAINS MATERIALS ON HIT",
  reflect: "40% DAMAGE REFLECTED",
};

export default function ArchonsScreen() {
  const router = useRouter();
  const [archons, setArchons] = useState<Archon[]>([]);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArchon, setSelectedArchon] = useState<Archon | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ArchonBattleResult | null>(null);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [s, r] = await Promise.all([api.archonsStatus(id), api.listRobots(id)]);
    setArchons(s.archons);
    setRobots(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const engage = async () => {
    if (!selectedArchon || !selectedRobot) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      const res = await api.archonBattle({ player_id: id, robot_id: selectedRobot, archon_id: selectedArchon.id });
      setResult(res);
      await load();
    } catch (e: any) {
      Alert.alert("BATTLE FAILED", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  // Result screen
  if (result) {
    const { archon, sim, rewards } = result;
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <TerminalHeader
          title="ARCHON // OUTCOME"
          subtitle={archon.name}
          right={
            <Pressable onPress={() => { setResult(null); setSelectedArchon(null); setSelectedRobot(null); }} style={styles.back}>
              <MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.outcomeCard, { borderColor: sim.victory ? colors.success : colors.brandSecondary }]}>
            <MaterialCommunityIcons name={archon.icon as any} size={48} color={archon.color} />
            <Text style={[styles.outcomeTitle, { color: sim.victory ? colors.success : colors.brandSecondary }]}>
              {sim.victory ? "ARCHON DEFEATED" : "DEFENDER LOST"}
            </Text>
            <Text style={styles.narrative}>{archon.narrative}</Text>
          </View>
          {sim.notes.length > 0 && (
            <View style={styles.notesCard}>
              {sim.notes.map((n, i) => <Text key={i} style={styles.noteLine}>◆ {n}</Text>)}
            </View>
          )}
          {sim.material_drain > 0 && (
            <Text style={styles.drainWarn}>! MATERIAL DRAINED: −{sim.material_drain}</Text>
          )}
          {sim.victory && rewards && (
            <View style={styles.rewardsCard}>
              <Text style={styles.rewardsTitle}>▮ REWARDS</Text>
              {Object.entries(rewards).map(([k, v]) =>
                k === "part_unlock" ? (
                  <Text key={k} style={styles.rewardLine}>◆ PART UNLOCKED: {String(v).toUpperCase()}</Text>
                ) : (
                  <Text key={k} style={styles.rewardLine}>+{String(v)} {k.toUpperCase()}</Text>
                )
              )}
            </View>
          )}
          <Text style={styles.section}>ROUND LOG</Text>
          {sim.rounds.map((r) => (
            <View key={r.round} style={styles.roundRow}>
              <Text style={styles.roundNum}>R{r.round}</Text>
              <Text style={styles.roundDmg}>YOU −{r.archon_dmg} HP</Text>
              <Text style={[styles.roundDmg, { color: archon.color }]}>ARCH −{r.player_dmg}</Text>
              {r.reflect > 0 && <Text style={styles.reflect}>↻{r.reflect}</Text>}
            </View>
          ))}
          <View style={{ height: 20 }} />
          <HudButton label="▮ RETURN" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Robot picker mode
  if (selectedArchon) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <TerminalHeader
          title="ARCHON // DEPLOY"
          subtitle={selectedArchon.name}
          right={
            <Pressable onPress={() => setSelectedArchon(null)} style={styles.back}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.brandPrimary} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.archonCard, { borderColor: selectedArchon.color }]}>
            <MaterialCommunityIcons name={selectedArchon.icon as any} size={40} color={selectedArchon.color} />
            <Text style={[styles.archonName, { color: selectedArchon.color }]}>{selectedArchon.name}</Text>
            <Text style={styles.mechanic}>◆ {MECHANIC_LABELS[selectedArchon.mechanic]}</Text>
            <Text style={styles.narrative}>{selectedArchon.narrative}</Text>
            <View style={styles.statsRow}>
              <Stat label="HP" value={selectedArchon.hp} color={selectedArchon.color} />
              <Stat label="ATK" value={selectedArchon.attack} color={colors.brandSecondary} />
              <Stat label="DEF" value={selectedArchon.defense} color={colors.brandPrimary} />
            </View>
          </View>
          <Text style={styles.section}>▮ SELECT ROBOT</Text>
          {robots.length === 0 && <Text style={styles.empty}>No robots. Build in Builder tab.</Text>}
          {robots.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setSelectedRobot(r.id)}
              style={[styles.robotRow, { borderColor: selectedRobot === r.id ? colors.brandPrimary : colors.border }]}
              testID={`archon-robot-${r.id}`}
            >
              <MaterialCommunityIcons name="robot-industrial" size={18} color={colors.onSurface} />
              <View style={{ flex: 1 }}>
                <Text style={styles.robotName}>{r.name}</Text>
                <Text style={styles.robotStats}>GEN {r.generation} • PWR {r.power} • {r.weapon.toUpperCase()}</Text>
              </View>
              {selectedRobot === r.id && <MaterialCommunityIcons name="check-circle" size={18} color={colors.brandPrimary} />}
            </Pressable>
          ))}
          <View style={{ height: 20 }} />
          <HudButton
            label={busy ? "..." : "▮ ENGAGE ARCHON (20 PWR)"}
            variant="danger"
            onPress={engage}
            disabled={!selectedRobot || busy}
            testID="btn-engage-archon"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="DEFENSE // ARCHONS"
        subtitle="Apollyon's four commanders"
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          ◆ Each Archon exhibits a signature mechanic. Defeat all four to unlock the final Apollyon duel with elite parts.
        </Text>
        {archons.map((a) => {
          const locked = !a.unlocked;
          const defeated = a.defeated;
          return (
            <Pressable
              key={a.id}
              onPress={() => !locked && !defeated && setSelectedArchon(a)}
              disabled={locked || defeated}
              style={[
                styles.archonListCard,
                { borderColor: defeated ? colors.success : locked ? colors.border : a.color, opacity: locked ? 0.5 : 1 },
              ]}
              testID={`archon-${a.id}`}
            >
              <View style={styles.archonListHeader}>
                <MaterialCommunityIcons name={a.icon as any} size={26} color={a.color} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.archonListName, { color: a.color }]}>{a.name}</Text>
                  <Text style={styles.mechanicSmall}>◆ {MECHANIC_LABELS[a.mechanic]}</Text>
                </View>
                {defeated ? (
                  <MaterialCommunityIcons name="check-decagram" size={20} color={colors.success} />
                ) : locked ? (
                  <MaterialCommunityIcons name="lock" size={18} color={colors.onSurfaceTertiary} />
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={a.color} />
                )}
              </View>
              <Text style={styles.archonListNarr}>{a.narrative}</Text>
              <View style={styles.gateRow}>
                <Text style={styles.gate}>W ≥ {a.gate_wave}</Text>
                <Text style={styles.gate}>G ≥ {a.gate_gen}</Text>
                {a.reward_unlocked && <Text style={styles.unlock}>◆ UNLOCKED {a.rewards?.part_unlock?.toUpperCase()}</Text>}
              </View>
            </Pressable>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  back: { padding: spacing.xs },
  hint: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: spacing.md, letterSpacing: 0.5 },
  archonListCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surfaceSecondary },
  archonListHeader: { flexDirection: "row", alignItems: "center" },
  archonListName: { fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 1.5 },
  mechanicSmall: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: 10, letterSpacing: 1.2, marginTop: 2 },
  archonListNarr: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 8, lineHeight: 16 },
  gateRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  gate: { fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary, fontSize: 9, letterSpacing: 1, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2 },
  unlock: { fontFamily: fonts.displayBold, color: colors.success, fontSize: 9, letterSpacing: 1, borderWidth: 1, borderColor: colors.success, paddingHorizontal: 6, paddingVertical: 2 },

  archonCard: { borderWidth: 2, borderRadius: radius.md, padding: spacing.md, alignItems: "center", marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary },
  archonName: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, letterSpacing: 2, marginTop: 6 },
  mechanic: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.xs, letterSpacing: 1.5, marginTop: 4 },
  narrative: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, textAlign: "center", marginTop: 8, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  stat: { alignItems: "center", borderWidth: 1, borderColor: colors.border, padding: 6, minWidth: 60 },
  statLabel: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: 9, letterSpacing: 1 },
  statValue: { fontFamily: fonts.displayBold, fontSize: fontSize.lg },

  section: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5, marginBottom: spacing.sm, marginTop: spacing.md },
  empty: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginBottom: spacing.md },
  robotRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  robotName: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm, letterSpacing: 1 },
  robotStats: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },

  outcomeCard: {
    borderWidth: 2, borderRadius: radius.md, padding: spacing.md, alignItems: "center",
    marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary,
  },
  outcomeTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, letterSpacing: 2, marginTop: 6 },
  notesCard: { borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, backgroundColor: "rgba(255,176,32,0.05)" },
  noteLine: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: 3 },
  drainWarn: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.xs, letterSpacing: 1, textAlign: "center", marginBottom: spacing.md },
  rewardsCard: { borderWidth: 1, borderColor: colors.success, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, backgroundColor: "rgba(0,255,102,0.05)" },
  rewardsTitle: { fontFamily: fonts.displayBold, color: colors.success, fontSize: fontSize.sm, letterSpacing: 1.5, marginBottom: 4 },
  rewardLine: { fontFamily: fonts.displayBold, color: colors.success, fontSize: fontSize.xs, marginTop: 2, letterSpacing: 1 },

  roundRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 6,
    marginBottom: 3, backgroundColor: colors.surfaceSecondary,
  },
  roundNum: { fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1, width: 30 },
  roundDmg: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, flex: 1 },
  reflect: { fontFamily: fonts.displayBold, color: "#00E5FF", fontSize: fontSize.xs, letterSpacing: 1 },
});
