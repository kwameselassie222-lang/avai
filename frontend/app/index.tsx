import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage } from "@/src/api";
import { HudButton } from "@/src/components/hud";

const BOOT_LINES = [
  "> INITIALIZING DEFENSE MATRIX...",
  "> LINK: LOW-EARTH ORBIT CONSTELLATION ...... OK",
  "> LINK: LUNAR RELAY NODE 04 ...... OK",
  "> LINK: QUANTUM CORE / UNDERGROUND VAULT ...... OK",
  "> DETECTING SIGNATURE ...... [APOLLYON]",
  "> HOSTILE INTELLIGENCE CONFIRMED.",
  "> STANDING BY FOR OPERATOR HANDSHAKE.",
];

export default function BootScreen() {
  const router = useRouter();
  const [linesShown, setLinesShown] = useState(0);
  const [codename, setCodename] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // If a player already exists, boot directly into command center
      const existingId = await storage.getPlayerId();
      if (existingId && !cancelled) {
        try {
          await api.getPlayer(existingId);
          router.replace("/(tabs)/command");
          return;
        } catch {
          await storage.clear();
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (linesShown >= BOOT_LINES.length) {
      const t = setTimeout(() => setShowInput(true), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLinesShown((n) => n + 1), 380);
    return () => clearTimeout(t);
  }, [linesShown, loading]);

  const handleActivate = async () => {
    const name = codename.trim().toUpperCase().replace(/\s+/g, "-");
    if (name.length < 2) return;
    setBusy(true);
    try {
      const p = await api.initPlayer(name);
      await storage.setPlayer(p.id, p.codename);
      router.replace("/(tabs)/command");
    } catch (e) {
      console.warn("init failed", e);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="boot-screen">
      <Image
        source={require("../assets/images/app-image.png")}
        style={styles.bg}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(9,10,13,0.6)", "rgba(9,10,13,0.95)", "#090A0D"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
        >
          <View style={styles.brandRow}>
            <MaterialCommunityIcons
              name="alien"
              size={28}
              color={colors.brandSecondary}
            />
            <Text style={styles.brandText}>ALIENS</Text>
            <Text style={styles.brandVs}>V</Text>
            <Text style={[styles.brandText, { color: colors.brandPrimary }]}>
              A.I.
            </Text>
          </View>
          <Text style={styles.tagline}>
            Humanity built intelligence.{"\n"}Intelligence must now build humanity's defense.
          </Text>

          <View style={styles.terminal} testID="boot-terminal">
            {BOOT_LINES.slice(0, linesShown).map((l, i) => (
              <Text
                key={i}
                style={[
                  styles.termLine,
                  l.includes("APOLLYON") && { color: colors.brandSecondary },
                  l.includes("HOSTILE") && { color: colors.brandSecondary },
                ]}
              >
                {l}
              </Text>
            ))}
            {linesShown < BOOT_LINES.length && (
              <Text style={styles.cursor}>█</Text>
            )}
          </View>

          {showInput && (
            <View style={styles.inputBlock} testID="codename-block">
              <Text style={styles.inputLabel}>ENTER COMMANDER CODENAME</Text>
              <TextInput
                testID="codename-input"
                value={codename}
                onChangeText={setCodename}
                placeholder="ORION-7"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
                autoCapitalize="characters"
                maxLength={20}
                editable={!busy}
              />
              <HudButton
                testID="activate-button"
                label={busy ? "ACTIVATING..." : "ACTIVATE AI CORE"}
                onPress={handleActivate}
                disabled={busy || codename.trim().length < 2}
                style={{ marginTop: spacing.md }}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  safe: { flex: 1 },
  kav: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  loader: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  brandText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.hero,
    color: colors.onSurface,
    letterSpacing: 3,
  },
  brandVs: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xl,
    color: colors.brandSecondary,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  terminal: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.55)",
    minHeight: 200,
  },
  termLine: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.brandPrimary,
    marginBottom: 4,
  },
  cursor: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.brandPrimary,
  },
  inputBlock: { marginBottom: spacing.lg },
  inputLabel: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.sm,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xl,
    padding: spacing.md,
    letterSpacing: 2,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
  },
});
