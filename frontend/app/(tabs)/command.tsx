import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, Player, Threat, ALIEN_CLASS_META, GEN_UNLOCK_RESEARCH } from "@/src/api";
import { HudPanel, TerminalHeader, HudButton } from "@/src/components/hud";

const MAP_URL =
  "https://images.pexels.com/photos/12381327/pexels-photo-12381327.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function CommandCenter() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const id = await storage.getPlayerId();
      if (!id) {
        router.replace("/");
        return;
      }
      const p = await api.getPlayer(id);
      const ts = await api.listThreats(4, p.level);
      setPlayer(p);
      setThreats(ts);
    } catch (e) {
      console.warn("load command failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const deploy = (threat: Threat) => {
    router.push({
      pathname: "/combat",
      params: { threat: JSON.stringify(threat) },
    });
  };

  if (loading || !player) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const nextGenTarget = GEN_UNLOCK_RESEARCH[player.generation + 1];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        testID="command-header"
        title={`CMDR ${player.codename}`}
        subtitle={`LVL ${player.level}  •  XP ${player.xp}  •  GEN ${player.generation}`}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Resource panel */}
        <View style={styles.resourceRow} testID="resource-row">
          <ResourceCell icon="lightning-bolt" label="ENERGY" value={player.resources.energy} max={100} color={colors.warning} />
          <ResourceCell icon="cube-outline" label="MATER" value={player.resources.materials} color={colors.brandPrimary} />
          <ResourceCell icon="chip" label="COMP" value={player.resources.compute} color={colors.success} />
          <ResourceCell icon="atom" label="RSRCH" value={player.resources.research} color={colors.brandSecondary} />
        </View>

        {/* Generation progress */}
        {nextGenTarget && (
          <HudPanel style={styles.genPanel} accent="cyan" testID="gen-panel">
            <View style={styles.genHeader}>
              <MaterialCommunityIcons name="progress-upload" size={16} color={colors.brandPrimary} />
              <Text style={styles.genTitle}>NEXT GEN {player.generation + 1} UNLOCK</Text>
              <Text style={styles.genValue}>
                {player.resources.research}/{nextGenTarget}
              </Text>
            </View>
            <View style={styles.genBar}>
              <View
                style={[
                  styles.genFill,
                  { width: `${Math.min(100, (player.resources.research / nextGenTarget) * 100)}%` },
                ]}
              />
            </View>
          </HudPanel>
        )}

        <View style={styles.mapWrap}>
          <Image source={{ uri: MAP_URL }} style={styles.map} contentFit="cover" />
          <LinearGradient
            colors={["rgba(0,229,255,0.05)", "rgba(9,10,13,0.95)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.mapOverlay}>
            <Text style={styles.mapTitle}>GLOBAL THREAT MAP</Text>
            <Text style={styles.mapSub}>
              {threats.length} ACTIVE INCURSIONS • REAL-TIME SCAN
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle} testID="threats-title">
          ▮ ACTIVE THREATS
        </Text>

        {threats.map((t) => {
          const meta = ALIEN_CLASS_META[t.alien_class];
          return (
            <HudPanel
              key={t.id}
              accent="magenta"
              style={styles.threatCard}
              testID={`threat-card-${t.alien_class}`}
            >
              <View style={styles.threatHeader}>
                <View style={styles.classBadge} testID={`class-${t.alien_class}`}>
                  <MaterialCommunityIcons name={meta.icon as any} size={18} color={meta.color} />
                  <Text style={[styles.classBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.classTag}>{meta.tag}</Text>
              </View>
              <View style={styles.threatBody}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.threatName}>{t.name.toUpperCase()}</Text>
                  <Text style={styles.threatLoc}>
                    <MaterialCommunityIcons name="map-marker" size={12} color={colors.brandSecondary} />{" "}
                    {t.location} • CLASS {t.threat_level}
                  </Text>
                </View>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>{t.threat_level}</Text>
                </View>
              </View>
              <Text style={styles.threatDesc} numberOfLines={3}>
                {t.description}
              </Text>
              <View style={styles.threatFooter}>
                <View style={styles.rewardRow}>
                  <Text style={styles.rewardText}>+{t.reward_xp} XP</Text>
                  <Text style={[styles.rewardText, { color: colors.brandPrimary }]}>+{t.reward_materials}▣</Text>
                  <Text style={[styles.rewardText, { color: colors.brandSecondary }]}>+{t.reward_research}⚛</Text>
                </View>
                <HudButton
                  label="ENGAGE"
                  variant="danger"
                  compact
                  onPress={() => deploy(t)}
                  testID={`engage-${t.alien_class}`}
                />
              </View>
            </HudPanel>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ResourceCell({
  icon,
  label,
  value,
  max,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  max?: number;
  color: string;
}) {
  return (
    <View style={styles.resCell} testID={`res-${label.toLowerCase()}`}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={styles.resLabel}>{label}</Text>
      <Text style={[styles.resValue, { color }]}>
        {value}
        {max ? <Text style={styles.resMax}>/{max}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { padding: spacing.lg, paddingTop: spacing.md },
  resourceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.xs,
    alignItems: "center",
    borderRadius: radius.md,
  },
  resLabel: {
    fontFamily: fonts.display,
    color: colors.onSurfaceTertiary,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },
  resValue: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.base,
    letterSpacing: 0.5,
  },
  resMax: {
    fontFamily: fonts.display,
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
  },
  genPanel: { marginBottom: spacing.lg, paddingVertical: spacing.sm },
  genHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  genTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
    flex: 1,
  },
  genValue: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.sm,
    letterSpacing: 1,
  },
  genBar: {
    height: 4,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  genFill: { height: 4, backgroundColor: colors.brandPrimary },
  mapWrap: {
    height: 180,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  map: { width: "100%", height: "100%" },
  mapOverlay: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    right: spacing.md,
  },
  mapTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.xl,
    letterSpacing: 2,
  },
  mapSub: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.lg,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  threatCard: { marginBottom: spacing.md, paddingTop: spacing.sm },
  threatHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    justifyContent: "space-between",
  },
  classBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  classBadgeText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
  },
  classTag: {
    fontFamily: fonts.display,
    color: colors.onSurfaceTertiary,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  threatBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  threatName: {
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    fontSize: fontSize.lg,
    letterSpacing: 1.5,
  },
  threatLoc: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,51,102,0.1)",
  },
  levelBadgeText: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.xl,
  },
  threatDesc: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  threatFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  rewardRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  rewardText: {
    fontFamily: fonts.displayBold,
    color: colors.warning,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },
});
