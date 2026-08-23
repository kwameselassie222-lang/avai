import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage } from "@/src/api";
import { TerminalHeader } from "@/src/components/hud";

type Row = {
  id: string;
  codename: string;
  level: number;
  score: number;
  victories: number;
  defeats: number;
};

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, id] = await Promise.all([api.leaderboard(), storage.getPlayerId()]);
      setRows(list);
      setSelfId(id);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        testID="leaderboard-header"
        title="COMMANDER RANKS"
        subtitle="GLOBAL AI DEFENSE INDEX"
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="trophy-broken" size={64} color={colors.onSurfaceTertiary} />
          <Text style={styles.emptyTitle}>NO COMMANDERS RANKED</Text>
          <Text style={styles.emptySub}>Engage a threat to enter the index.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const isSelf = item.id === selfId;
            const rankColor =
              rank === 1
                ? colors.brandPrimary
                : rank === 2
                ? colors.warning
                : rank === 3
                ? colors.success
                : colors.onSurfaceTertiary;
            return (
              <View
                style={[
                  styles.row,
                  {
                    borderColor: isSelf ? colors.brandPrimary : colors.border,
                    backgroundColor: isSelf ? colors.brandTertiary : colors.surfaceSecondary,
                  },
                ]}
                testID={`rank-row-${rank}`}
              >
                <Text style={[styles.rankNum, { color: rankColor }]}>#{String(rank).padStart(2, "0")}</Text>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.codename}>
                    {item.codename.toUpperCase()}
                    {isSelf ? "  ◂ YOU" : ""}
                  </Text>
                  <Text style={styles.meta}>
                    LVL {item.level} • GEN {item.generation ?? 1} • {item.victories}W/{item.defeats}L
                  </Text>
                </View>
                <Text style={styles.score}>{item.score.toLocaleString()}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  list: { padding: spacing.lg, paddingTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  rankNum: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xl,
    letterSpacing: 1.5,
    width: 44,
  },
  codename: {
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    fontSize: fontSize.lg,
    letterSpacing: 1.5,
  },
  meta: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: 1,
  },
  score: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.xl,
    letterSpacing: 1,
  },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    fontSize: fontSize.xl,
    letterSpacing: 2,
    marginTop: spacing.md,
  },
  emptySub: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
});
