import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import {
  playPanelVoice, stopVoice, detectSpeaker,
  isVoiceMuted, setVoiceMuted, loadMutePref, subscribeMute,
} from "@/src/game/voice";

const SPEAKER_LABELS: Record<string, string> = {
  unit_one: "A.I. UNIT ONE", renn: "DR. RENN",
  apollyon: "APOLLYON", narrator: "NARRATOR", queen: "HIVE QUEEN",
};
const SPEAKER_COLORS: Record<string, string> = {
  unit_one: colors.brandPrimary, renn: "#00FF66",
  apollyon: colors.brandSecondary, narrator: colors.onSurfaceSecondary, queen: "#FF00FF",
};

function SpeakerChip({ header, body }: { header: string; body: string }) {
  const speaker = detectSpeaker(header, body);
  const color = SPEAKER_COLORS[speaker];
  const label = SPEAKER_LABELS[speaker];
  return (
    <View style={[voiceStyles.btn, { borderColor: color }]} testID={`voice-${speaker}`}>
      <MaterialCommunityIcons name="account-voice" size={12} color={color} />
      <Text style={[voiceStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const voiceStyles = StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 4, alignSelf: "flex-start", marginTop: 6,
  },
  label: { fontFamily: fonts.displayBold, fontSize: 9, letterSpacing: 1 },
});

const PAGE_SFX = require("../assets/sfx/deploy.wav");
const BOSS_SFX = require("../assets/sfx/boss.wav");

type Panel = { header: string; body: string };
type Payload = {
  kind: "chapter" | "reveal";
  title: string;
  subtitle: string | null; // chapter label or null for reveal
  epigraph: string | null;
  panels: Panel[];
  cta_next: string; // route to navigate to on CONTINUE
  cta_label: string;
  accent: string; // color
};

export default function InterludeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; id?: string; level?: string; difficulty?: string }>();
  const kind = params.kind || "chapter";
  const id = params.id || "1";
  const nextLevel = Number(params.level || 1);
  const difficulty = params.difficulty === "veteran" ? "veteran" : "normal";

  const [payload, setPayload] = useState<Payload | null>(null);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState<boolean>(isVoiceMuted());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pageSfx = useAudioPlayer(PAGE_SFX);
  const bossSfx = useAudioPlayer(BOSS_SFX);
  const openingPlayed = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        if (kind === "chapter") {
          const c = await api.v2StoryChapter(Number(id));
          const suffix = difficulty === "veteran" ? `&difficulty=veteran` : "";
          setPayload({
            kind: "chapter",
            title: c.title,
            subtitle: c.chapter,
            epigraph: c.epigraph,
            panels: c.panels,
            cta_next: `/story?level=${nextLevel}${suffix}`,
            cta_label: "BEGIN OPERATION",
            accent: colors.brandPrimary,
          });
          // Mark chapter as seen
          await AsyncStorage.setItem(`aliens_vai_seen_chapter_${id}`, "1");
        } else if (kind === "reveal") {
          const r = await api.v2StoryReveal(id);
          setPayload({
            kind: "reveal",
            title: r.title,
            subtitle: "APOLLYON TRANSMISSION",
            epigraph: null,
            panels: r.panels,
            cta_next: `/epilogue`,
            cta_label: "CONTINUE",
            accent: colors.brandSecondary,
          });
          await AsyncStorage.setItem(`aliens_vai_seen_reveal_${id}`, "1");
        }
      } catch (e) {
        console.warn("interlude load failed", e);
        router.replace("/(tabs)/command");
      }
    })();
  }, [kind, id, nextLevel, difficulty, router]);

  useEffect(() => {
    if (!payload) return;
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start();
    if (idx === 0 && !openingPlayed.current) {
      openingPlayed.current = true;
      try {
        if (payload.kind === "reveal") {
          bossSfx.volume = 0.8;
          bossSfx.seekTo(0);
          bossSfx.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          pageSfx.volume = 0.45;
          pageSfx.seekTo(0);
          pageSfx.play();
        }
      } catch {}
    } else {
      try {
        pageSfx.volume = 0.3;
        pageSfx.seekTo(0);
        pageSfx.play();
        Haptics.selectionAsync().catch(() => {});
      } catch {}
    }
  }, [idx, payload, fadeAnim, scaleAnim, pageSfx, bossSfx]);

  // Load persisted mute + subscribe
  useEffect(() => {
    let alive = true;
    loadMutePref().then((m) => { if (alive) setMuted(m); });
    const unsub = subscribeMute((m) => { if (alive) setMuted(m); });
    return () => { alive = false; unsub(); };
  }, []);

  // Auto-play voice on every panel change (respects mute)
  useEffect(() => {
    if (!payload) return;
    const p = payload.panels[idx];
    if (!p) return;
    stopVoice();
    playPanelVoice(p.header, p.body).catch(() => {});
    return () => { stopVoice(); };
  }, [payload, idx]);

  const toggleMute = async () => {
    try { Haptics.selectionAsync().catch(() => {}); } catch {}
    const next = !muted;
    await setVoiceMuted(next);
    if (!next && payload) {
      const p = payload.panels[idx];
      if (p) playPanelVoice(p.header, p.body).catch(() => {});
    }
  };

  if (!payload) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const panel = payload.panels[idx];
  const isLast = idx === payload.panels.length - 1;

  const next = () => {
    stopVoice();
    if (!isLast) {
      setIdx((n) => n + 1);
    } else {
      router.replace(payload.cta_next);
    }
  };

  const skip = () => {
    stopVoice();
    router.replace(payload.cta_next);
  };

  const isReveal = payload.kind === "reveal";

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isReveal ? ["#1a0008", "#0A0F1F", "#050810"] : ["#001820", "#0A0F1F", "#050810"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Top */}
        <View style={styles.top}>
          {payload.subtitle && (
            <Text style={[styles.chapterTag, { color: payload.accent }]}>{payload.subtitle}</Text>
          )}
          <Text style={[styles.title, { color: payload.accent,
            textShadowColor: payload.accent, textShadowRadius: 14,
          }]}>{payload.title}</Text>
          {payload.epigraph && (
            <View style={styles.epigraphBox}>
              {payload.epigraph.split("\n").map((line, i) => (
                <Text key={i} style={styles.epigraphLine}>{line}</Text>
              ))}
            </View>
          )}
          <Pressable onPress={skip} style={styles.skipBtn} testID="interlude-skip">
            <Text style={styles.skipText}>SKIP</Text>
            <MaterialCommunityIcons name="chevron-double-right" size={12} color={colors.onSurfaceTertiary} />
          </Pressable>
          <Pressable onPress={toggleMute} style={styles.muteBtn} testID="interlude-mute">
            <MaterialCommunityIcons
              name={muted ? "volume-off" : "volume-high"}
              size={14}
              color={muted ? colors.onSurfaceTertiary : payload.accent}
            />
          </Pressable>
        </View>

        {/* Panel */}
        <View style={styles.body}>
          <Animated.View
            key={idx}
            style={[styles.panel, {
              borderColor: colors.onSurface,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              shadowColor: payload.accent,
            }]}
          >
            <View style={[styles.panelBadge, { backgroundColor: payload.accent, borderColor: payload.accent }]}>
              <Text style={styles.panelBadgeText}>{idx + 1} / {payload.panels.length}</Text>
            </View>
            <Text style={[styles.panelHeader, { color: payload.accent }]}>{panel.header}</Text>
            <SpeakerChip header={panel.header} body={panel.body} />
            <View style={styles.panelDivider} />
            {panel.body.split("\n").map((line, i) => (
              <Text key={i} style={styles.panelLine}>{line}</Text>
            ))}
          </Animated.View>
        </View>

        {/* Bottom */}
        <View style={styles.bottomBar}>
          <View style={styles.dots}>
            {payload.panels.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === idx ? payload.accent : colors.border }]}
              />
            ))}
          </View>
          <Pressable
            onPress={next}
            style={[styles.cta, { backgroundColor: payload.accent, shadowColor: payload.accent }]}
            testID="interlude-next"
          >
            <Text style={styles.ctaText}>{isLast ? payload.cta_label : "NEXT"}</Text>
            <MaterialCommunityIcons
              name={isLast ? (isReveal ? "arrow-right-bold" : "rocket-launch") : "arrow-right-bold"}
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
  top: { alignItems: "center", padding: spacing.lg, position: "relative" },
  chapterTag: {
    fontFamily: fonts.displayBold, fontSize: 11, letterSpacing: 4, marginBottom: 6,
  },
  title: {
    fontFamily: fonts.displayBold, fontSize: fontSize.xxxl,
    letterSpacing: 6, textAlign: "center",
  },
  epigraphBox: {
    marginTop: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.brandPrimary,
    paddingLeft: spacing.md, paddingVertical: 4,
  },
  epigraphLine: {
    fontFamily: fonts.body, color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs, fontStyle: "italic", lineHeight: 18,
  },
  skipBtn: {
    position: "absolute", top: spacing.md, right: spacing.md,
    flexDirection: "row", alignItems: "center", gap: 2, padding: 4,
  },
  skipText: {
    fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary,
    fontSize: 10, letterSpacing: 1.5,
  },
  muteBtn: {
    position: "absolute", top: spacing.md, left: spacing.md,
    padding: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 4,
    backgroundColor: colors.surfaceSecondary,
  },
  body: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  panel: {
    borderWidth: 3, backgroundColor: colors.surface,
    padding: spacing.lg, borderRadius: 2,
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  panelBadge: {
    alignSelf: "flex-start", borderWidth: 2,
    paddingHorizontal: 6, paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  panelBadgeText: {
    fontFamily: fonts.displayBold, color: colors.onBrandPrimary,
    fontSize: 10, letterSpacing: 1.5,
  },
  panelHeader: {
    fontFamily: fonts.displayBold, fontSize: fontSize.xxl, letterSpacing: 3,
  },
  panelDivider: {
    height: 1, backgroundColor: colors.border, marginVertical: spacing.sm,
  },
  panelLine: {
    fontFamily: fonts.displayBold, color: colors.onSurface,
    fontSize: fontSize.lg, lineHeight: 26, letterSpacing: 0.5, marginBottom: 4,
  },
  bottomBar: {
    padding: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  dots: {
    flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    paddingVertical: spacing.md, borderRadius: radius.md,
    shadowOpacity: 0.5, shadowRadius: 8,
  },
  ctaText: {
    fontFamily: fonts.displayBold, color: colors.onBrandPrimary,
    fontSize: fontSize.base, letterSpacing: 3,
  },
});
