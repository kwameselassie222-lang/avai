import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, SeasonStatus } from "@/src/api";
import { TerminalHeader, HudButton } from "@/src/components/hud";

// Same reward table as backend for preview
function rewardFor(tier: number, premium: boolean) {
  if (premium) {
    if (tier % 5 === 0) return { ai_cores: 15, cosmetic: true };
    if (tier % 3 === 0) return { materials: 200, research: 40, ai_cores: 8 };
    return { ai_cores: 5, materials: 100 };
  }
  if (tier % 5 === 0) return { ai_cores: 3, materials: 200 };
  if (tier % 4 === 0) return { research: 30 };
  return { materials: 80 };
}

function rewardChips(r: any) {
  const chips: { label: string; color: string }[] = [];
  if (r.ai_cores) chips.push({ label: `+${r.ai_cores}⬡`, color: colors.warning });
  if (r.materials) chips.push({ label: `+${r.materials}▣`, color: colors.brandPrimary });
  if (r.research) chips.push({ label: `+${r.research}⚛`, color: colors.brandSecondary });
  if (r.cosmetic) chips.push({ label: "SKIN", color: colors.success });
  return chips;
}

export default function SeasonPassScreen() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<SeasonStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const { seasons } = await api.seasonStatus(id);
    setSeasons(seasons);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const claim = async (season_id: string, tier: number) => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(tier);
      const res = await api.seasonClaim({ player_id: id, season_id, tier });
      const bits: string[] = [];
      if (res.free) Object.entries(res.free).forEach(([k, v]) => bits.push(`FREE +${v} ${k.toUpperCase()}`));
      if (res.premium) Object.entries(res.premium).forEach(([k, v]) => bits.push(`PREMIUM +${v} ${k.toUpperCase()}`));
      Alert.alert(`TIER ${tier} CLAIMED`, bits.join("\n") || "Rewards granted.");
      await load();
    } catch (e: any) {
      Alert.alert("CLAIM FAILED", String(e.message || e));
    } finally { setBusy(null); }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;
  const s = seasons[0];
  if (!s) return null;
  const progressPct = ((s.xp % s.xp_per_tier) / s.xp_per_tier) * 100;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="SEASON PASS"
        subtitle={s.name}
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.narr}>{s.narrative}</Text>
          <View style={styles.progRow}>
            <Text style={styles.progLabel}>TIER {s.tier} / {s.tiers}</Text>
            <Text style={styles.progXp}>{s.xp} XP</Text>
          </View>
          <View style={styles.progBar}>
            <View style={[styles.progFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progSub}>Next tier at {s.next_tier_at} XP • Earn XP by defending waves, defeating Archons, completing triage.</Text>
        </View>

        {!s.premium_owned && (
          <Pressable
            onPress={async () => {
              const id = await storage.getPlayerId();
              if (!id) return;
              try {
                await api.purchase({ player_id: id, item_id: "season_pass_s1" });
                Alert.alert("PREMIUM TRACK ACTIVE", "Season 1 premium rewards unlocked.");
                await load();
              } catch (e: any) {
                Alert.alert("PURCHASE FAILED", String(e.message || e));
              }
            }}
            style={styles.premiumBtn}
            testID="buy-season-premium"
          >
            <MaterialCommunityIcons name="crown" size={16} color={colors.warning} />
            <Text style={styles.premiumBtnText}>ACTIVATE PREMIUM TRACK — $7.99</Text>
          </Pressable>
        )}

        <View style={styles.trackHeader}>
          <View style={styles.trackCol}><Text style={styles.trackLabel}>FREE</Text></View>
          <View style={styles.trackCol}><Text style={[styles.trackLabel, { color: colors.warning }]}>PREMIUM</Text></View>
        </View>

        {Array.from({ length: s.tiers }, (_, i) => i + 1).map((tier) => {
          const unlocked = tier <= s.tier;
          const claimed = s.claimed.includes(tier);
          const freeReward = rewardFor(tier, false);
          const premReward = rewardFor(tier, true);
          return (
            <View
              key={tier}
              style={[
                styles.tierRow,
                { borderColor: claimed ? colors.success : unlocked ? colors.brandPrimary : colors.border, opacity: unlocked ? 1 : 0.45 },
              ]}
              testID={`tier-${tier}`}
            >
              <View style={styles.tierNum}>
                <Text style={[styles.tierNumText, { color: unlocked ? colors.brandPrimary : colors.onSurfaceTertiary }]}>{tier}</Text>
              </View>
              <View style={styles.rewardCol}>
                {rewardChips(freeReward).map((c, i) => (
                  <View key={i} style={styles.chip}><Text style={[styles.chipText, { color: c.color }]}>{c.label}</Text></View>
                ))}
              </View>
              <View style={styles.rewardCol}>
                {rewardChips(premReward).map((c, i) => (
                  <View key={i} style={[styles.chip, { borderColor: s.premium_owned ? colors.warning : colors.border, opacity: s.premium_owned ? 1 : 0.5 }]}>
                    <Text style={[styles.chipText, { color: c.color }]}>{c.label}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => claim(s.id, tier)}
                disabled={!unlocked || claimed || busy !== null}
                style={[
                  styles.claimBtn,
                  { borderColor: claimed ? colors.success : unlocked ? colors.brandPrimary : colors.border, opacity: (!unlocked || claimed) ? 0.4 : 1 },
                ]}
                testID={`claim-${tier}`}
              >
                <Text style={[styles.claimText, { color: claimed ? colors.success : unlocked ? colors.brandPrimary : colors.onSurfaceTertiary }]}>
                  {busy === tier ? "..." : claimed ? "◆" : "CLAIM"}
                </Text>
              </Pressable>
            </View>
          );
        })}
        <View style={{ height: 20 }} />
        {/* Debug convenience: add XP */}
        <HudButton
          label="▮ SIMULATE +150 XP (dev)"
          variant="ghost"
          onPress={async () => {
            const id = await storage.getPlayerId();
            if (!id) return;
            try {
              await api.seasonAddXp({ player_id: id, season_id: s.id, xp: 150 });
              await load();
            } catch (e: any) { Alert.alert("ERR", String(e.message)); }
          }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  back: { padding: spacing.xs },
  scroll: { padding: spacing.lg },
  headerCard: { borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, backgroundColor: "rgba(255,176,32,0.06)" },
  narr: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, lineHeight: 16 },
  progRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: spacing.sm },
  progLabel: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.sm, letterSpacing: 1.5 },
  progXp: { fontFamily: fonts.display, color: colors.onSurfaceTertiary, fontSize: fontSize.xs },
  progBar: { height: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: 4 },
  progFill: { height: 4, backgroundColor: colors.warning },
  progSub: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 6, lineHeight: 14 },

  premiumBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
    borderWidth: 1, borderColor: colors.warning, backgroundColor: "rgba(255,176,32,0.08)",
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md,
  },
  premiumBtnText: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.sm, letterSpacing: 1.5 },

  trackHeader: { flexDirection: "row", marginBottom: 6 },
  trackCol: { flex: 1, alignItems: "center" },
  trackLabel: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: 10, letterSpacing: 2 },

  tierRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: radius.md, padding: spacing.xs,
    marginBottom: 4, backgroundColor: colors.surfaceSecondary, gap: 4,
  },
  tierNum: { width: 30, alignItems: "center" },
  tierNumText: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1 },
  rewardCol: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 3, justifyContent: "center" },
  chip: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  chipText: { fontFamily: fonts.displayBold, fontSize: 9, letterSpacing: 0.5 },
  claimBtn: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.md, minWidth: 60, alignItems: "center" },
  claimText: { fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 1.2 },
});
