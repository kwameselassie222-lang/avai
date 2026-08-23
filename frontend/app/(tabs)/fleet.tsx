import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, Robot } from "@/src/api";
import { HudPanel, TerminalHeader, HudButton, StatPill } from "@/src/components/hud";

export default function Fleet() {
  const router = useRouter();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pid = await storage.getPlayerId();
      if (!pid) {
        router.replace("/");
        return;
      }
      const list = await api.listRobots(pid);
      setRobots(list);
    } catch (e) {
      console.warn("fleet load", e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const dismantle = async (id: string) => {
    await api.deleteRobot(id);
    setRobots((r) => r.filter((x) => x.id !== id));
  };

  const goDeploy = () => router.push("/(tabs)/command");
  const goBuild = () => router.push("/(tabs)/builder");

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        testID="fleet-header"
        title="FLEET HANGAR"
        subtitle={`${robots.length} UNITS ONLINE`}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : robots.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="robot-off"
            size={64}
            color={colors.onSurfaceTertiary}
          />
          <Text style={styles.emptyTitle}>HANGAR EMPTY</Text>
          <Text style={styles.emptySub}>
            No manufactured units detected.{"\n"}Assemble your first defender.
          </Text>
          <HudButton
            testID="empty-build-button"
            label="OPEN BUILDER"
            onPress={goBuild}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : (
        <FlatList
          data={robots}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <HudPanel
              accent="cyan"
              style={styles.card}
              testID={`robot-card-${item.name.replace(/\s+/g, "-")}`}
            >
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="robot-happy"
                  size={32}
                  color={colors.brandPrimary}
                />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.robotName}>{item.name.toUpperCase()}</Text>
                    <View style={styles.genTag} testID={`gen-${item.name.replace(/\s+/g, "-")}`}>
                      <Text style={styles.genTagText}>GEN {item.generation}</Text>
                    </View>
                  </View>
                  <Text style={styles.robotSpec}>
                    {item.chassis.toUpperCase()} • {item.weapon.toUpperCase()} •{" "}
                    {item.ai_module.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.powerBadge}>
                  <Text style={styles.powerLabel}>PWR</Text>
                  <Text style={styles.powerValue}>{item.power}</Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <StatPill label="ATK" value={item.attack} color={colors.brandSecondary} />
                <StatPill label="DEF" value={item.defense} color={colors.brandPrimary} />
                <StatPill label="SPD" value={item.speed} color={colors.success} />
                <StatPill label="TECH" value={item.tech} color={colors.warning} />
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => dismantle(item.id)}
                  style={styles.dismantle}
                  testID={`dismantle-${item.name.replace(/\s+/g, "-")}`}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.brandSecondary} />
                  <Text style={styles.dismantleText}>DISMANTLE</Text>
                </Pressable>
                <HudButton
                  compact
                  label="DEPLOY"
                  onPress={goDeploy}
                  testID={`deploy-${item.name.replace(/\s+/g, "-")}`}
                />
              </View>
            </HudPanel>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  list: { padding: spacing.lg, paddingTop: spacing.md },
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
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  card: { marginBottom: spacing.md },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  robotName: {
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    fontSize: fontSize.lg,
    letterSpacing: 1.5,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  genTag: {
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: "rgba(0,229,255,0.1)",
  },
  genTagText: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: 10,
    letterSpacing: 1,
  },
  robotSpec: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: 1,
  },
  powerBadge: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.xs,
    alignItems: "center",
    minWidth: 56,
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  powerLabel: {
    fontFamily: fonts.display,
    color: colors.onSurfaceTertiary,
    fontSize: 9,
    letterSpacing: 1,
  },
  powerValue: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.xl,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dismantle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: spacing.sm,
  },
  dismantleText: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
  },
});
