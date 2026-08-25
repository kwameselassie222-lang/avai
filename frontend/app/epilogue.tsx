import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, V2Epilogue } from "@/src/api";

const WIN_SFX = require("../assets/sfx/win.wav");

export default function EpilogueScreen() {
  const router = useRouter();
  const [ep, setEp] = useState<V2Epilogue | null>(null);
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const winSfx = useAudioPlayer(WIN_SFX);
  const played = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await api.v2StoryEpilogue();
        setEp(e);
      } catch (err) {
        console.warn("epilogue failed", err);
        router.replace("/(tabs)/command");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!ep) return;
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.85);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start();
    if (idx === 0 && !played.current) {
      played.current = true;
      try {
        winSfx.volume = 0.6;
        winSfx.seekTo(0);
        winSfx.play();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {}
    } else {
      try { Haptics.selectionAsync().catch(() => {}); } catch {}
    }
  }, [idx, ep, fadeAnim, scaleAnim, winSfx]);

  if (!ep) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const panel = ep.panels[idx];
  const isLast = idx === ep.panels.length - 1;

  const next = () => {
    if (!isLast) {
      setIdx((n) => n + 1);
    } else {
      router.replace("/(tabs)/command");
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#001820", "#0A0F1F", "#050810"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="star-four-points" size={28} color={colors.brandPrimary} />
          <Text style={styles.title}>{ep.title}</Text>
          <Text style={styles.sub}>CAMPAIGN COMPLETE</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.body}>
          <Animated.View
            key={idx}
            style={[styles.panel, {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }]}
          >
            <View style={styles.panelBadge}>
              <Text style={styles.panelBadgeText}>{idx + 1} / {ep.panels.length}</Text>
            </View>
            <Text style={styles.panelHeader}>{panel.header}</Text>
            <View style={styles.panelDivider} />
            {panel.body.split("\n").map((line, i) => (
              <Text key={i} style={styles.panelLine}>{line}</Text>
            ))}
          </Animated.View>

          {isLast && (
            <Animated.View style={[styles.medal, { opacity: fadeAnim }]}>
              <MaterialCommunityIcons name="medal" size={48} color={colors.warning} />
              <Text style={styles.medalText}>EARTH SAVED</Text>
              <Text style={styles.medalSub}>A.I. UNIT ONE — GENESIS COMMENDATION</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.dots}>
            {ep.panels.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === idx ? colors.brandPrimary : colors.border }]}
              />
            ))}
          </View>
          <Pressable onPress={next} style={styles.cta} testID="epilogue-next">
            <Text style={styles.ctaText}>{isLast ? "RETURN HOME" : "CONTINUE"}</Text>
            <MaterialCommunityIcons
              name={isLast ? "home" : "arrow-right-bold"}
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
  header: { alignItems: "center", padding: spacing.xl },
  title: {
    fontFamily: fonts.displayBold, color: colors.brandPrimary,
    fontSize: fontSize.xxxl, letterSpacing: 6, marginTop: spacing.sm,
    textShadowColor: colors.brandPrimary, textShadowRadius: 12,
  },
  sub: {
    fontFamily: fonts.displayBold, color: colors.onSurfaceSecondary,
    fontSize: 10, letterSpacing: 4, marginTop: 4,
  },
  divider: {
    height: 2, backgroundColor: colors.brandPrimary,
    width: 80, marginTop: spacing.md,
  },
  body: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  panel: {
    borderWidth: 3, borderColor: colors.onSurface, backgroundColor: colors.surface,
    padding: spacing.lg, borderRadius: 2,
    shadowColor: colors.brandPrimary, shadowOpacity: 0.4, shadowRadius: 12,
  },
  panelBadge: {
    alignSelf: "flex-start", borderWidth: 2, borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 6, paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  panelBadgeText: {
    fontFamily: fonts.displayBold, color: colors.onBrandPrimary,
    fontSize: 10, letterSpacing: 1.5,
  },
  panelHeader: {
    fontFamily: fonts.displayBold, color: colors.brandPrimary,
    fontSize: fontSize.xxl, letterSpacing: 3,
  },
  panelDivider: {
    height: 1, backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  panelLine: {
    fontFamily: fonts.displayBold, color: colors.onSurface,
    fontSize: fontSize.lg, lineHeight: 26, letterSpacing: 0.5,
    marginBottom: 4,
  },
  medal: {
    alignItems: "center", marginTop: spacing.xl,
    padding: spacing.md, borderWidth: 1, borderColor: colors.warning,
    backgroundColor: "rgba(255,176,32,0.08)",
  },
  medalText: {
    fontFamily: fonts.displayBold, color: colors.warning,
    fontSize: fontSize.lg, letterSpacing: 3, marginTop: 4,
  },
  medalSub: {
    fontFamily: fonts.displayBold, color: colors.onSurfaceSecondary,
    fontSize: 10, letterSpacing: 1.5, marginTop: 4,
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
