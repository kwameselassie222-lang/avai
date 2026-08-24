import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, V2Campaign, V2Config } from "@/src/api";

export default function MapScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<V2Config | null>(null);
  const [camp, setCamp] = useState<V2Campaign | null>(null);
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

  if (loading || !config || !camp) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>CAMPAIGN MAP</Text>
        <Text style={styles.sub}>PUSH BACK THE ALIEN INVASION</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {config.levels.map((L, idx) => {
          const stars = camp.stars[String(L.id)] || 0;
          const unlocked = L.id <= camp.level;
          const isBoss = !!L.boss;
          return (
            <React.Fragment key={L.id}>
              <Pressable
                onPress={() => unlocked && router.push(`/battle?level=${L.id}`)}
                disabled={!unlocked}
                style={[
                  styles.level,
                  { borderColor: isBoss ? colors.brandSecondary : unlocked ? colors.brandPrimary : colors.border, opacity: unlocked ? 1 : 0.4 },
                ]}
                testID={`level-${L.id}`}
              >
                <View style={styles.levelHeader}>
                  <View style={[styles.numCircle, { borderColor: isBoss ? colors.brandSecondary : colors.brandPrimary }]}>
                    {unlocked ? (
                      <Text style={[styles.numText, { color: isBoss ? colors.brandSecondary : colors.brandPrimary }]}>{L.id}</Text>
                    ) : (
                      <MaterialCommunityIcons name="lock" size={14} color={colors.onSurfaceTertiary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.levelName}>{L.name}</Text>
                    <Text style={styles.levelMeta}>WORLD {L.world} • Target {L.target_time}s{isBoss ? " • ⚠ BOSS" : ""}</Text>
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
