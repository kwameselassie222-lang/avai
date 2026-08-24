import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import {
  api,
  storage,
  Player,
  DefenseState,
  ResourceZone,
  DefenseLayer,
  CascadeModifiers,
} from "@/src/api";
import { LAYER_META, LAYER_ORDER } from "@/src/defense-meta";
import { TerminalHeader } from "@/src/components/hud";

const CRITICAL = 25;

export default function EarthAIConsole() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [defense, setDefense] = useState<DefenseState | null>(null);
  const [cascade, setCascade] = useState<CascadeModifiers | null>(null);
  const [archonsDefeated, setArchonsDefeated] = useState<number>(0);
  const [archonsTotal, setArchonsTotal] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const id = await storage.getPlayerId();
      if (!id) {
        router.replace("/");
        return;
      }
      const [p, d, c, a] = await Promise.all([
        api.getPlayer(id),
        api.defenseState(id),
        api.cascadeState(id),
        api.archonsStatus(id),
      ]);
      setPlayer(p);
      setDefense(d);
      setCascade(c);
      setArchonsDefeated(a.archons.filter((x) => x.defeated).length);
      setArchonsTotal(a.archons.length);
    } catch (e) {
      console.warn("console load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading || !player || !defense) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const viability = defense.viability ?? 100;
  const viabilityColor =
    viability <= CRITICAL ? colors.brandSecondary : viability < 60 ? colors.warning : colors.success;
  const networkPct = (defense.network_progress?.length ?? 0) / 8;

  const criticalZones = (defense.zones || []).filter((z) => z.integrity < 50).length;
  const apollyonVictory = viability <= CRITICAL || defense.apollyon_victory;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        testID="console-header"
        title={`EARTH AI CONSOLE // ${player.codename}`}
        subtitle={`CMDR OVERSEER • GEN ${player.generation} • WAVE ${defense.wave_count}`}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
        }
      >
        {/* ==== PLANETARY VIABILITY ==== */}
        <View style={[styles.viaCard, { borderColor: viabilityColor }]} testID="viability-card">
          <LinearGradient
            colors={[`${viabilityColor}22`, "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.viaHeaderRow}>
            <MaterialCommunityIcons name="earth" size={20} color={viabilityColor} />
            <Text style={styles.viaTitle}>PLANETARY VIABILITY</Text>
            <Text style={[styles.viaBadge, { color: viabilityColor }]}>
              {viability <= CRITICAL ? "CRITICAL" : viability < 60 ? "STRAINED" : "STABLE"}
            </Text>
          </View>
          <Text style={[styles.viaValue, { color: viabilityColor }]} testID="viability-value">
            {viability.toFixed(1)}%
          </Text>
          <View style={styles.viaBar}>
            <View
              style={[styles.viaFill, { width: `${Math.max(0, viability)}%`, backgroundColor: viabilityColor }]}
            />
            <View style={[styles.viaMarker, { left: `${CRITICAL}%` }]} />
          </View>
          <Text style={styles.viaSub}>
            {apollyonVictory
              ? "EARTH CAN NO LONGER SUSTAIN CIVILIZATION"
              : `${criticalZones} resource zone${criticalZones === 1 ? "" : "s"} compromised • lose < ${CRITICAL}% = APOLLYON WINS`}
          </Text>
        </View>

        {/* ==== RESOURCES STRIP ==== */}
        <View style={styles.resRow} testID="resource-row">
          <ResCell icon="lightning-bolt" label="PWR"   value={player.resources.energy}    max={100} color={colors.warning} />
          <ResCell icon="cube-outline"   label="MAT"   value={player.resources.materials}           color={colors.brandPrimary} />
          <ResCell icon="chip"           label="COMP"  value={player.resources.compute}             color={colors.success} />
          <ResCell icon="atom"           label="RSRCH" value={player.resources.research}            color={colors.brandSecondary} />
        </View>

        {/* ==== ADAPTATION WARNINGS ==== */}
        {(defense.adaptations || []).length > 0 && (
          <View style={styles.adaptCard} testID="adaptation-card">
            <View style={styles.adaptHeader}>
              <MaterialCommunityIcons name="alert-decagram" size={16} color={colors.brandSecondary} />
              <Text style={styles.adaptTitle}>APOLLYON HAS ANALYZED YOUR DEFENSE NETWORK</Text>
            </View>
            {defense.adaptations.map((a, i) => (
              <View key={i} style={styles.adaptRow}>
                <Text style={styles.adaptName}>▮ {a.name}</Text>
                <Text style={styles.adaptNote}>{a.note}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ==== CASCADING SYSTEM DAMAGE ==== */}
        {cascade && cascade.warnings.length > 0 && (
          <View style={styles.cascadeCard} testID="cascade-card">
            <View style={styles.adaptHeader}>
              <MaterialCommunityIcons name="lightning-bolt-outline" size={16} color={colors.warning} />
              <Text style={styles.cascadeTitle}>CASCADING SYSTEM FAILURES</Text>
            </View>
            {cascade.warnings.map((w, i) => (
              <Text key={i} style={styles.cascadeLine}>▮ {w}</Text>
            ))}
            {cascade.sensor_penalty > 0 && (
              <Text style={styles.cascadeLine}>
                ◆ EFFECTIVE SENSOR TIER: {cascade.effective_sensor_tier} (base {cascade.base_sensor_tier})
              </Text>
            )}
          </View>
        )}

        {/* ==== QUICK ACTIONS ==== */}
        <View style={styles.actionsGrid}>
          <ActionCard
            icon="radar"
            label="SCAN & ENGAGE"
            sub={apollyonVictory ? "RECOVERY REQUIRED" : "Detect incoming wave"}
            color={colors.brandSecondary}
            disabled={apollyonVictory}
            onPress={() => router.push("/defense/invasion")}
            testID="cta-invasion"
          />
          <ActionCard
            icon="chip"
            label="PROTOCOLS"
            sub={`${defense.protocols?.length || 0} rule${(defense.protocols?.length || 0) === 1 ? "" : "s"} active`}
            color={colors.brandPrimary}
            onPress={() => router.push("/defense/protocols")}
            testID="cta-protocols"
          />
          <ActionCard
            icon="shield-half-full"
            label="LAYERS"
            sub="Assign robots"
            color={colors.success}
            onPress={() => router.push("/defense/layers")}
            testID="cta-layers"
          />
          <ActionCard
            icon="hexagon-multiple"
            label="NETWORK"
            sub={`${defense.network_progress?.length || 0}/8 nodes`}
            color={colors.warning}
            onPress={() => router.push("/defense/network")}
            testID="cta-network"
          />
          <ActionCard
            icon="crown"
            label="ARCHONS"
            sub={`${archonsDefeated}/${archonsTotal} defeated`}
            color="#B57BFF"
            onPress={() => router.push("/defense/archons")}
            testID="cta-archons"
          />
          <ActionCard
            icon="alert-decagram"
            label="TRIAGE"
            sub={defense.wave_count >= 3 ? "Multi-front assault" : `Unlocks wave 3 (now ${defense.wave_count})`}
            color={colors.brandSecondary}
            disabled={defense.wave_count < 3 || apollyonVictory}
            onPress={() => router.push("/defense/triage")}
            testID="cta-triage"
          />
          <ActionCard
            icon="wrench"
            label="REPAIR ZONES"
            sub={`${criticalZones} zone${criticalZones === 1 ? "" : "s"} need work`}
            color={colors.success}
            onPress={() => router.push("/defense/zones")}
            testID="cta-zones"
          />
          <ActionCard
            icon="shield-account"
            label="DOCTRINES"
            sub="Named loadouts"
            color={colors.brandPrimary}
            onPress={() => router.push("/defense/doctrines")}
            testID="cta-doctrines"
          />
        </View>

        {/* ==== NETWORK COMPLETION BAR ==== */}
        <Pressable
          style={styles.netProgress}
          onPress={() => router.push("/defense/network")}
          testID="network-progress"
        >
          <View style={styles.netHeader}>
            <MaterialCommunityIcons name="hexagon-multiple" size={14} color={colors.warning} />
            <Text style={styles.netTitle}>PLANETARY DEFENSE NETWORK</Text>
            <Text style={styles.netValue}>{defense.network_progress?.length || 0}/8</Text>
          </View>
          <View style={styles.netBar}>
            <View style={[styles.netFill, { width: `${networkPct * 100}%` }]} />
          </View>
          <Text style={styles.netSub}>
            {defense.network_complete ? "◆ NETWORK COMPLETE — INITIATE APOLLYON" : "Complete to make Earth un-harvestable"}
          </Text>
        </Pressable>

        {/* ==== DEFENSE LAYER STACK ==== */}
        <Text style={styles.sectionTitle}>▮ MULTI-LAYER DEFENSE GRID</Text>
        <View style={styles.layerStack}>
          {LAYER_ORDER.map((lid) => {
            const L: DefenseLayer | undefined = defense.layers?.[lid];
            const meta = LAYER_META[lid];
            const hpPct = L ? (L.hp / L.max_hp) * 100 : 0;
            const isResource = lid === "resource_zones";
            return (
              <View key={lid} style={[styles.layerCard, { borderColor: hpPct < 30 ? colors.brandSecondary : colors.border }]}>
                <View style={styles.layerHeader}>
                  <MaterialCommunityIcons name={meta.icon as any} size={16} color={meta.color} />
                  <Text style={[styles.layerName, { color: meta.color }]}>{meta.name.toUpperCase()}</Text>
                  {!isResource && (
                    <Text style={styles.layerHp}>
                      {L?.hp}/{L?.max_hp} HP
                    </Text>
                  )}
                </View>
                {!isResource && (
                  <View style={styles.layerBar}>
                    <View style={[styles.layerFill, { width: `${hpPct}%`, backgroundColor: meta.color }]} />
                  </View>
                )}
                <Text style={styles.layerAssignment}>
                  {isResource
                    ? `${defense.zones?.filter((z) => z.integrity > 0).length || 0}/${defense.zones?.length || 0} zones online`
                    : `${L?.assigned_robots?.length || 0} robot${(L?.assigned_robots?.length || 0) === 1 ? "" : "s"} assigned`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ==== RESOURCE ZONES GRID ==== */}
        <Text style={styles.sectionTitle}>▮ EARTH RESOURCE ZONES</Text>
        <View style={styles.zoneGrid}>
          {(defense.zones || []).map((z) => (
            <ZoneCell key={z.id} zone={z} />
          ))}
        </View>

        {/* ==== SENSOR TIER ==== */}
        <View style={styles.sensorCard}>
          <MaterialCommunityIcons
            name={defense.sensor_tier >= 3 ? "eye-plus" : defense.sensor_tier === 2 ? "eye" : "eye-off"}
            size={18}
            color={colors.brandPrimary}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.sensorTitle}>SENSOR TIER {defense.sensor_tier} / 3</Text>
            <Text style={styles.sensorSub}>
              {defense.sensor_tier === 1
                ? "// Basic scan — total count only"
                : defense.sensor_tier === 2
                ? "// Breakdown by ship type — decoys unmasked in engage"
                : "// Full intel — stealth revealed, decoys tagged"}
            </Text>
          </View>
        </View>

        {/* ==== APOLLYON CTA ==== */}
        {defense.network_complete && !player.apollyon?.decision && (
          <Pressable
            style={styles.apolCta}
            onPress={() => router.push("/apollyon")}
            testID="apollyon-cta"
          >
            <MaterialCommunityIcons name="skull-scan" size={26} color={colors.brandSecondary} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.apolTitle}>NETWORK COMPLETE // ENGAGE APOLLYON</Text>
              <Text style={styles.apolSub}>The final duel between two artificial intelligences.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.brandSecondary} />
          </Pressable>
        )}

        {apollyonVictory && (
          <View style={styles.defeatCard} testID="apollyon-victory-card">
            <Text style={styles.defeatTitle}>APOLLYON VICTORY</Text>
            <Text style={styles.defeatBody}>
              Earth has fallen below sustainable viability. Reset the planet to try again.
            </Text>
            <Pressable
              style={styles.resetBtn}
              onPress={async () => {
                if (!player) return;
                await api.defenseReset(player.id);
                load();
              }}
              testID="reset-defense"
            >
              <Text style={styles.resetText}>▮ RESTORE PLANETARY STATE</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ResCell({ icon, label, value, max, color }: any) {
  return (
    <View style={styles.resCell}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={styles.resLabel}>{label}</Text>
      <Text style={[styles.resValue, { color }]}>
        {value}
        {max ? <Text style={styles.resMax}>/{max}</Text> : null}
      </Text>
    </View>
  );
}

function ActionCard({
  icon, label, sub, color, onPress, disabled, testID,
}: {
  icon: string; label: string; sub: string; color: string; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.actionCard,
        { borderColor: color, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </Pressable>
  );
}

function ZoneCell({ zone }: { zone: ResourceZone }) {
  const critical = zone.integrity < 40;
  const dead = zone.integrity <= 0;
  return (
    <View
      style={[
        styles.zoneCell,
        {
          borderColor: dead ? colors.brandSecondary : critical ? colors.warning : colors.border,
          opacity: dead ? 0.5 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={zone.icon as any} size={16} color={zone.color} />
      <Text style={styles.zoneName}>{zone.name.toUpperCase()}</Text>
      <View style={styles.zoneBar}>
        <View style={[styles.zoneFill, { width: `${zone.integrity}%`, backgroundColor: zone.color }]} />
      </View>
      <Text style={[styles.zoneInt, { color: zone.color }]}>{zone.integrity}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingTop: spacing.md },
  viaCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    overflow: "hidden",
  },
  viaHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  viaTitle: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.xs, letterSpacing: 1.5, flex: 1 },
  viaBadge: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1.5 },
  viaValue: { fontFamily: fonts.displayBold, fontSize: 38, letterSpacing: 2, marginVertical: 4 },
  viaBar: { height: 6, backgroundColor: colors.surfaceTertiary, overflow: "hidden", borderRadius: 2, marginTop: 4 },
  viaFill: { height: 6 },
  viaMarker: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: colors.brandSecondary },
  viaSub: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 0.5, marginTop: 6 },

  resRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md },
  resCell: {
    flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
    padding: spacing.xs, alignItems: "center", borderRadius: radius.md,
  },
  resLabel: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  resValue: { fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 0.5 },
  resMax: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs },

  adaptCard: {
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,51,102,0.06)",
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  cascadeCard: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,176,32,0.06)",
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  cascadeTitle: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.xs, letterSpacing: 1.5, flex: 1 },
  cascadeLine: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 3, letterSpacing: 0.3 },
  adaptHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xs },
  adaptTitle: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.xs, letterSpacing: 1.5, flex: 1 },
  adaptRow: { marginTop: 4 },
  adaptName: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.sm, letterSpacing: 1 },
  adaptNote: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginLeft: 8 },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionCard: {
    width: "48%",
    borderWidth: 1,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    gap: 4,
  },
  actionLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 1.5, marginTop: 6 },
  actionSub: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 0.5 },

  netProgress: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,176,32,0.05)",
  },
  netHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  netTitle: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.xs, letterSpacing: 1.5, flex: 1 },
  netValue: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.base, letterSpacing: 1 },
  netBar: { height: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  netFill: { height: 4, backgroundColor: colors.warning },
  netSub: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 6, letterSpacing: 0.5 },

  sectionTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.lg,
    letterSpacing: 2,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  layerStack: { marginBottom: spacing.md, gap: 6 },
  layerCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  layerHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  layerName: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1.5, flex: 1 },
  layerHp: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1 },
  layerBar: { height: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: 2 },
  layerFill: { height: 3 },
  layerAssignment: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 4, letterSpacing: 0.5 },

  zoneGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  zoneCell: {
    width: "31%",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    gap: 4,
  },
  zoneName: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: 9, letterSpacing: 1, textAlign: "center" },
  zoneBar: { height: 3, width: "100%", backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  zoneFill: { height: 3 },
  zoneInt: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 0.5 },

  sensorCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md,
  },
  sensorTitle: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5 },
  sensorSub: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },

  apolCta: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "rgba(255,51,102,0.1)",
    marginBottom: spacing.md,
  },
  apolTitle: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.base, letterSpacing: 1.5 },
  apolSub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 2 },

  defeatCard: {
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,51,102,0.08)",
    alignItems: "center",
  },
  defeatTitle: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.lg, letterSpacing: 2 },
  defeatBody: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, textAlign: "center", marginTop: 6 },
  resetBtn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.brandSecondary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  resetText: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.sm, letterSpacing: 1.5 },
});
