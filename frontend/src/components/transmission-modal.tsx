import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage } from "@/src/api";

const SLOT_LABELS: Record<string, { title: string; cta: string; icon: string; sub: string }> = {
  alien_tech: { title: "ALIEN TECHNOLOGY RECOVERED", cta: "Analyze Transmission", icon: "atom-variant", sub: "Recover fragments and cores." },
  emergency_energy: { title: "PLANETARY ENERGY RESERVES CRITICAL", cta: "Request Emergency Support", icon: "lightning-bolt-outline", sub: "Restore emergency power." },
  double_rewards: { title: "PLANETARY DEFENSE SUCCESSFUL", cta: "Access Sponsor Transmission", icon: "shield-star", sub: "Double this wave's rewards." },
  emergency_repair: { title: "DEFENSE GRID COMPROMISED", cta: "Recover Alien Intelligence", icon: "wrench", sub: "Restore a portion of a damaged layer." },
};

export function TransmissionModal({
  visible,
  slot,
  onClose,
  onGranted,
  context,
}: {
  visible: boolean;
  slot: string;
  onClose: () => void;
  onGranted?: (delta: any) => void;
  context?: any;
}) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "playing" | "granted">("idle");
  const [delta, setDelta] = useState<any>(null);
  const meta = SLOT_LABELS[slot] || SLOT_LABELS.alien_tech;

  const watch = async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      setPhase("playing");
      // Simulate a 2.4s "ad" playback. On a real device the client would call AdMob here and
      // only fire /store/transmission on ad-completed callback.
      await new Promise((r) => setTimeout(r, 2400));
      const res = await api.watchTransmission({ player_id: id, slot, context });
      setDelta(res.delta);
      setPhase("granted");
      onGranted && onGranted(res.delta);
    } catch (e: any) {
      Alert.alert("TRANSMISSION FAILED", String(e.message || e));
      setPhase("idle");
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={busy ? undefined : onClose} style={styles.backdrop}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <MaterialCommunityIcons name={meta.icon as any} size={20} color={colors.warning} />
            <Text style={styles.title}>{meta.title}</Text>
          </View>
          <Text style={styles.sub}>{meta.sub}</Text>
          <Text style={styles.disclaim}>◆ SPONSORED — deep-space signal relay</Text>

          {phase === "idle" && (
            <>
              <Pressable onPress={watch} disabled={busy} style={styles.primaryBtn} testID="btn-watch-transmission">
                <MaterialCommunityIcons name="radio-tower" size={14} color={colors.brandPrimary} />
                <Text style={styles.primaryText}>{meta.cta.toUpperCase()}</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.ghostBtn} testID="btn-decline-transmission">
                <Text style={styles.ghostText}>DECLINE</Text>
              </Pressable>
            </>
          )}

          {phase === "playing" && (
            <View style={styles.playing}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.playText}>{"// RELAYING TRANSMISSION..."}</Text>
            </View>
          )}

          {phase === "granted" && (
            <>
              <View style={styles.grantsBox}>
                {delta && Object.entries(delta).map(([k, v]) => (
                  <Text key={k} style={styles.grantLine}>
                    ◆ +{String(v)} {k.replace(/_/g, " ").toUpperCase()}
                  </Text>
                ))}
              </View>
              <Pressable onPress={onClose} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>ACKNOWLEDGE</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { flex: 1, fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.sm, letterSpacing: 1.5 },
  sub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: 8, lineHeight: 16 },
  disclaim: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1.5, marginBottom: spacing.md },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: colors.brandPrimary,
    paddingVertical: spacing.sm, borderRadius: radius.md, marginTop: 6,
    backgroundColor: "rgba(0,229,255,0.06)",
  },
  primaryText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5 },
  ghostBtn: { alignItems: "center", paddingVertical: spacing.sm, marginTop: 4 },
  ghostText: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1.5 },
  playing: { alignItems: "center", gap: 8, padding: spacing.md },
  playText: { fontFamily: fonts.mono, color: colors.warning, fontSize: fontSize.xs, letterSpacing: 1 },
  grantsBox: { borderWidth: 1, borderColor: colors.success, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6, backgroundColor: "rgba(0,255,102,0.05)" },
  grantLine: { fontFamily: fonts.displayBold, color: colors.success, fontSize: fontSize.xs, letterSpacing: 1, marginBottom: 2 },
});
