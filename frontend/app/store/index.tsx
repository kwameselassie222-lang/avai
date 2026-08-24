import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, StoreCatalog, StoreItem, Monetization } from "@/src/api";
import { TerminalHeader } from "@/src/components/hud";

type SectionKey = "featured" | "cosmetics" | "resource_packs" | "expansions";

const SECTION_ICONS: Record<SectionKey, string> = {
  featured: "star-four-points",
  cosmetics: "tshirt-crew",
  resource_packs: "cube-outline",
  expansions: "rocket-launch",
};

const SECTION_LABELS: Record<SectionKey, string> = {
  featured: "FEATURED",
  cosmetics: "ROBOT DESIGNS",
  resource_packs: "RESOURCE PACKS",
  expansions: "EXPANSIONS",
};

export default function StoreScreen() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [status, setStatus] = useState<Monetization | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionKey>("featured");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [c, s] = await Promise.all([api.storeCatalog(), api.storeStatus(id)]);
    setCatalog(c);
    setStatus(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const buy = async (item: StoreItem) => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(item.id);
      const res = await api.purchase({ player_id: id, item_id: item.id });
      let msg = `Purchase confirmed.`;
      if (res.delta?.remove_ads) msg = "▮ EARTH DEFENSE LICENSE ACTIVE — interstitials disabled.";
      else if (res.delta?.cosmetic) msg = `▮ COSMETIC UNLOCKED: ${String(res.delta.cosmetic).toUpperCase()}`;
      else if (res.delta?.season_pass) msg = "▮ SEASON PASS PREMIUM TRACK ACTIVE";
      Alert.alert("TRANSACTION COMPLETE", msg);
      await load();
    } catch (e: any) {
      Alert.alert("TRANSACTION FAILED", String(e.message || e));
    } finally { setBusy(null); }
  };

  if (loading || !catalog || !status) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const items = catalog[section] || [];

  const isOwned = (item: StoreItem): boolean => {
    if (item.kind === "removeads") return status.remove_ads;
    if (item.kind === "cosmetic") return status.cosmetics_owned.includes(item.id);
    if (item.kind === "expansion") return status.expansions_owned.includes(item.id);
    if (item.kind === "season_pass") {
      const passId = item.grants?.season_pass;
      return passId ? status.season_passes.includes(passId) : false;
    }
    return false;
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="COMMAND CENTER // STORE"
        subtitle={`◆ ${status.ai_cores} AI CORES${status.remove_ads ? "  •  ADS DISABLED" : ""}`}
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
        {(Object.keys(SECTION_LABELS) as SectionKey[]).map((k) => {
          const active = section === k;
          return (
            <Pressable
              key={k}
              onPress={() => setSection(k)}
              style={[styles.tab, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? "rgba(0,229,255,0.08)" : "transparent" }]}
              testID={`store-tab-${k}`}
            >
              <MaterialCommunityIcons name={SECTION_ICONS[k] as any} size={12} color={active ? colors.brandPrimary : colors.onSurfaceTertiary} />
              <Text style={[styles.tabText, { color: active ? colors.brandPrimary : colors.onSurfaceTertiary }]}>{SECTION_LABELS[k]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>◆ Monetization is optional. Progression is skill-based. AI Cores drop from gameplay, seasons, and transmissions.</Text>
        <Pressable onPress={() => router.push("/store/season")} style={styles.seasonBanner} testID="cta-season">
          <MaterialCommunityIcons name="ticket-confirmation" size={20} color={colors.warning} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.seasonBannerTitle}>SEASON 1 // THE ARRIVAL</Text>
            <Text style={styles.seasonBannerSub}>View free + premium track rewards</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.warning} />
        </Pressable>
        {items.map((item) => {
          const owned = isOwned(item);
          const comingSoon = item.status === "coming_soon";
          const priceLabel = item.price_ai_cores
            ? `${item.price_ai_cores} ⬡ AI CORES`
            : item.price_usd
            ? `$${item.price_usd.toFixed(2)}`
            : "—";
          const canAfford = item.price_ai_cores ? status.ai_cores >= item.price_ai_cores : true;
          const disabled = owned || comingSoon || busy !== null;
          return (
            <View key={item.id} style={[styles.card, { borderColor: owned ? colors.success : colors.border }]} testID={`store-item-${item.id}`}>
              <View style={styles.cardHeader}>
                <View style={styles.kindBadge}>
                  <Text style={styles.kindText}>{item.kind.toUpperCase().replace("_", " ")}</Text>
                </View>
                {owned && <Text style={styles.ownedTag}>◆ OWNED</Text>}
                {comingSoon && <Text style={styles.soonTag}>SOON</Text>}
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              <View style={styles.grantsRow}>
                {Object.entries(item.grants || {}).map(([k, v]) => (
                  <View key={k} style={styles.grantChip}>
                    <Text style={styles.grantText}>
                      {k === "ai_cores" ? `+${v} ⬡` :
                       k === "materials" ? `+${v} ▣` :
                       k === "research" ? `+${v} ⚛` :
                       k === "cosmetic" ? `SKIN` :
                       k === "remove_ads" ? "NO ADS" :
                       k === "season_pass" ? "PREMIUM" :
                       `${k}:${v}`}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.cardFooter}>
                <Text style={[styles.price, { color: canAfford ? colors.brandPrimary : colors.brandSecondary }]}>
                  {priceLabel}
                </Text>
                <Pressable
                  onPress={() => buy(item)}
                  disabled={disabled || !canAfford}
                  style={[styles.buyBtn, { borderColor: canAfford && !owned && !comingSoon ? colors.brandPrimary : colors.border, opacity: disabled ? 0.4 : 1 }]}
                  testID={`buy-${item.id}`}
                >
                  <Text style={[styles.buyText, { color: canAfford && !owned && !comingSoon ? colors.brandPrimary : colors.onSurfaceTertiary }]}>
                    {busy === item.id ? "..." : owned ? "OWNED" : comingSoon ? "SOON" : "PURCHASE"}
                  </Text>
                </Pressable>
              </View>
            </View>
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
  back: { padding: spacing.xs },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm },
  tabsScroll: { maxHeight: 44, backgroundColor: colors.surface },
  tabsRow: { paddingHorizontal: spacing.lg, gap: 6, alignItems: "center" },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.md,
  },
  tabText: { fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 1.5 },
  hint: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: spacing.md, letterSpacing: 0.5, lineHeight: 16 },
  seasonBanner: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: colors.warning,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md,
    backgroundColor: "rgba(255,176,32,0.08)",
  },
  seasonBannerTitle: { fontFamily: fonts.displayBold, color: colors.warning, fontSize: fontSize.sm, letterSpacing: 1.5 },
  seasonBannerSub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 2 },
  card: {
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindBadge: {
    borderWidth: 1, borderColor: colors.brandPrimary,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2,
  },
  kindText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: 9, letterSpacing: 1.5 },
  ownedTag: { fontFamily: fonts.displayBold, color: colors.success, fontSize: 10, letterSpacing: 1.2 },
  soonTag: { fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1.2 },
  itemName: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.base, letterSpacing: 1, marginTop: 6 },
  grantsRow: { flexDirection: "row", gap: 4, marginTop: 6, flexWrap: "wrap" },
  grantChip: {
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: radius.md, backgroundColor: colors.surfaceTertiary,
  },
  grantText: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: 10, letterSpacing: 0.5 },
  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 10, justifyContent: "space-between" },
  price: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, letterSpacing: 1.2 },
  buyBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md },
  buyText: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1.5 },
});
