import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, DefenseState, NetworkNode, Player } from "@/src/api";
import { TerminalHeader } from "@/src/components/hud";

export default function NetworkScreen() {
  const router = useRouter();
  const [defense, setDefense] = useState<DefenseState | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [p, d, cfg] = await Promise.all([
      api.getPlayer(id),
      api.defenseState(id),
      api.defenseConfig(),
    ]);
    setPlayer(p);
    setDefense(d);
    setNodes(cfg.network_nodes);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const build = async (nodeId: string) => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(nodeId);
      await api.networkBuild({ player_id: id, node_id: nodeId });
      await load();
    } catch (e: any) {
      Alert.alert("BUILD FAILED", String(e.message || e));
    } finally {
      setBusy(null);
    }
  };

  if (loading || !defense || !player) {
    return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const built = new Set(defense.network_progress || []);
  const completePct = built.size / nodes.length;

  const canAfford = (node: NetworkNode) => {
    const res = player.resources as any;
    return Object.entries(node.cost).every(([k, v]) => (res[k] || 0) >= (v || 0));
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="DEFENSE // PLANETARY NETWORK"
        subtitle={`${built.size}/${nodes.length} NODES • ${(completePct * 100).toFixed(0)}%`}
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.progressCard}>
          <View style={styles.progRow}>
            <MaterialCommunityIcons name="hexagon-multiple" size={18} color={colors.warning} />
            <Text style={styles.progTitle}>NETWORK COMPLETION</Text>
            <Text style={styles.progNum}>{built.size} / {nodes.length}</Text>
          </View>
          <View style={styles.progBar}>
            <View style={[styles.progFill, { width: `${completePct * 100}%` }]} />
          </View>
          <Text style={styles.progSub}>
            {defense.network_complete
              ? "◆ COMPLETE — Earth is un-harvestable. Engage Apollyon."
              : "Build all 8 nodes to complete the Planetary Defense Network."}
          </Text>
        </View>

        {nodes.map((n) => {
          const done = built.has(n.id);
          const afford = canAfford(n);
          return (
            <View
              key={n.id}
              style={[
                styles.nodeCard,
                { borderColor: done ? colors.success : afford ? colors.brandPrimary : colors.border },
              ]}
              testID={`node-${n.id}`}
            >
              <View style={styles.nodeHeader}>
                <MaterialCommunityIcons
                  name={n.icon as any}
                  size={20}
                  color={done ? colors.success : afford ? colors.brandPrimary : colors.onSurfaceTertiary}
                />
                <Text style={[styles.nodeName, { color: done ? colors.success : colors.onSurface }]}>{n.name.toUpperCase()}</Text>
                {done && <MaterialCommunityIcons name="check-decagram" size={16} color={colors.success} />}
              </View>
              <View style={styles.costRow}>
                {Object.entries(n.cost).map(([k, v]) => (
                  <View key={k} style={styles.costChip}>
                    <Text style={styles.costLabel}>{k.toUpperCase()}</Text>
                    <Text style={[styles.costVal, { color: (player.resources as any)[k] >= (v || 0) ? colors.brandPrimary : colors.brandSecondary }]}>
                      {v}
                    </Text>
                  </View>
                ))}
              </View>
              {n.layer && (
                <Text style={styles.reinforce}>+15% HP → {n.layer.replace("_", " ").toUpperCase()}</Text>
              )}
              {!done && (
                <Pressable
                  onPress={() => build(n.id)}
                  disabled={!afford || busy !== null}
                  style={[
                    styles.buildBtn,
                    { borderColor: afford ? colors.brandPrimary : colors.border, opacity: afford ? 1 : 0.4 },
                  ]}
                  testID={`build-${n.id}`}
                >
                  <Text style={[styles.buildText, { color: afford ? colors.brandPrimary : colors.onSurfaceTertiary }]}>
                    {busy === n.id ? "..." : "▮ COMMIT RESOURCES"}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {defense.network_complete && (
          <Pressable
            onPress={() => router.replace("/apollyon")}
            style={styles.apolBtn}
            testID="apollyon-final"
          >
            <MaterialCommunityIcons name="skull-scan" size={22} color={colors.brandSecondary} />
            <Text style={styles.apolText}>ENGAGE APOLLYON // FINAL DUEL</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.brandSecondary} />
          </Pressable>
        )}

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

  progressCard: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,176,32,0.06)",
  },
  progRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  progTitle: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.sm, letterSpacing: 1.5, flex: 1 },
  progNum: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.lg },
  progBar: { height: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: 6 },
  progFill: { height: 4, backgroundColor: colors.warning },
  progSub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 6, letterSpacing: 0.5 },

  nodeCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  nodeHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  nodeName: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1.5, flex: 1 },
  costRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  costChip: {
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.md, alignItems: "center",
    minWidth: 60,
    backgroundColor: colors.surfaceTertiary,
  },
  costLabel: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: 9, letterSpacing: 1 },
  costVal: { fontFamily: fonts.displayBold, fontSize: fontSize.sm },
  reinforce: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 6, letterSpacing: 0.5 },
  buildBtn: {
    borderWidth: 1, borderRadius: radius.md, alignItems: "center",
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  buildText: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1.5 },

  apolBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.brandSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: "rgba(255,51,102,0.1)",
  },
  apolText: { flex: 1, fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.base, letterSpacing: 1.5 },
});
