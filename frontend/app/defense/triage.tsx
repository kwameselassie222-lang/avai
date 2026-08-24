import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, TriageScan, TriageResolve } from "@/src/api";
import { TerminalHeader, HudButton } from "@/src/components/hud";

export default function TriageScreen() {
  const router = useRouter();
  const [scan, setScan] = useState<TriageScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TriageResolve | null>(null);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      const s = await api.triageScan(id);
      setScan(s);
    } catch (e: any) {
      Alert.alert("TRIAGE UNAVAILABLE", String(e.message || e));
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else if (selected.length < 2) {
      setSelected([...selected, id]);
    }
  };

  const resolve = async () => {
    if (selected.length !== 2) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      const res = await api.triageResolve({ player_id: id, defend_zone_ids: selected });
      setResult(res);
    } catch (e: any) {
      Alert.alert("RESOLVE FAILED", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  if (result) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <TerminalHeader
          title="TRIAGE // OUTCOME"
          subtitle={`VIABILITY ${result.viability_after.toFixed(1)}%`}
          right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>◆ The AI accepts the burden of the sacrifice. +12⚛ research awarded for the decision.</Text>
          {result.resolved.map((z) => (
            <View
              key={z.id}
              style={[
                styles.resultRow,
                { borderColor: z.action === "defended" ? colors.success : colors.brandSecondary },
              ]}
            >
              <MaterialCommunityIcons
                name={z.action === "defended" ? "shield-check" : "alert-decagram"}
                size={20}
                color={z.action === "defended" ? colors.success : colors.brandSecondary}
              />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.resName}>{z.name.toUpperCase()}</Text>
                <Text style={styles.resAction}>
                  {z.action === "defended" ? "DEFENDED" : "SACRIFICED"} — −{z.damage} integrity → {z.integrity}%
                </Text>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
          <HudButton label="▮ RETURN" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!scan) return null;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="MULTI-FRONT TRIAGE"
        subtitle="Choose 2 zones to defend. One will fall."
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.alertBox}>
          <MaterialCommunityIcons name="alert-decagram" size={20} color={colors.brandSecondary} />
          <Text style={styles.alertText}>{scan.message}</Text>
        </View>
        <Text style={styles.hint}>◆ {scan.zones.length} zones under simultaneous assault. Pick the two Earth cannot lose.</Text>
        {scan.zones.map((z) => {
          const picked = selected.includes(z.id);
          const disabled = !picked && selected.length >= 2;
          return (
            <Pressable
              key={z.id}
              onPress={() => toggle(z.id)}
              disabled={disabled}
              style={[
                styles.zoneCard,
                {
                  borderColor: picked ? colors.success : disabled ? colors.border : colors.brandSecondary,
                  opacity: disabled ? 0.4 : 1,
                },
              ]}
              testID={`triage-zone-${z.id}`}
            >
              <View style={styles.zoneHeader}>
                <MaterialCommunityIcons name={z.icon as any} size={22} color={z.color} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.zoneName, { color: z.color }]}>{z.name.toUpperCase()}</Text>
                  <Text style={styles.zoneMeta}>WEIGHT {z.weight} • CURRENT {z.integrity}%</Text>
                </View>
                {picked && <MaterialCommunityIcons name="shield-check" size={22} color={colors.success} />}
              </View>
              <Text style={styles.incoming}>◆ INCOMING DAMAGE: −{z.incoming_damage}%</Text>
              <Text style={styles.forecast}>
                {picked
                  ? `IF DEFENDED → −${Math.round(z.incoming_damage * 0.35)}%`
                  : `IF SACRIFICED → −${z.incoming_damage}%`}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ height: 20 }} />
        <HudButton
          label={busy ? "..." : `▮ COMMIT DECISION (${selected.length}/2)`}
          variant="danger"
          onPress={resolve}
          disabled={selected.length !== 2 || busy}
          testID="btn-triage-commit"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  back: { padding: spacing.xs },
  alertBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.brandSecondary,
    borderRadius: radius.md, padding: spacing.sm,
    backgroundColor: "rgba(255,51,102,0.08)",
    marginBottom: spacing.md,
  },
  alertText: { flex: 1, fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.xs, letterSpacing: 1 },
  hint: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: spacing.md, letterSpacing: 0.5 },
  zoneCard: {
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  zoneHeader: { flexDirection: "row", alignItems: "center" },
  zoneName: { fontFamily: fonts.displayBold, fontSize: fontSize.base, letterSpacing: 1.5 },
  zoneMeta: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  incoming: { fontFamily: fonts.displayBold, color: colors.brandSecondary, fontSize: fontSize.xs, marginTop: 8, letterSpacing: 1 },
  forecast: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 4 },
  resultRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  resName: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm, letterSpacing: 1.5 },
  resAction: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 2 },
});
