import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { Archon } from "@/src/api";

const CINEMATIC_LINES: Record<string, string[]> = {
  swarm_lord: [
    "> SIGNATURE: HIVE-MIND ARCHON",
    "> ONE MIND. TEN THOUSAND BODIES.",
    "> KILL THE SOURCE. THE SWARM DIES WITH IT.",
    "> ENGAGE // THE SWARM LORD",
  ],
  silence: [
    "> SIGNATURE: CRYSTALLINE ARCHON",
    "> ALL SENSORS COMPROMISED.",
    "> YOU WILL NOT SEE WHAT STRIKES YOU.",
    "> TRUST YOUR PROTOCOLS // THE SILENCE",
  ],
  devourer: [
    "> SIGNATURE: MATTER-EATING ARCHON",
    "> EVERY HIT COSTS MATERIALS.",
    "> EFFICIENCY IS THE ONLY ESCAPE.",
    "> ENGAGE // THE DEVOURER",
  ],
  mirror: [
    "> SIGNATURE: PERFECT REFLECTOR",
    "> 40% OF DAMAGE COMES BACK.",
    "> STRIKE WITH WHAT IT DOES NOT EXPECT.",
    "> ENGAGE // THE MIRROR",
  ],
};

export function ArchonCinematic({ archon, onComplete }: { archon: Archon; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const lines = CINEMATIC_LINES[archon.id] || [`> ENGAGE ${archon.name}`];
  const iconScale = React.useRef(new Animated.Value(0.4)).current;
  const iconOpacity = React.useRef(new Animated.Value(0)).current;
  const flash = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [iconScale, iconOpacity]);

  useEffect(() => {
    if (step >= lines.length) {
      // Final flash & complete
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(onComplete, 200);
      });
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 900 : 650);
    return () => clearTimeout(t);
  }, [step, lines.length, flash, onComplete]);

  return (
    <Pressable onPress={onComplete} style={styles.overlay}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: archon.color,
            opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
          },
        ]}
      />
      <View style={styles.scanlines} />
      <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }], alignItems: "center" }}>
        <View style={[styles.iconRing, { borderColor: archon.color, shadowColor: archon.color }]}>
          <MaterialCommunityIcons name={archon.icon as any} size={80} color={archon.color} />
        </View>
        <Text style={[styles.name, { color: archon.color }]}>{archon.name}</Text>
        <Text style={styles.tag}>◆ ARCHON COMMANDER</Text>
      </Animated.View>
      <View style={styles.terminal}>
        {lines.slice(0, step).map((l, i) => (
          <Text
            key={i}
            style={[
              styles.line,
              { color: i === step - 1 ? colors.brandPrimary : colors.onSurfaceSecondary },
            ]}
          >
            {l}
          </Text>
        ))}
        {step < lines.length && <Text style={styles.cursor}>█</Text>}
      </View>
      <Text style={styles.skipHint}>◆ TAP TO SKIP</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,10,13,0.98)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    zIndex: 100,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    backgroundColor: "transparent",
  },
  iconRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 10,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    letterSpacing: 3,
    marginTop: spacing.md,
    textAlign: "center",
  },
  tag: {
    fontFamily: fonts.displayBold,
    color: colors.warning,
    fontSize: fontSize.xs,
    letterSpacing: 2,
    marginTop: 4,
  },
  terminal: {
    marginTop: spacing.xxl,
    minHeight: 130,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.onSurfaceSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  cursor: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.brandPrimary,
  },
  skipHint: {
    position: "absolute",
    bottom: spacing.xl,
    fontFamily: fonts.display,
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    letterSpacing: 2,
  },
});
