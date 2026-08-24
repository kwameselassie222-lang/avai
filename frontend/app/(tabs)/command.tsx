import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, V2Campaign, V2Config } from "@/src/api";

export default function HomeScreen() {
  const router = useRouter();
  const [camp, setCamp] = useState<V2Campaign | null>(null);
  const [codename, setCodename] = useState<string>("COMMANDER");
  const [config, setConfig] = useState<V2Config | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) { router.replace("/"); return; }
    const [p, c] = await Promise.all([api.v2Player(id), api.v2Config()]);
    setCamp(p.campaign);
    setCodename(p.codename);
    setConfig(c);
    setLoading(false);
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !camp || !config) {
    return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const totalStars = Object.values(camp.stars).reduce((s, v) => s + Number(v || 0), 0);
  const nextLevel = config.levels.find((L) => L.id === camp.level) || config.levels[config.levels.length - 1];
  const stage = config.stages.find((s) => s.stage === camp.commander_stage) || config.stages[0];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>ALIENS <Text style={{ color: colors.brandSecondary }}>V</Text> A.I.</Text>
          <Text style={styles.subtitle}>BUILD · DEPLOY · DEFEND EARTH</Text>
        </View>

        <View style={styles.commanderCard}>
          <LinearGradient
            colors={["rgba(0,229,255,0.18)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <MaterialCommunityIcons name="robot-excited" size={64} color={colors.brandPrimary} />
          <Text style={styles.cmdName}>{stage.name}</Text>
          <Text style={styles.cmdCode}>OPERATOR: {codename}</Text>
          <View style={styles.statsRow}>
            <Stat label="STARS" value={`${totalStars}/30`} color={colors.warning} />
            <Stat label="PARTS" value={`${camp.parts}`} color={colors.success} />
            <Stat label="LEVEL" value={`${camp.level}/${config.levels.length}`} color={colors.brandPrimary} />
          </View>
        </View>

        <Pressable
          style={styles.battleBtn}
          onPress={() => router.push(`/battle?level=${camp.level}`)}
          testID="btn-battle"
        >
          <LinearGradient
            colors={[colors.brandSecondary, "#B57BFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <MaterialCommunityIcons name="sword-cross" size={28} color="#fff" />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={styles.battleLabel}>BATTLE</Text>
            <Text style={styles.battleSub}>
              LEVEL {nextLevel.id} — {nextLevel.name}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={26} color="#fff" />
        </Pressable>

        <View style={styles.actionsGrid}>
          <ActionCard icon="robot" label="ROBOTS" sub={`${camp.unlocked_robots.length} unlocked`} color={colors.brandPrimary} onPress={() => router.push("/(tabs)/builder")} />
          <ActionCard icon="map"   label="MAP"    sub={`${camp.level}/${config.levels.length} unlocked`} color={colors.success} onPress={() => router.push("/(tabs)/fleet")} />
          <ActionCard icon="account-hard-hat" label="COMMANDER" sub={`Stage ${camp.commander_stage}/5`} color={colors.warning} onPress={() => router.push("/(tabs)/leaderboard")} />
          <ActionCard icon="store" label="STORE" sub="Cosmetics" color="#B57BFF" onPress={() => router.push("/store")} />
        </View>

        <Text style={styles.tip}>◆ TAP BATTLE — Choose a robot, tap the battlefield to deploy. Destroy the alien core.</Text>
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

function ActionCard({ icon, label, sub, color, onPress }: { icon: string; label: string; sub: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, { borderColor: color, opacity: pressed ? 0.7 : 1 }]}>
      <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  header: { alignItems: "center", marginBottom: spacing.lg },
  title: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: 32, letterSpacing: 3 },
  subtitle: { fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 3, marginTop: 4 },

  commanderCard: {
    borderWidth: 1, borderColor: colors.brandPrimary, borderRadius: radius.md,
    padding: spacing.md, alignItems: "center", backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md, overflow: "hidden",
  },
  cmdName: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.lg, letterSpacing: 1.5, marginTop: 6, textAlign: "center" },
  cmdCode: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1.5, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  stat: { alignItems: "center", borderWidth: 1, borderColor: colors.border, padding: 6, minWidth: 70 },
  statLabel: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: 9, letterSpacing: 1 },
  statVal: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, letterSpacing: 0.5 },

  battleBtn: {
    flexDirection: "row", alignItems: "center", padding: spacing.md,
    borderRadius: radius.md, marginBottom: spacing.md, overflow: "hidden",
  },
  battleLabel: { fontFamily: fonts.displayBold, color: "#fff", fontSize: fontSize.xxl, letterSpacing: 3 },
  battleSub: { fontFamily: fonts.display, color: "rgba(255,255,255,0.8)", fontSize: fontSize.xs, letterSpacing: 1, marginTop: 2 },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: {
    width: "48%", borderWidth: 1, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, gap: 4,
  },
  actionLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 1.5, marginTop: 6 },
  actionSub: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 0.5 },

  tip: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, textAlign: "center", marginTop: spacing.lg, letterSpacing: 0.5 },
});
