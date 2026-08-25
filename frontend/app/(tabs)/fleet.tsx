import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, V2Campaign, V2Config } from "@/src/api";

const DIFF_KEY = "aliens_vai_difficulty";

export default function MapScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<V2Config | null>(null);
  const [camp, setCamp] = useState<V2Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<"normal" | "veteran">("normal");

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [p, c] = await Promise.all([api.v2Player(id), api.v2Config()]);
    setCamp(p.campaign);
    setConfig(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const d = await AsyncStorage.getItem(DIFF_KEY);
      if (d === "veteran") setDifficulty("veteran");
    })();
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleDifficulty = async () => {
    const next: "normal" | "veteran" = difficulty === "veteran" ? "normal" : "veteran";
    setDifficulty(next);
    await AsyncStorage.setItem(DIFF_KEY, next);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } catch {}
  };

  if (loading || !config || !camp) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const suffix = difficulty === "veteran" ? "&difficulty=veteran" : "";
  const isVeteran = difficulty === "veteran";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>CAMPAIGN MAP</Text>
        <Text style={styles.sub}>PUSH BACK THE ALIEN INVASION</Text>
      </View>

      {/* Difficulty selector */}
      <View style={styles.diffRow}>
        <Pressable
          onPress={toggleDifficulty}
          style={[styles.diffCard, {
            borderColor: isVeteran ? "#FF3366" : colors.brandPrimary,
            backgroundColor: isVeteran ? "rgba(255,51,102,0.10)" : "rgba(0,229,255,0.06)",
          }]}
          testID="btn-difficulty"
        >
          <View style={styles.diffHeader}>
            <MaterialCommunityIcons
              name={isVeteran ? "skull" : "shield-check"}
              size={20}
              color={isVeteran ? "#FF3366" : colors.brandPrimary}
            />
            <Text style={[styles.diffTitle, { color: isVeteran ? "#FF3366" : colors.brandPrimary }]}>
              {isVeteran ? "VETERAN MODE" : "STANDARD MODE"}
            </Text>
            <View style={[styles.toggleBox, { borderColor: isVeteran ? "#FF3366" : colors.border }]}>
              <View style={[styles.toggleDot, {
                backgroundColor: isVeteran ? "#FF3366" : colors.onSurfaceTertiary,
                alignSelf: isVeteran ? "flex-end" : "flex-start",
              }]} />
            </View>
          </View>
          <Text style={styles.diffDesc}>
            {isVeteran
              ? "◆ 2× wave density  ◆ +30% alien HP/ATK  ◆ 2× parts reward"
              : "◆ Normal wave density  ◆ Balanced combat  ◆ Base rewards  · TAP TO ENABLE VETERAN"}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {config.levels.map((L, idx) => {
          const stars = camp.stars[String(L.id)] || 0;
          const unlocked = L.id <= camp.level;
          const isBoss = !!L.boss;
          const hasSurges = (L.surges?.length || 0) > 0;
          return (
            <React.Fragment key={L.id}>
              <Pressable
                onPress={async () => {
                  if (!unlocked) return;
                  // Chapter opener gate — L1 shows the World 1 opener the first time
                  if (L.id === 1) {
                    const seen = await AsyncStorage.getItem("aliens_vai_seen_chapter_1");
                    if (seen !== "1") {
                      router.push(`/interlude?kind=chapter&id=1&level=1${suffix}`);
                      return;
                    }
                  }
                  router.push(`/story?level=${L.id}${suffix}`);
                }}
                disabled={!unlocked}
                style={[
                  styles.level,
                  { borderColor: isBoss ? colors.brandSecondary : unlocked ? (isVeteran ? "#FF3366" : colors.brandPrimary) : colors.border, opacity: unlocked ? 1 : 0.4 },
                ]}
                testID={`level-${L.id}`}
              >
                <View style={styles.levelHeader}>
                  <View style={[styles.numCircle, { borderColor: isBoss ? colors.brandSecondary : (isVeteran ? "#FF3366" : colors.brandPrimary) }]}>
                    {unlocked ? (
                      <Text style={[styles.numText, { color: isBoss ? colors.brandSecondary : (isVeteran ? "#FF3366" : colors.brandPrimary) }]}>{L.id}</Text>
                    ) : (
                      <MaterialCommunityIcons name="lock" size={14} color={colors.onSurfaceTertiary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.levelName}>{L.name}</Text>
                    <Text style={styles.levelMeta}>
                      WORLD {L.world} • Target {L.target_time}s
                      {isBoss ? " • ⚠ BOSS" : ""}
                      {hasSurges ? " • ⚡ SURGES" : ""}
                    </Text>
                  </View>
                  <View style={styles.starsRow}>
                    {[1, 2, 3].map((n) => (
                      <MaterialCommunityIcons key={n} name={n <= stars ? "star" : "star-outline"} size={14} color={n <= stars ? colors.warning : colors.onSurfaceTertiary} />
                    ))}
                  </View>
                </View>
              </Pressable>
              {idx < config.levels.length - 1 && (
                <View style={styles.connector}>
                  <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} />
                </View>
              )}
            </React.Fragment>
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
  header: { padding: spacing.lg, paddingBottom: spacing.sm, alignItems: "center" },
  title: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xl, letterSpacing: 2 },
  sub: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 2, marginTop: 4 },

  diffRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  diffCard: {
    borderWidth: 2, borderRadius: radius.md,
    padding: spacing.md,
  },
  diffHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  diffTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 2 },
  toggleBox: {
    width: 34, height: 18, borderRadius: 9, borderWidth: 1,
    padding: 2, justifyContent: "center",
  },
  toggleDot: {
    width: 12, height: 12, borderRadius: 6,
  },
  diffDesc: {
    fontFamily: fonts.body, color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs, marginTop: 6, letterSpacing: 0.5, lineHeight: 16,
  },

  scroll: { padding: spacing.lg, paddingTop: 0 },
  level: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceSecondary },
  levelHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  numCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 1 },
  levelName: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm, letterSpacing: 1.2 },
  levelMeta: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  starsRow: { flexDirection: "row", gap: 2 },
  connector: { alignItems: "center", gap: 4, paddingVertical: 6 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.onSurfaceTertiary },
});
