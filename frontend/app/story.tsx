import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, V2Story, V2Config } from "@/src/api";

const SEEN_INTRO_PREFIX = "aliens_vai_seen_intro_";
const PAGE_SFX = require("../assets/sfx/deploy.wav");

// Alien-type icons for threat panel
const ALIEN_ICONS: Record<string, string> = {
  crawler: "bug", spitter: "chemical-weapon", brute: "shield-alert",
  flyer: "quadcopter", hive_queen: "alien",
};
const ALIEN_LABELS: Record<string, string> = {
  crawler: "CRAWLER", spitter: "SPITTER", brute: "BRUTE",
  flyer: "FLYER", hive_queen: "HIVE QUEEN",
};

export default function StoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string; force?: string; flavor?: string; difficulty?: string }>();
  const levelId = Number(params.level || 1);
  const force = params.force === "1";
  const flavorReq = params.flavor === "1";
  const difficulty: "normal" | "veteran" = params.difficulty === "veteran" ? "veteran" : "normal";

  const [story, setStory] = useState<V2Story | null>(null);
  const [config, setConfig] = useState<V2Config | null>(null);
  const [panelIdx, setPanelIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const pageSfx = useAudioPlayer(PAGE_SFX);

  // Always show story (no auto-skip). Fetch story data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch base story (fast) first
        const [s, c] = await Promise.all([api.v2Story(levelId, false), api.v2Config()]);
        if (cancelled) return;
        setStory(s);
        setConfig(c);
        setLoading(false);
        // Kick off Gemini flavor async (only for replays) — updates flavor_line when ready
        if (flavorReq) {
          api.v2Story(levelId, true).then((s2) => {
            if (cancelled) return;
            if (s2.flavor_line) {
              setStory((prev) => (prev ? { ...prev, flavor_line: s2.flavor_line } : s2));
            }
          }).catch(() => { /* silently skip on failure */ });
        }
      } catch (e) {
        // fallback — go directly to battle if intro can't load
        console.warn("story load failed", e);
        router.replace(`/battle?level=${levelId}${difficulty === "veteran" ? "&difficulty=veteran" : ""}`);
      }
    })();
    return () => { cancelled = true; };
  }, [levelId, force, flavorReq, difficulty, router]);

  // Panel entrance animation
  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (!loading && story) animateIn();
  }, [loading, story, panelIdx, animateIn]);

  const next = async () => {
    try { Haptics.selectionAsync().catch(() => {}); } catch {}
    try { pageSfx.volume = 0.35; pageSfx.seekTo(0); pageSfx.play(); } catch {}
    if (!story) return;
    if (panelIdx < story.panels.length - 1) {
      setPanelIdx((n) => n + 1);
    } else {
      await AsyncStorage.setItem(`${SEEN_INTRO_PREFIX}${levelId}`, "1");
      router.replace(`/battle?level=${levelId}${difficulty === "veteran" ? "&difficulty=veteran" : ""}`);
    }
  };

  const skip = async () => {
    try { Haptics.selectionAsync().catch(() => {}); } catch {}
    await AsyncStorage.setItem(`${SEEN_INTRO_PREFIX}${levelId}`, "1");
    router.replace(`/battle?level=${levelId}${difficulty === "veteran" ? "&difficulty=veteran" : ""}`);
  };

  if (loading || !story || !config) {
    return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const level = config.levels.find((L) => L.id === levelId);
  const enemyTypes = Array.from(new Set([
    ...(level?.waves.map((w) => w.type) || []),
    ...(level?.boss ? [level.boss] : []),
  ]));

  const panel = story.panels[panelIdx];
  const totalPanels = story.panels.length;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#100208", "#0A0F1F", "#050810"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Scanlines effect */}
      <View style={styles.scanlines} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.locBadge}>
            <MaterialCommunityIcons name="map-marker" size={14} color={colors.brandSecondary} />
            <Text style={styles.locText}>{story.location}</Text>
          </View>
          <Text style={styles.timeText}>{story.time_stamp}</Text>
          <Pressable onPress={skip} style={styles.skipBtn} testID="story-skip">
            <Text style={styles.skipText}>SKIP</Text>
            <MaterialCommunityIcons name="chevron-double-right" size={14} color={colors.onSurfaceTertiary} />
          </Pressable>
        </View>

        {/* Mission title */}
        <View style={styles.titleBlock}>
          {story.chapter && <Text style={styles.chapterLabel}>{story.chapter}</Text>}
          <Text style={styles.opLabel}>OPERATION {String(levelId).padStart(2, "0")}</Text>
          <Text style={styles.mission}>{story.tagline.toUpperCase()}</Text>
          <View style={styles.divider} />
        </View>

        {/* Comic panel */}
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Previously... callback */}
          {story.previously && panelIdx === 0 && (
            <View style={styles.previouslyBox}>
              <View style={styles.previouslyHeader}>
                <MaterialCommunityIcons name="rewind" size={14} color={colors.brandPrimary} />
                <Text style={styles.previouslyLabel}>◆ PREVIOUSLY ON A.I. UNIT ONE</Text>
              </View>
              <Text style={styles.previouslyLine}>{story.previously}</Text>
            </View>
          )}
          {/* AI-generated flavor line (replays only) */}
          {story.flavor_line ? (
            <View style={styles.flavorBox}>
              <View style={styles.flavorHeader}>
                <MaterialCommunityIcons name="broadcast" size={14} color={colors.warning} />
                <Text style={styles.flavorLabel}>◆ FRESH INTEL — A.I. NARRATIVE CORE</Text>
              </View>
              {story.flavor_line.split("\n").filter((l) => l.trim()).map((line, i) => (
                <Text key={i} style={styles.flavorLine}>
                  {line.trim().replace(/\*\*/g, "").replace(/^[-*•]\s*/, "")}
                </Text>
              ))}
            </View>
          ) : flavorReq ? (
            <View style={[styles.flavorBox, { opacity: 0.6 }]}>
              <View style={styles.flavorHeader}>
                <ActivityIndicator size="small" color={colors.warning} />
                <Text style={styles.flavorLabel}>◆ INTERCEPTING FIELD INTEL...</Text>
              </View>
              <Text style={styles.flavorLine}>A.I. NARRATIVE CORE COMPILING</Text>
            </View>
          ) : null}

          <Animated.View
            style={[
              styles.panel,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
            key={panelIdx}
          >
            <View style={styles.panelHeaderRow}>
              <View style={styles.panelBadge}>
                <Text style={styles.panelBadgeText}>{panelIdx + 1}/{totalPanels}</Text>
              </View>
              <Text style={styles.panelHeader}>{panel.header}</Text>
            </View>
            {panel.body.split("\n").map((line, i) => (
              <Text key={i} style={[
                styles.panelLine,
                line.startsWith("— ") && styles.panelSignoff,
              ]}>
                {line}
              </Text>
            ))}
          </Animated.View>

          {/* Threat analysis panel (only on last panel) */}
          {panelIdx === totalPanels - 1 && enemyTypes.length > 0 && (
            <Animated.View style={[styles.threatBox, { opacity: fadeAnim }]}>
              <Text style={styles.threatLabel}>◆ INCOMING HOSTILES</Text>
              <View style={styles.threatRow}>
                {enemyTypes.map((t) => (
                  <View key={t} style={[
                    styles.threatChip,
                    t === "hive_queen" && { borderColor: colors.brandSecondary, backgroundColor: "rgba(255,51,102,0.12)" },
                  ]}>
                    <MaterialCommunityIcons
                      name={(ALIEN_ICONS[t] as any) || "alien"}
                      size={20}
                      color={t === "hive_queen" ? colors.brandSecondary : colors.warning}
                    />
                    <Text style={[
                      styles.threatChipText,
                      t === "hive_queen" && { color: colors.brandSecondary },
                    ]}>{ALIEN_LABELS[t] || t.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Next teaser (last panel only) */}
          {story.next_teaser && panelIdx === totalPanels - 1 && (
            <Animated.View style={[styles.teaserBox, { opacity: fadeAnim }]}>
              <Text style={styles.teaserText}>{story.next_teaser}</Text>
            </Animated.View>
          )}
        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.bottomBar}>
          {/* Panel dots */}
          <View style={styles.dots}>
            {story.panels.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === panelIdx ? colors.brandPrimary : colors.border },
                ]}
              />
            ))}
          </View>
          <Pressable onPress={next} style={styles.cta} testID="story-next">
            <Text style={styles.ctaText}>
              {panelIdx < totalPanels - 1 ? "NEXT" : "DEPLOY"}
            </Text>
            <MaterialCommunityIcons
              name={panelIdx < totalPanels - 1 ? "arrow-right-bold" : "rocket-launch"}
              size={18}
              color={colors.onBrandPrimary}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050810" },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  safe: { flex: 1 },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    backgroundColor: "transparent",
  },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  locBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.brandSecondary,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: "rgba(255,51,102,0.08)",
  },
  locText: {
    fontFamily: fonts.displayBold, color: colors.brandSecondary,
    fontSize: 10, letterSpacing: 1.5,
  },
  timeText: {
    flex: 1, textAlign: "center",
    fontFamily: fonts.mono, color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs, letterSpacing: 1,
  },
  skipBtn: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 6, paddingVertical: 4,
  },
  skipText: {
    fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary,
    fontSize: 10, letterSpacing: 1.5,
  },
  titleBlock: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  chapterLabel: {
    fontFamily: fonts.displayBold, color: colors.brandSecondary,
    fontSize: 10, letterSpacing: 3, marginBottom: 6,
  },
  opLabel: {
    fontFamily: fonts.displayBold, color: colors.brandPrimary,
    fontSize: 10, letterSpacing: 3, marginBottom: 4,
  },
  mission: {
    fontFamily: fonts.displayBold, color: colors.onSurface,
    fontSize: fontSize.xxxl, letterSpacing: 3, lineHeight: 36,
  },
  divider: {
    height: 2, backgroundColor: colors.brandPrimary,
    width: 60, marginTop: spacing.sm,
  },
  scroll: { padding: spacing.lg, paddingTop: 0 },

  previouslyBox: {
    borderLeftWidth: 3, borderLeftColor: colors.brandPrimary,
    paddingLeft: spacing.md, paddingVertical: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: "rgba(0,229,255,0.05)",
  },
  previouslyHeader: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginBottom: 4,
  },
  previouslyLabel: {
    fontFamily: fonts.displayBold, color: colors.brandPrimary,
    fontSize: 10, letterSpacing: 1.5,
  },
  previouslyLine: {
    fontFamily: fonts.body, color: colors.onSurface,
    fontSize: fontSize.sm, lineHeight: 20, fontStyle: "italic",
  },

  teaserBox: {
    marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.brandSecondary,
    paddingTop: spacing.md,
  },
  teaserText: {
    fontFamily: fonts.displayBold, color: colors.brandSecondary,
    fontSize: fontSize.sm, letterSpacing: 1, textAlign: "center", lineHeight: 20,
  },

  flavorBox: {
    borderWidth: 1, borderColor: colors.warning,
    padding: spacing.md, marginTop: spacing.md,
    backgroundColor: "rgba(255,176,32,0.08)",
    borderStyle: "dashed",
  },
  flavorHeader: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginBottom: spacing.sm,
  },
  flavorLabel: {
    fontFamily: fonts.displayBold, color: colors.warning,
    fontSize: 10, letterSpacing: 1.5,
  },
  flavorLine: {
    fontFamily: fonts.mono, color: colors.onSurface,
    fontSize: fontSize.sm, lineHeight: 20,
    marginBottom: 2,
  },

  panel: {
    borderWidth: 3, borderColor: colors.onSurface, backgroundColor: colors.surface,
    padding: spacing.lg, marginTop: spacing.md,
    shadowColor: colors.brandPrimary, shadowOpacity: 0.35, shadowRadius: 8,
    // slight bg tone to feel comic-panel-y
    borderRadius: 2,
  },
  panelHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginBottom: spacing.md,
  },
  panelBadge: {
    borderWidth: 2, borderColor: colors.brandPrimary,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: colors.brandPrimary,
  },
  panelBadgeText: {
    fontFamily: fonts.displayBold, color: colors.onBrandPrimary,
    fontSize: 10, letterSpacing: 1.5,
  },
  panelHeader: {
    flex: 1,
    fontFamily: fonts.displayBold, color: colors.brandPrimary,
    fontSize: fontSize.xl, letterSpacing: 3,
  },
  panelLine: {
    fontFamily: fonts.displayBold, color: colors.onSurface,
    fontSize: fontSize.lg, lineHeight: 26, letterSpacing: 0.5,
    marginBottom: 4,
  },
  panelSignoff: {
    fontFamily: fonts.displayBold, color: colors.warning,
    fontSize: fontSize.sm, letterSpacing: 2, marginTop: spacing.sm,
  },
  threatBox: {
    marginTop: spacing.lg, borderWidth: 1, borderColor: colors.warning,
    padding: spacing.md, backgroundColor: "rgba(255,176,32,0.08)",
    borderRadius: 2,
  },
  threatLabel: {
    fontFamily: fonts.displayBold, color: colors.warning,
    fontSize: 10, letterSpacing: 2, marginBottom: spacing.sm,
  },
  threatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  threatChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.warning,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: colors.surfaceSecondary,
  },
  threatChipText: {
    fontFamily: fonts.displayBold, color: colors.warning,
    fontSize: 10, letterSpacing: 1.5,
  },

  bottomBar: {
    padding: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  dots: {
    flexDirection: "row", justifyContent: "center", gap: 6,
    marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.md, borderRadius: radius.md,
    shadowColor: colors.brandPrimary, shadowOpacity: 0.5, shadowRadius: 8,
  },
  ctaText: {
    fontFamily: fonts.displayBold, color: colors.onBrandPrimary,
    fontSize: fontSize.base, letterSpacing: 3,
  },
});
