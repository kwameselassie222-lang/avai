import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle } from "react-native";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";

// -------- HUD Panel --------
export function HudPanel({
  children,
  style,
  accent = "cyan",
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: "cyan" | "magenta" | "amber";
  testID?: string;
}) {
  const borderColor =
    accent === "magenta"
      ? colors.brandSecondary
      : accent === "amber"
      ? colors.warning
      : colors.borderStrong;
  return (
    <View testID={testID} style={[styles.panel, { borderColor }, style]}>
      {children}
    </View>
  );
}

// -------- Segmented stat bar --------
export function StatBar({
  label,
  value,
  max = 40,
  color = colors.brandPrimary,
  testID,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
  testID?: string;
}) {
  const segments = 10;
  const filled = Math.min(segments, Math.round((value / max) * segments));
  return (
    <View testID={testID} style={styles.statRow}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <View style={styles.segRow}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.seg,
              {
                backgroundColor: i < filled ? color : colors.surfaceTertiary,
                borderColor: i < filled ? color : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// -------- Terminal Header (screen title) --------
export function TerminalHeader({
  title,
  subtitle,
  right,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerCaret}>{`> ${title.toUpperCase()}`}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// -------- Primary Button --------
export function HudButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  testID,
  style,
  compact,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "danger" | "ghost";
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  compact?: boolean;
}) {
  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "danger"
      ? colors.brandSecondary
      : "transparent";
  const fg =
    variant === "ghost"
      ? colors.brandPrimary
      : variant === "danger"
      ? colors.onBrandSecondary
      : colors.onBrandPrimary;
  const border =
    variant === "ghost" ? colors.borderStrong : bg;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          paddingVertical: compact ? spacing.sm : spacing.md,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
        },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

// -------- Chip (category / part) --------
export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.brandPrimary : colors.border,
          backgroundColor: selected ? colors.brandTertiary : colors.surfaceSecondary,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.brandPrimary : colors.onSurfaceSecondary },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

// -------- Stat Pill (small readout) --------
export function StatPill({
  label,
  value,
  color = colors.brandPrimary,
  testID,
}: {
  label: string;
  value: string | number;
  color?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.pill}>
      <Text style={styles.pillLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
    </View>
  );
}

// -------- Divider --------
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xs,
  },
  statLabel: {
    fontFamily: fonts.display,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    width: 64,
    letterSpacing: 1.2,
  },
  segRow: { flex: 1, flexDirection: "row", gap: 2 },
  seg: {
    flex: 1,
    height: 10,
    borderWidth: 1,
    borderRadius: 1,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.base,
    width: 32,
    textAlign: "right",
    marginLeft: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerCaret: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xl,
    color: colors.brandPrimary,
    letterSpacing: 1.5,
  },
  headerSub: {
    fontFamily: fonts.body,
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  btn: {
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.base,
    letterSpacing: 1.5,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 36,
    justifyContent: "center",
    flexShrink: 0,
  },
  chipText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    letterSpacing: 1.2,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 64,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  pillLabel: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.onSurfaceTertiary,
    letterSpacing: 1.2,
  },
  pillValue: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
});
