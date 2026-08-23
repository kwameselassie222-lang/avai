import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import {
  api,
  storage,
  CATALOG,
  CatalogCategory,
  computeStats,
  Player,
  GEN_UNLOCK_RESEARCH,
} from "@/src/api";
import { HudPanel, StatBar, TerminalHeader, HudButton, Chip } from "@/src/components/hud";

const ROBOT_IMG =
  "https://images.unsplash.com/photo-1654009603731-20b6d7536002?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

const CATEGORIES: { key: CatalogCategory; label: string }[] = [
  { key: "chassis", label: "Chassis" },
  { key: "mobility", label: "Mobility" },
  { key: "armor", label: "Armor" },
  { key: "weapon", label: "Weapon" },
  { key: "sensor", label: "Sensor" },
  { key: "ai_module", label: "AI Mod" },
];

export default function Builder() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [activeCat, setActiveCat] = useState<CatalogCategory>("chassis");
  const [selection, setSelection] = useState<Record<CatalogCategory, string>>({
    chassis: "humanoid",
    mobility: "legs",
    armor: "steel",
    weapon: "railgun",
    sensor: "optical",
    ai_module: "hunter",
  });
  const [name, setName] = useState("UNIT-01");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const stats = useMemo(() => computeStats(selection), [selection]);

  const loadPlayer = useCallback(async () => {
    const pid = await storage.getPlayerId();
    if (!pid) {
      router.replace("/");
      return;
    }
    try {
      const p = await api.getPlayer(pid);
      setPlayer(p);
    } catch (e) {
      console.warn(e);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadPlayer();
    }, [loadPlayer])
  );

  const genLocked = player ? stats.gen > player.generation : false;
  const notEnoughMat = player ? player.resources.materials < stats.cost.materials : false;
  const notEnoughComp = player ? player.resources.compute < stats.cost.compute : false;
  const canBuild = !genLocked && !notEnoughMat && !notEnoughComp && !!name.trim();

  const save = async () => {
    if (!player) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const robot = await api.createRobot({
        player_id: player.id,
        name: name.trim() || "UNIT-01",
        ...selection,
      });
      setSavedMsg({ text: `${robot.name} DEPLOYED (GEN ${robot.generation})`, ok: true });
      // refresh resources
      const p = await api.getPlayer(player.id);
      setPlayer(p);
    } catch (e: any) {
      setSavedMsg({ text: String(e.message || "BUILD FAILED").slice(0, 80), ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 3200);
    }
  };

  const partLocked = (gen: number) => player && gen > player.generation;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        testID="builder-header"
        title="ROBOT BUILDER"
        subtitle={`PWR ${stats.power} · GEN ${stats.gen}${player ? ` · YOU: GEN ${player.generation}` : ""}`}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.chassisPreview}>
            <Image
              source={{ uri: ROBOT_IMG }}
              style={styles.chassisImg}
              contentFit="cover"
            />
            <LinearGradient
              colors={["rgba(9,10,13,0.1)", "rgba(9,10,13,0.9)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.previewOverlay}>
              <View style={styles.genPill}>
                <Text style={styles.genPillText}>GEN {stats.gen}</Text>
              </View>
              <Text style={styles.previewName}>{name.toUpperCase()}</Text>
              <Text style={styles.previewSub}>
                {selection.chassis.toUpperCase()} • {selection.weapon.toUpperCase()} • {selection.ai_module.toUpperCase()}
              </Text>
            </View>
          </View>

          <TextInput
            testID="robot-name-input"
            value={name}
            onChangeText={setName}
            placeholder="ROBOT NAME"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.nameInput}
            autoCapitalize="characters"
            maxLength={20}
          />

          <HudPanel style={{ marginBottom: spacing.md }} testID="stat-panel">
            <StatBar label="Atk" value={stats.attack} max={60} color={colors.brandSecondary} testID="stat-attack" />
            <StatBar label="Def" value={stats.defense} max={60} color={colors.brandPrimary} testID="stat-defense" />
            <StatBar label="Spd" value={stats.speed} max={60} color={colors.success} testID="stat-speed" />
            <StatBar label="Tech" value={stats.tech} max={60} color={colors.warning} testID="stat-tech" />
          </HudPanel>

          {/* Cost + gen lock warning */}
          <View style={styles.costRow} testID="cost-row">
            <View style={styles.costCell}>
              <MaterialCommunityIcons name="cube-outline" size={14} color={notEnoughMat ? colors.brandSecondary : colors.brandPrimary} />
              <Text style={[styles.costText, { color: notEnoughMat ? colors.brandSecondary : colors.brandPrimary }]}>
                {stats.cost.materials} MAT
              </Text>
            </View>
            <View style={styles.costCell}>
              <MaterialCommunityIcons name="chip" size={14} color={notEnoughComp ? colors.brandSecondary : colors.success} />
              <Text style={[styles.costText, { color: notEnoughComp ? colors.brandSecondary : colors.success }]}>
                {stats.cost.compute} CPU
              </Text>
            </View>
            {player && (
              <View style={styles.costCell}>
                <MaterialCommunityIcons name="atom" size={14} color={colors.brandSecondary} />
                <Text style={[styles.costText, { color: colors.brandSecondary }]}>
                  {player.resources.research}/{GEN_UNLOCK_RESEARCH[player.generation + 1] || "MAX"}
                </Text>
              </View>
            )}
          </View>

          {genLocked && (
            <View style={styles.warnBanner} testID="gen-lock-warning">
              <MaterialCommunityIcons name="lock" size={14} color={colors.brandSecondary} />
              <Text style={styles.warnText}>
                GEN {stats.gen} LOCKED — RESEARCH {GEN_UNLOCK_RESEARCH[stats.gen]} REQUIRED
              </Text>
            </View>
          )}

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {CATEGORIES.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                selected={activeCat === c.key}
                onPress={() => setActiveCat(c.key)}
                testID={`cat-${c.key}`}
              />
            ))}
          </ScrollView>

          {/* Parts grid */}
          <View style={styles.partsGrid} testID="parts-grid">
            {CATALOG[activeCat].map((part) => {
              const selected = selection[activeCat] === part.key;
              const locked = partLocked(part.gen);
              return (
                <Pressable
                  key={part.key}
                  onPress={() => {
                    if (locked) return;
                    setSelection((s) => ({ ...s, [activeCat]: part.key }));
                  }}
                  testID={`part-${part.key}`}
                  style={[
                    styles.partCard,
                    {
                      borderColor: selected
                        ? colors.brandPrimary
                        : locked
                        ? colors.border
                        : colors.border,
                      backgroundColor: selected
                        ? colors.brandTertiary
                        : colors.surfaceSecondary,
                      opacity: locked ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.partGenBadge}>
                    <Text
                      style={[
                        styles.partGenText,
                        { color: locked ? colors.brandSecondary : colors.brandPrimary },
                      ]}
                    >
                      G{part.gen}
                    </Text>
                  </View>
                  {locked && (
                    <View style={styles.lockOverlay}>
                      <MaterialCommunityIcons name="lock" size={16} color={colors.brandSecondary} />
                    </View>
                  )}
                  <MaterialCommunityIcons
                    name={part.icon as any}
                    size={28}
                    color={
                      locked
                        ? colors.onSurfaceTertiary
                        : selected
                        ? colors.brandPrimary
                        : colors.onSurfaceSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.partLabel,
                      {
                        color: locked
                          ? colors.onSurfaceTertiary
                          : selected
                          ? colors.brandPrimary
                          : colors.onSurface,
                      },
                    ]}
                  >
                    {part.label.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {savedMsg ? (
            <Text
              style={[styles.savedMsg, { color: savedMsg.ok ? colors.success : colors.brandSecondary }]}
              testID="saved-toast"
            >
              {savedMsg.ok ? "✔ " : "✖ "}{savedMsg.text}
            </Text>
          ) : null}

          <HudButton
            testID="save-robot-button"
            label={saving ? "BUILDING..." : "MANUFACTURE UNIT"}
            onPress={save}
            disabled={saving || !canBuild}
            style={{ marginTop: spacing.lg }}
          />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingTop: spacing.md },
  chassisPreview: {
    height: 200,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  chassisImg: { width: "100%", height: "100%" },
  previewOverlay: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    right: spacing.md,
  },
  genPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: spacing.xs,
    backgroundColor: "rgba(0,229,255,0.15)",
  },
  genPillText: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
  },
  previewName: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.xxl,
    letterSpacing: 2,
  },
  previewSub: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    marginTop: 2,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    padding: spacing.md,
    letterSpacing: 2,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  costRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  costCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
  },
  costText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    padding: spacing.sm,
    backgroundColor: "rgba(255,51,102,0.08)",
    marginBottom: spacing.md,
  },
  warnText: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
  },
  catRow: {
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingBottom: spacing.md,
  },
  partsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  partCard: {
    width: "31%",
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    position: "relative",
  },
  partGenBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  partGenText: {
    fontFamily: fonts.displayBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  lockOverlay: {
    position: "absolute",
    top: 4,
    left: 4,
  },
  partLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  savedMsg: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
