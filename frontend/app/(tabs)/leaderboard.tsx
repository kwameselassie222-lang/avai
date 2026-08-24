import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, V2Campaign, V2Config } from "@/src/api";

const ABILITY_ICONS: Record<string, string> = {
  orbital: "meteor",
  emp: "flash",
  repair: "wrench",
  overclock: "chip",
};

export default function CommanderScreen() {
  const [config, setConfig] = useState<V2Config | null>(null);
  const [camp, setCamp] = useState<V2Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [p, c] = await Promise.all([api.v2Player(id), api.v2Config()]);
    setCamp(p.campaign);
    setConfig(c);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setAbility = async (aid: string) => {
    if (!camp) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      await api.v2SetAbility({ player_id: id, ability_id: aid });
      setCamp({ ...camp, commander_ability: aid });
    } catch (e: any) { Alert.alert("ERR", String(e.message)); }
    finally { setBusy(false); }
  };

  const evolve = async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      const res = await api.v2Evolve(id);
      setCamp(res.campaign);
      Alert.alert("EVOLVED", `A.I. Unit One → Stage ${res.stage}`);
    } catch (e: any) {
      Alert.alert("EVOLUTION LOCKED", String(e.message || e));
    } finally { setBusy(false); }
  };

  if (loading || !config || !camp) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const stage = config.stages.find((s) => s.stage === camp.commander_stage) || config.stages[0];
  const nextStage = config.stages.find((s) => s.stage === camp.commander_stage + 1);
  const totalStars = Object.values(camp.stars).reduce((s, v) => s + Number(v || 0), 0);
  const canEvolve = nextStage && totalStars >= nextStage.req_stars;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>A.I. UNIT ONE</Text>
        <View style={styles.cmdCard}>
          <MaterialCommunityIcons name="robot-excited" size={80} color={colors.brandPrimary} />
          <Text style={styles.stageName}>{stage.name}</Text>
          <Text style={styles.stageMeta}>Stage {stage.stage} of 5  •  {totalStars} ⭐ total</Text>
          <Text style={styles.stageBonus}>◆ +{stage.hp_bonus}% robot HP bonus in battle</Text>
        </View>

        {nextStage && (
          <View style={styles.evolveCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.evolveNext}>NEXT: {nextStage.name}</Text>
              <Text style={styles.evolveReq}>Requires {nextStage.req_stars} ⭐ (you have {totalStars})</Text>
            </View>
            <Pressable
              onPress={evolve}
              disabled={!canEvolve || busy}
              style={[styles.evolveBtn, { borderColor: canEvolve ? colors.brandPrimary : colors.border, opacity: canEvolve ? 1 : 0.4 }]}
            >
              <Text style={[styles.evolveText, { color: canEvolve ? colors.brandPrimary : colors.onSurfaceTertiary }]}>
                {busy ? "..." : "▮ EVOLVE"}
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.section}>▮ COMMANDER ABILITY</Text>
        <Text style={styles.hint}>Choose one active ability. Charges as you battle. Tap to activate on the battlefield.</Text>
        {config.abilities.map((a) => {
          const selected = camp.commander_ability === a.id;
          return (
            <Pressable
              key={a.id}
              onPress={() => setAbility(a.id)}
              style={[styles.ability, { borderColor: selected ? colors.brandPrimary : colors.border, backgroundColor: selected ? "rgba(0,229,255,0.06)" : colors.surfaceSecondary }]}
              testID={`ability-${a.id}`}
            >
              <MaterialCommunityIcons name={ABILITY_ICONS[a.id] as any || "flash"} size={22} color={selected ? colors.brandPrimary : colors.onSurfaceSecondary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.abilityName, { color: selected ? colors.brandPrimary : colors.onSurface }]}>{a.name}</Text>
                <Text style={styles.abilityDesc}>{a.desc}</Text>
              </View>
              {selected && <MaterialCommunityIcons name="check-circle" size={20} color={colors.brandPrimary} />}
            </Pressable>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  header: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xl, letterSpacing: 3, textAlign: "center", marginBottom: spacing.md },
  cmdCard: { borderWidth: 1, borderColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", backgroundColor: colors.surfaceSecondary, marginBottom: spacing.md },
  stageName: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.base, letterSpacing: 1.5, marginTop: 8, textAlign: "center" },
  stageMeta: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 4 },
  stageBonus: { fontFamily: fonts.displayBold, color: colors.success, fontSize: fontSize.xs, letterSpacing: 1, marginTop: 8 },
  evolveCard: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.sm,
    backgroundColor: "rgba(255,176,32,0.06)", marginBottom: spacing.md,
  },
  evolveNext: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.sm, letterSpacing: 1.2 },
  evolveReq: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 2 },
  evolveBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  evolveText: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1.5 },
  section: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5, marginBottom: 4, marginTop: spacing.sm },
  hint: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginBottom: spacing.sm, letterSpacing: 0.5 },
  ability: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6 },
  abilityName: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1.2 },
  abilityDesc: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
