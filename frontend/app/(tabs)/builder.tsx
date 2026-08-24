import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, V2Campaign, V2Config } from "@/src/api";

const ROBOT_ICONS: Record<string, string> = {
  scout: "run-fast", guardian: "shield", drone: "quadcopter", striker: "robot",
  sniper: "crosshairs", tank: "tank", titan: "robot-industrial",
};

export default function RobotsScreen() {
  const [config, setConfig] = useState<V2Config | null>(null);
  const [camp, setCamp] = useState<V2Campaign | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [p, c] = await Promise.all([api.v2Player(id), api.v2Config()]);
    setCamp(p.campaign);
    setConfig(c);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const upgrade = async (rid: string) => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(rid);
      const res = await api.v2UpgradeRobot({ player_id: id, robot_id: rid });
      setCamp(res.campaign);
      Alert.alert("UPGRADED", `${rid.toUpperCase()} → LEVEL ${res.new_level}`);
    } catch (e: any) {
      Alert.alert("UPGRADE FAILED", String(e.message || e));
    } finally { setBusy(null); }
  };

  const toggleDeck = async (rid: string) => {
    if (!camp) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    const inDeck = camp.deck.includes(rid);
    let newDeck: string[];
    if (inDeck) newDeck = camp.deck.filter((x) => x !== rid);
    else if (camp.deck.length >= 6) { Alert.alert("DECK FULL", "Remove a robot first (max 6)."); return; }
    else newDeck = [...camp.deck, rid];
    try {
      const res = await api.v2SetDeck({ player_id: id, deck: newDeck });
      setCamp({ ...camp, deck: res.deck });
    } catch (e: any) { Alert.alert("ERR", String(e.message)); }
  };

  if (loading || !config || !camp) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>ROBOT COLLECTION</Text>
        <Text style={styles.sub}>DECK {camp.deck.length}/6 • {camp.parts} PARTS</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {config.robots.map((r) => {
          const unlocked = camp.unlocked_robots.includes(r.id);
          const level = camp.robot_levels[r.id] || 1;
          const inDeck = camp.deck.includes(r.id);
          const cost = 30 + Math.max(0, level - 1) * 25;
          const canAfford = camp.parts >= cost;
          const hp = Math.round(r.hp * (1 + (level - 1) * 0.08));
          const atk = Math.round(r.atk * (1 + (level - 1) * 0.08));
          return (
            <View key={r.id} style={[styles.card, { borderColor: !unlocked ? colors.border : inDeck ? colors.brandPrimary : colors.borderStrong, opacity: unlocked ? 1 : 0.4 }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name={ROBOT_ICONS[r.id] as any || "robot"} size={30} color={unlocked ? colors.brandPrimary : colors.onSurfaceTertiary} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={styles.flavor}>{r.flavor}</Text>
                </View>
                {unlocked ? (
                  <View style={styles.lvlBadge}><Text style={styles.lvlText}>LV {level}</Text></View>
                ) : (
                  <View style={styles.lockBadge}><Text style={styles.lockText}>LVL {r.unlock_level}</Text></View>
                )}
              </View>
              <View style={styles.statsRow}>
                <Stat label="COST" value={`${r.cost}⚡`} color={colors.warning} />
                <Stat label="HP" value={`${hp}`} color={colors.success} />
                <Stat label="ATK" value={`${atk}`} color={colors.brandSecondary} />
                <Stat label="SPD" value={`${r.speed.toFixed(1)}x`} color={colors.brandPrimary} />
              </View>
              {unlocked && (
                <View style={styles.actionsRow}>
                  <Pressable onPress={() => toggleDeck(r.id)} style={[styles.btn, { borderColor: inDeck ? colors.brandPrimary : colors.border }]}>
                    <MaterialCommunityIcons name={inDeck ? "check-circle" : "plus-circle-outline"} size={14} color={inDeck ? colors.brandPrimary : colors.onSurfaceSecondary} />
                    <Text style={[styles.btnText, { color: inDeck ? colors.brandPrimary : colors.onSurfaceSecondary }]}>
                      {inDeck ? "IN DECK" : "ADD TO DECK"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => upgrade(r.id)}
                    disabled={!canAfford || busy !== null || level >= 10}
                    style={[styles.btn, { borderColor: canAfford && level < 10 ? colors.success : colors.border, opacity: canAfford && level < 10 ? 1 : 0.4 }]}
                  >
                    <MaterialCommunityIcons name="arrow-up-bold" size={14} color={canAfford ? colors.success : colors.onSurfaceTertiary} />
                    <Text style={[styles.btnText, { color: canAfford ? colors.success : colors.onSurfaceTertiary }]}>
                      {busy === r.id ? "..." : level >= 10 ? "MAX" : `UPGRADE ${cost}P`}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xl, letterSpacing: 2 },
  sub: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1.5, marginTop: 4 },
  scroll: { padding: spacing.lg, paddingTop: 0 },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surfaceSecondary },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  name: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.base, letterSpacing: 1.5 },
  flavor: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  lvlBadge: { borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: 6, paddingVertical: 2 },
  lvlText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: 10, letterSpacing: 1 },
  lockBadge: { borderWidth: 1, borderColor: colors.onSurfaceTertiary, paddingHorizontal: 6, paddingVertical: 2 },
  lockText: { fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1 },
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.sm },
  stat: { alignItems: "center" },
  statLabel: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: 9, letterSpacing: 1 },
  statVal: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 6, marginTop: spacing.sm },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, paddingVertical: 6, borderRadius: radius.md },
  btnText: { fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 1 },
});
