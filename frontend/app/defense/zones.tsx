import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, DefenseState, Player, ResourceZone } from "@/src/api";
import { TerminalHeader, HudButton } from "@/src/components/hud";

const MAT_PER_PT = 3;
const ENERGY_PER_5PT = 1;

export default function ZonesScreen() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [defense, setDefense] = useState<DefenseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<ResourceZone | null>(null);
  const [points, setPoints] = useState<number>(10);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [p, d] = await Promise.all([api.getPlayer(id), api.defenseState(id)]);
    setPlayer(p);
    setDefense(d);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doRepair = async () => {
    if (!selectedZone || !player) return;
    try {
      setBusy(true);
      const res = await api.zoneRepair({ player_id: player.id, zone_id: selectedZone.id, points });
      Alert.alert("REPAIR COMPLETE", `+${res.repaired}% integrity → ${res.zone.integrity}%. Viability now ${res.viability.toFixed(1)}%`);
      setSelectedZone(null);
      await load();
    } catch (e: any) {
      Alert.alert("REPAIR FAILED", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !player || !defense) {
    return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  // Repair modal
  if (selectedZone) {
    const zoneNow = defense.zones.find((z) => z.id === selectedZone.id) || selectedZone;
    const missing = 100 - zoneNow.integrity;
    const cappedPoints = Math.min(points, missing);
    const costMat = cappedPoints * MAT_PER_PT;
    const costEnergy = Math.max(1, Math.floor(cappedPoints / 5) * ENERGY_PER_5PT);
    const canAfford = (player.resources.materials >= costMat) && (player.resources.energy >= costEnergy);
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <TerminalHeader
          title="ZONE REPAIR"
          subtitle={zoneNow.name.toUpperCase()}
          right={<Pressable onPress={() => setSelectedZone(null)} style={styles.back}><MaterialCommunityIcons name="chevron-left" size={20} color={colors.brandPrimary} /></Pressable>}
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.zoneBig, { borderColor: zoneNow.color }]}>
            <MaterialCommunityIcons name={zoneNow.icon as any} size={48} color={zoneNow.color} />
            <Text style={[styles.zoneName, { color: zoneNow.color }]}>{zoneNow.name.toUpperCase()}</Text>
            <Text style={styles.integrity}>{zoneNow.integrity}%<Text style={styles.integritySmall}> / 100%</Text></Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${zoneNow.integrity}%`, backgroundColor: zoneNow.color }]} />
            </View>
          </View>

          <Text style={styles.label}>▮ REPAIR AMOUNT</Text>
          <View style={styles.presetRow}>
            {[5, 10, 25, 50, missing].filter((v) => v > 0 && v <= missing).map((v, i) => (
              <Pressable
                key={i}
                onPress={() => setPoints(v)}
                style={[
                  styles.preset,
                  { borderColor: points === v ? colors.brandPrimary : colors.border, backgroundColor: points === v ? "rgba(0,229,255,0.1)" : colors.surfaceSecondary },
                ]}
              >
                <Text style={[styles.presetText, { color: points === v ? colors.brandPrimary : colors.onSurfaceSecondary }]}>
                  +{v}%
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <MaterialCommunityIcons name="cube-outline" size={14} color={colors.brandPrimary} />
              <Text style={styles.costLabel}>MATERIALS</Text>
              <Text style={[styles.costVal, { color: player.resources.materials >= costMat ? colors.brandPrimary : colors.brandSecondary }]}>
                −{costMat}
              </Text>
              <Text style={styles.have}>have {player.resources.materials}</Text>
            </View>
            <View style={styles.costRow}>
              <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.warning} />
              <Text style={styles.costLabel}>ENERGY</Text>
              <Text style={[styles.costVal, { color: player.resources.energy >= costEnergy ? colors.warning : colors.brandSecondary }]}>
                −{costEnergy}
              </Text>
              <Text style={styles.have}>have {player.resources.energy}</Text>
            </View>
          </View>

          <HudButton
            label={busy ? "..." : `▮ REPAIR +${cappedPoints}%`}
            onPress={doRepair}
            disabled={!canAfford || busy || missing <= 0}
            testID="btn-do-repair"
          />
          {missing <= 0 && <Text style={styles.hint}>◆ Zone fully intact.</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="ZONE REPAIR CONSOLE"
        subtitle={`VIABILITY ${defense.viability.toFixed(1)}%`}
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>◆ Spend materials + energy to restore resource-zone integrity. Improves planetary viability directly.</Text>
        {defense.zones.map((z) => {
          const critical = z.integrity < 40;
          return (
            <Pressable
              key={z.id}
              onPress={() => setSelectedZone(z)}
              style={[
                styles.zoneCard,
                { borderColor: z.integrity >= 100 ? colors.border : critical ? colors.brandSecondary : z.color },
              ]}
              disabled={z.integrity >= 100}
              testID={`repair-zone-${z.id}`}
            >
              <View style={styles.zoneHeader}>
                <MaterialCommunityIcons name={z.icon as any} size={20} color={z.color} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.zoneNameSm, { color: z.color }]}>{z.name.toUpperCase()}</Text>
                  <Text style={styles.zoneMeta}>WEIGHT {z.weight}  •  {z.integrity}%</Text>
                </View>
                {z.integrity >= 100 ? (
                  <MaterialCommunityIcons name="check-decagram" size={18} color={colors.success} />
                ) : (
                  <MaterialCommunityIcons name="wrench" size={18} color={z.color} />
                )}
              </View>
              <View style={styles.barSmall}>
                <View style={[styles.fillSmall, { width: `${z.integrity}%`, backgroundColor: z.color }]} />
              </View>
              {critical && <Text style={styles.critWarn}>! CRITICAL — cascading damage active</Text>}
            </Pressable>
          );
        })}
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
  hint: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: spacing.md, letterSpacing: 0.5 },
  zoneCard: {
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  zoneHeader: { flexDirection: "row", alignItems: "center" },
  zoneNameSm: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1.5 },
  zoneMeta: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  barSmall: { height: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: 6 },
  fillSmall: { height: 3 },
  critWarn: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.xs, marginTop: 6, letterSpacing: 1 },

  zoneBig: {
    borderWidth: 2, borderRadius: radius.md, padding: spacing.md, alignItems: "center",
    marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary,
  },
  zoneName: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, letterSpacing: 2, marginTop: 6 },
  integrity: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: 40, letterSpacing: 2, marginTop: 4 },
  integritySmall: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  bar: { height: 5, width: "100%", backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: spacing.sm, borderRadius: 2 },
  fill: { height: 5 },

  label: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xs, letterSpacing: 1.5, marginBottom: spacing.xs },
  presetRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: spacing.md },
  preset: {
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.md,
  },
  presetText: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1 },
  costCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary,
    gap: 4,
  },
  costRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  costLabel: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1, width: 80 },
  costVal: { fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 1 },
  have: { flex: 1, textAlign: "right", fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 0.5 },
});
