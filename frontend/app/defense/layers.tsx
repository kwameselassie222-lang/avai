import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, DefenseState, LayerId, Robot } from "@/src/api";
import { LAYER_META, LAYER_ORDER } from "@/src/defense-meta";
import { TerminalHeader } from "@/src/components/hud";

const ASSIGNABLE_LAYERS: LayerId[] = ["deep_space", "orbital", "atmosphere", "ground"];

export default function LayersScreen() {
  const router = useRouter();
  const [defense, setDefense] = useState<DefenseState | null>(null);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [d, r] = await Promise.all([api.defenseState(id), api.listRobots(id)]);
    setDefense(d);
    setRobots(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignedIds = new Set<string>();
  if (defense) {
    LAYER_ORDER.forEach((lid) => {
      (defense.layers?.[lid]?.assigned_robots || []).forEach((r) => assignedIds.add(r));
    });
  }

  const unassigned = robots.filter((r) => !assignedIds.has(r.id));

  const assign = async (layerId: LayerId) => {
    if (!selectedRobot) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      await api.defenseAssign({ player_id: id, robot_id: selectedRobot, layer_id: layerId });
      setSelectedRobot(null);
      await load();
    } catch (e: any) {
      Alert.alert("ASSIGN FAILED", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (robotId: string) => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      await api.defenseUnassign({ player_id: id, robot_id: robotId });
      await load();
    } catch (e: any) {
      Alert.alert("UNASSIGN FAILED", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const repair = async (layerId: LayerId) => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      const res = await api.defenseRepair({ player_id: id, layer_id: layerId });
      await load();
      Alert.alert("REPAIR COMPLETE", `+${res.repaired || 0} HP restored.`);
    } catch (e: any) {
      Alert.alert("REPAIR FAILED", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !defense) {
    return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const findRobot = (rid: string) => robots.find((r) => r.id === rid);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="DEFENSE // LAYER ASSIGN"
        subtitle={`${robots.length} ROBOTS • ${assignedIds.size} DEPLOYED`}
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          {selectedRobot
            ? "◆ Tap a layer to assign the selected robot."
            : "◆ Select a robot below, then choose a defense layer."}
        </Text>

        {/* LAYERS */}
        {ASSIGNABLE_LAYERS.map((lid) => {
          const L = defense.layers?.[lid];
          const meta = LAYER_META[lid];
          if (!L) return null;
          const hpPct = (L.hp / L.max_hp) * 100;
          const active = !!selectedRobot;
          return (
            <Pressable
              key={lid}
              onPress={() => active && assign(lid)}
              disabled={!active || busy}
              style={[
                styles.layerCard,
                { borderColor: active ? colors.brandPrimary : meta.color, opacity: busy ? 0.5 : 1 },
              ]}
              testID={`layer-${lid}`}
            >
              <View style={styles.layerHeader}>
                <MaterialCommunityIcons name={meta.icon as any} size={18} color={meta.color} />
                <Text style={[styles.layerName, { color: meta.color }]}>{meta.name.toUpperCase()}</Text>
                <Text style={styles.hp}>{L.hp}/{L.max_hp}</Text>
              </View>
              <View style={styles.bar}><View style={[styles.fill, { width: `${hpPct}%`, backgroundColor: meta.color }]} /></View>
              <View style={styles.assignedList}>
                {L.assigned_robots.length === 0 && (
                  <Text style={styles.emptyText}>{"// no robots assigned"}</Text>
                )}
                {L.assigned_robots.map((rid) => {
                  const r = findRobot(rid);
                  if (!r) return null;
                  return (
                    <Pressable key={rid} onPress={() => unassign(rid)} style={styles.assignedChip}>
                      <MaterialCommunityIcons name="robot-industrial" size={12} color={colors.onSurface} />
                      <Text style={styles.chipText}>{r.name}</Text>
                      <MaterialCommunityIcons name="close" size={10} color={colors.onSurfaceTertiary} />
                    </Pressable>
                  );
                })}
              </View>
              {hpPct < 100 && (
                <Pressable onPress={() => repair(lid)} disabled={busy} style={styles.repairBtn} testID={`repair-${lid}`}>
                  <MaterialCommunityIcons name="wrench" size={12} color={colors.warning} />
                  <Text style={styles.repairText}>REPAIR</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}

        <View style={styles.sep} />

        {/* UNASSIGNED ROBOTS */}
        <Text style={styles.section}>▮ AVAILABLE ROBOTS ({unassigned.length})</Text>
        {unassigned.length === 0 && (
          <Text style={styles.empty}>All robots assigned. Build more in the Builder.</Text>
        )}
        {unassigned.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setSelectedRobot(selectedRobot === r.id ? null : r.id)}
            style={[styles.robotRow, { borderColor: selectedRobot === r.id ? colors.brandPrimary : colors.border }]}
            testID={`robot-${r.id}`}
          >
            <MaterialCommunityIcons name="robot-industrial" size={18} color={selectedRobot === r.id ? colors.brandPrimary : colors.onSurface} />
            <View style={{ flex: 1 }}>
              <Text style={styles.robotName}>{r.name}</Text>
              <Text style={styles.robotStats}>GEN {r.generation} • PWR {r.power} • {r.weapon.toUpperCase()}</Text>
            </View>
            {selectedRobot === r.id && <MaterialCommunityIcons name="check-circle" size={18} color={colors.brandPrimary} />}
          </Pressable>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  back: { padding: spacing.xs },
  hint: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  layerCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  layerHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  layerName: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1.2, flex: 1 },
  hp: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1 },
  bar: { height: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: 4 },
  fill: { height: 3 },
  assignedList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  assignedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  chipText: { fontFamily: fonts.body, color: colors.onSurface, fontSize: fontSize.xs, letterSpacing: 0.5 },
  emptyText: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs },
  repairBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-end", marginTop: 6,
    borderWidth: 1, borderColor: colors.warning,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.md,
  },
  repairText: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.xs, letterSpacing: 1 },
  sep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  section: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5, marginBottom: spacing.sm },
  empty: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginBottom: spacing.md },
  robotRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  robotName: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm, letterSpacing: 1 },
  robotStats: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
