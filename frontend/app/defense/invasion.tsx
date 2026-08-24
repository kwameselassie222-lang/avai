import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, DefenseState, ScanResult, EngageResult } from "@/src/api";
import { SHIP_META, LAYER_META } from "@/src/defense-meta";
import { TerminalHeader, HudButton } from "@/src/components/hud";
import { TransmissionModal } from "@/src/components/transmission-modal";

type Phase = "idle" | "scanning" | "scanned" | "engaging" | "result";

export default function InvasionScreen() {
  const router = useRouter();
  const [defense, setDefense] = useState<DefenseState | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [result, setResult] = useState<EngageResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [showBonusTx, setShowBonusTx] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  const loadState = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    setDefense(await api.defenseState(id));
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  const doScan = async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      setPhase("scanning");
      const s = await api.invasionScan(id);
      setScan(s);
      setPhase("scanned");
    } catch (e: any) {
      Alert.alert("SCAN FAILED", String(e.message || e));
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  };

  const doEngage = async () => {
    if (!scan) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      setPhase("engaging");
      const r = await api.invasionEngage({ player_id: id, wave_id: scan.wave_id });
      setResult(r);
      setPhase("result");
      loadState();
    } catch (e: any) {
      Alert.alert("ENGAGE FAILED", String(e.message || e));
      setPhase("scanned");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="INVASION // WAVE ENGAGE"
        subtitle={defense ? `SENSOR TIER ${defense.sensor_tier} • VIABILITY ${defense.viability.toFixed(1)}%` : "//"}
        right={
          <Pressable onPress={() => router.back()} style={styles.back}>
            <MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {phase === "idle" && (
          <View style={styles.hero}>
            <MaterialCommunityIcons name="radar" size={64} color={colors.brandPrimary} />
            <Text style={styles.heroTitle}>DEEP-SPACE SCAN READY</Text>
            <Text style={styles.heroSub}>
              Detect incoming Apollyon fleet.{"\n"}Sensor tier controls how much you see before engagement.
            </Text>
            <HudButton label={busy ? "..." : "▮ INITIATE SCAN"} onPress={doScan} disabled={busy} testID="btn-scan" />
          </View>
        )}

        {phase === "scanning" && (
          <View style={styles.hero}>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
            <Text style={styles.heroSub}>{"// SCANNING DEEP-SPACE SIGNATURES"}</Text>
          </View>
        )}

        {phase === "scanned" && scan && (
          <>
            <View style={styles.intelCard} testID="intel-card">
              <Text style={styles.cardTitle}>◆ WAVE {scan.wave_number} INTEL</Text>
              {scan.intel.level === 1 ? (
                <Text style={styles.intelBig}>
                  {scan.intel.unknown_signatures} UNIDENTIFIED SIGNATURES
                </Text>
              ) : (
                <>
                  <Text style={styles.intelBig}>
                    {scan.intel.total_detected} SIGNATURES DETECTED
                  </Text>
                  <View style={styles.breakdown}>
                    {scan.intel.breakdown &&
                      Object.entries(scan.intel.breakdown).map(([k, n]) => {
                        const m = SHIP_META[k] || SHIP_META.unknown;
                        return (
                          <View key={k} style={styles.brRow}>
                            <MaterialCommunityIcons name={m.icon as any} size={14} color={m.color} />
                            <Text style={[styles.brLabel, { color: m.color }]}>{m.label.toUpperCase()}</Text>
                            <Text style={styles.brNum}>× {n}</Text>
                          </View>
                        );
                      })}
                  </View>
                </>
              )}
              {scan.intel.stealth_warning && (
                <Text style={styles.stealthWarn}>! STEALTH SIGNATURES SUSPECTED — TIER 3 REQUIRED</Text>
              )}
            </View>

            {scan.adaptations.length > 0 && (
              <View style={styles.adaptCard}>
                <Text style={styles.adaptTitle}>▮ APOLLYON COUNTER-ADAPTATIONS ACTIVE</Text>
                {scan.adaptations.map((a, i) => (
                  <Text key={i} style={styles.adaptItem}>◆ {a.name} — {a.note}</Text>
                ))}
              </View>
            )}

            <View style={styles.shipList}>
              <Text style={styles.subTitle}>REVEALED CONTACTS ({scan.revealed.length})</Text>
              {scan.revealed.map((s) => {
                const m = SHIP_META[s.type_display] || SHIP_META.unknown;
                return (
                  <View key={s.id} style={styles.shipRow}>
                    <MaterialCommunityIcons name={m.icon as any} size={16} color={m.color} />
                    <Text style={[styles.shipLabel, { color: m.color }]}>{m.label.toUpperCase()}</Text>
                    <Text style={styles.shipStat}>HP {s.hp}</Text>
                    <Text style={styles.shipStat}>PWR {s.power}</Text>
                  </View>
                );
              })}
            </View>

            <HudButton
              label={busy ? "ENGAGING..." : "▮ ENGAGE (15 PWR)"}
              variant="danger"
              onPress={doEngage}
              disabled={busy}
              testID="btn-engage"
            />
          </>
        )}

        {phase === "engaging" && (
          <View style={styles.hero}>
            <ActivityIndicator color={colors.brandSecondary} size="large" />
            <Text style={styles.heroSub}>{"// LAYERS ENGAGED — SIMULATING PENETRATION"}</Text>
          </View>
        )}

        {phase === "result" && result && (
          <>
            <View
              style={[
                styles.outcomeCard,
                { borderColor: result.outcome === "victory" ? colors.success : result.outcome === "apollyon_victory" ? colors.brandSecondary : colors.warning },
              ]}
              testID="outcome-card"
            >
              <Text
                style={[
                  styles.outcomeTitle,
                  { color: result.outcome === "victory" ? colors.success : result.outcome === "apollyon_victory" ? colors.brandSecondary : colors.warning },
                ]}
              >
                {result.outcome === "victory"
                  ? "WAVE REPELLED"
                  : result.outcome === "apollyon_victory"
                  ? "EARTH VIABILITY CRITICAL"
                  : "PARTIAL BREACH"}
              </Text>
              <Text style={styles.outcomeBig}>VIABILITY: {result.viability_after.toFixed(1)}%</Text>
              <Text style={styles.outcomeSub}>
                +{result.rewards.xp} XP • +{result.rewards.research}⚛ • +{result.rewards.materials}▣
              </Text>
            </View>

            <Text style={styles.subTitle}>ENGAGEMENT LOG</Text>
            {result.log.map((entry, i) => {
              if (entry.type === "combat") {
                const m = LAYER_META[entry.layer];
                return (
                  <View key={i} style={styles.logRow}>
                    <MaterialCommunityIcons name={m.icon as any} size={14} color={m.color} />
                    <Text style={[styles.logLayer, { color: m.color }]}>{m.name.toUpperCase()}</Text>
                    <Text style={styles.logDetail}>
                      killed {entry.ships_killed} • layer −{entry.incoming_damage} HP
                    </Text>
                  </View>
                );
              }
              if (entry.type === "harvest") {
                return (
                  <View key={i} style={[styles.logRow, { borderColor: colors.brandSecondary }]}>
                    <MaterialCommunityIcons name="alert" size={14} color={colors.brandSecondary} />
                    <Text style={[styles.logLayer, { color: colors.brandSecondary }]}>
                      {entry.zone?.toUpperCase()}
                    </Text>
                    <Text style={[styles.logDetail, { color: colors.brandSecondary }]}>
                      harvested −{entry.damage} → {entry.integrity}%
                    </Text>
                  </View>
                );
              }
              return null;
            })}

            <View style={{ height: 16 }} />
            {result.outcome === "victory" && !bonusClaimed && (
              <Pressable onPress={() => setShowBonusTx(true)} style={styles.bonusBtn} testID="btn-double-rewards">
                <MaterialCommunityIcons name="radio-tower" size={14} color={colors.warning} />
                <Text style={styles.bonusText}>ACCESS SPONSOR TRANSMISSION — DOUBLE REWARDS</Text>
              </Pressable>
            )}
            <HudButton
              label="▮ RETURN TO CONSOLE"
              variant="ghost"
              onPress={() => router.back()}
            />
          </>
        )}
      </ScrollView>
      <TransmissionModal
        visible={showBonusTx}
        slot="double_rewards"
        onClose={() => setShowBonusTx(false)}
        onGranted={() => { setBonusClaimed(true); setShowBonusTx(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg },
  back: { padding: spacing.xs },
  hero: { alignItems: "center", padding: spacing.xl, gap: spacing.md },
  heroTitle: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xl, letterSpacing: 2, textAlign: "center" },
  heroSub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, textAlign: "center", lineHeight: 20 },

  intelCard: {
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "rgba(0,229,255,0.05)",
    marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5 },
  intelBig: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.xl, letterSpacing: 1.5, marginTop: 6 },
  breakdown: { marginTop: spacing.sm, gap: 4 },
  brRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1.2, flex: 1 },
  brNum: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm },
  stealthWarn: {
    fontFamily: fonts.displayBold,
    color: colors.warning,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    marginTop: spacing.sm,
  },

  adaptCard: {
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,51,102,0.06)",
  },
  adaptTitle: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.xs, letterSpacing: 1.5, marginBottom: 4 },
  adaptItem: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 2 },

  subTitle: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5, marginBottom: spacing.sm, marginTop: spacing.sm },
  shipList: { marginBottom: spacing.md, gap: 4 },
  shipRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: colors.surfaceSecondary,
  },
  shipLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1.2, flex: 1 },
  shipStat: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1 },

  outcomeCard: {
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  outcomeTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, letterSpacing: 2 },
  outcomeBig: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.xxl, letterSpacing: 1.5, marginTop: 6 },
  outcomeSub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 6, letterSpacing: 0.5 },

  logRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.xs, paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: 4,
  },
  logLayer: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1.2, width: 100 },
  logDetail: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, flex: 1 },
  bonusBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: colors.warning,
    paddingVertical: spacing.sm, borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,176,32,0.08)",
  },
  bonusText: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.xs, letterSpacing: 1.5 },
});
