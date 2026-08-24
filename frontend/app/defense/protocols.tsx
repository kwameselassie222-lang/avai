import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, ProtocolRule } from "@/src/api";
import { PROTOCOL_CONDITIONS, PROTOCOL_ACTIONS, SHIP_META, LAYER_META } from "@/src/defense-meta";
import { TerminalHeader, HudButton } from "@/src/components/hud";

/**
 * Visual IF/THEN protocol editor.
 * Each rule: name, priority, enabled, conditions[], actions[]
 * Conditions: ship_type = <value>  AND  layer = <value>
 * Actions: priority = max/high/normal/low ; mode = attack/defend/ignore
 */
export default function ProtocolsScreen() {
  const router = useRouter();
  const [rules, setRules] = useState<ProtocolRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const d = await api.defenseState(id);
    setRules(d.protocols || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      await api.saveProtocols({ player_id: id, protocols: rules });
      Alert.alert("PROTOCOLS COMPILED", `${rules.length} rule${rules.length === 1 ? "" : "s"} deployed.`);
    } catch (e: any) {
      Alert.alert("SAVE FAILED", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const addRule = () => {
    setRules([
      ...rules,
      {
        name: `RULE_${rules.length + 1}`,
        priority: 1,
        enabled: true,
        conditions: [{ key: "ship_type", op: "eq", value: "harvester" }],
        actions: [{ key: "priority", value: "max" }],
      },
    ]);
  };

  const updateRule = (idx: number, patch: Partial<ProtocolRule>) => {
    setRules(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRule = (idx: number) => setRules(rules.filter((_, i) => i !== idx));

  const addCondition = (idx: number) => {
    const r = rules[idx];
    updateRule(idx, {
      conditions: [...(r.conditions || []), { key: "layer", op: "eq", value: "orbital", combine: "and" }],
    });
  };

  const setCondition = (idx: number, cIdx: number, patch: any) => {
    const r = rules[idx];
    const conds = [...(r.conditions || [])];
    conds[cIdx] = { ...conds[cIdx], ...patch };
    updateRule(idx, { conditions: conds });
  };

  const removeCondition = (idx: number, cIdx: number) => {
    const r = rules[idx];
    updateRule(idx, { conditions: (r.conditions || []).filter((_, i) => i !== cIdx) });
  };

  const setAction = (idx: number, aIdx: number, patch: any) => {
    const r = rules[idx];
    const acts = [...(r.actions || [])];
    acts[aIdx] = { ...acts[aIdx], ...patch };
    updateRule(idx, { actions: acts });
  };

  const addAction = (idx: number) => {
    const r = rules[idx];
    updateRule(idx, {
      actions: [...(r.actions || []), { key: "mode", value: "attack" }],
    });
  };

  const removeAction = (idx: number, aIdx: number) => {
    const r = rules[idx];
    updateRule(idx, { actions: (r.actions || []).filter((_, i) => i !== aIdx) });
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="DEFENSE // PROTOCOL EDITOR"
        subtitle={`${rules.length} RULE${rules.length === 1 ? "" : "S"} — VISUAL IF/THEN`}
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          ◆ Program Earth&apos;s AI. Rules apply during invasion engagement to modify robot response.
        </Text>

        {rules.map((r, idx) => (
          <View key={idx} style={[styles.ruleCard, { opacity: r.enabled ? 1 : 0.5 }]} testID={`rule-${idx}`}>
            <View style={styles.ruleHeader}>
              <TextInput
                value={r.name}
                onChangeText={(t) => updateRule(idx, { name: t })}
                style={styles.ruleName}
                placeholder="RULE NAME"
                placeholderTextColor={colors.onSurfaceTertiary}
                testID={`rule-name-${idx}`}
              />
              <Pressable onPress={() => updateRule(idx, { enabled: !r.enabled })} style={styles.togBtn}>
                <MaterialCommunityIcons
                  name={r.enabled ? "toggle-switch" : "toggle-switch-off"}
                  size={22}
                  color={r.enabled ? colors.success : colors.onSurfaceTertiary}
                />
              </Pressable>
              <Pressable onPress={() => removeRule(idx)} style={styles.togBtn}>
                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.brandSecondary} />
              </Pressable>
            </View>

            <Text style={styles.blockLabel}>IF</Text>
            {(r.conditions || []).map((c, cIdx) => (
              <View key={cIdx}>
                {cIdx > 0 && (
                  <Pressable
                    onPress={() =>
                      setCondition(idx, cIdx, { combine: (c.combine || "and") === "and" ? "or" : "and" })
                    }
                    style={styles.combinePill}
                    testID={`combine-${idx}-${cIdx}`}
                  >
                    <Text style={styles.combineText}>
                      {((c.combine || "and") as string).toUpperCase()}
                    </Text>
                  </Pressable>
                )}
                <View style={styles.pillRow}>
                  <ChipSelect
                    options={PROTOCOL_CONDITIONS.map((p) => ({ label: p.label, value: p.key }))}
                    value={c.key}
                    onChange={(v) => setCondition(idx, cIdx, { key: v, value: PROTOCOL_CONDITIONS.find((p) => p.key === v)?.values[0] || "" })}
                  />
                  <Text style={styles.eq}>=</Text>
                  <ChipSelect
                    options={
                      (PROTOCOL_CONDITIONS.find((p) => p.key === c.key)?.values || []).map((v) => ({
                        label: labelFor(c.key, v),
                        value: v,
                      }))
                    }
                    value={c.value}
                    onChange={(v) => setCondition(idx, cIdx, { value: v })}
                  />
                  <Pressable onPress={() => removeCondition(idx, cIdx)}>
                    <MaterialCommunityIcons name="minus-circle-outline" size={16} color={colors.brandSecondary} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable onPress={() => addCondition(idx)} style={styles.addBtn}>
              <MaterialCommunityIcons name="plus" size={12} color={colors.brandPrimary} />
              <Text style={styles.addText}>AND / OR</Text>
            </Pressable>

            <Text style={styles.blockLabel}>THEN</Text>
            {(r.actions || []).map((a, aIdx) => (
              <View key={aIdx} style={styles.pillRow}>
                <ChipSelect
                  options={PROTOCOL_ACTIONS.map((p) => ({ label: p.label, value: p.key }))}
                  value={a.key}
                  onChange={(v) => setAction(idx, aIdx, { key: v, value: PROTOCOL_ACTIONS.find((p) => p.key === v)?.values[0] || "" })}
                />
                <Text style={styles.eq}>=</Text>
                <ChipSelect
                  options={(PROTOCOL_ACTIONS.find((p) => p.key === a.key)?.values || []).map((v) => ({ label: v.toUpperCase(), value: v }))}
                  value={a.value}
                  onChange={(v) => setAction(idx, aIdx, { value: v })}
                />
                <Pressable onPress={() => removeAction(idx, aIdx)}>
                  <MaterialCommunityIcons name="minus-circle-outline" size={16} color={colors.brandSecondary} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => addAction(idx)} style={styles.addBtn}>
              <MaterialCommunityIcons name="plus" size={12} color={colors.brandPrimary} />
              <Text style={styles.addText}>THEN</Text>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={addRule} style={styles.newRuleBtn} testID="add-rule">
          <MaterialCommunityIcons name="plus-circle" size={18} color={colors.brandPrimary} />
          <Text style={styles.newRuleText}>NEW PROTOCOL RULE</Text>
        </Pressable>

        <View style={{ height: 20 }} />
        <HudButton
          label={busy ? "..." : "▮ COMPILE & DEPLOY"}
          onPress={save}
          disabled={busy}
          testID="btn-save-protocols"
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function labelFor(key: string, value: string) {
  if (key === "ship_type") return (SHIP_META[value]?.label || value).toUpperCase();
  if (key === "layer") return (LAYER_META[value]?.name || value).toUpperCase();
  if (key === "alien_class") return value.toUpperCase();
  if (key === "viability_below") return `< ${value}%`;
  if (key === "adaptation_active") return value;
  return value.toUpperCase();
}

function ChipSelect({
  options, value, onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const idx = options.findIndex((o) => o.value === value);
  const next = () => {
    const n = (idx + 1) % options.length;
    onChange(options[n].value);
  };
  return (
    <Pressable onPress={next} style={styles.chip}>
      <Text style={styles.chipText}>{options[idx]?.label || "…"}</Text>
      <MaterialCommunityIcons name="chevron-right" size={12} color={colors.brandPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  back: { padding: spacing.xs },
  hint: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: spacing.md, letterSpacing: 0.5 },

  ruleCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  ruleHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.xs },
  ruleName: {
    flex: 1,
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
    fontSize: fontSize.sm,
    letterSpacing: 1.5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 2,
  },
  togBtn: { padding: 4 },

  blockLabel: {
    fontFamily: fonts.displayBold,
    color: colors.warning,
    fontSize: fontSize.xs,
    letterSpacing: 2,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  eq: { fontFamily: fonts.displayBold, color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  chipText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xs, letterSpacing: 1 },
  combinePill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginVertical: 2,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,176,32,0.08)",
  },
  combineText: {
    fontFamily: fonts.displayBold,
    color: colors.warning,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 2 },
  addText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xs, letterSpacing: 1.2 },

  newRuleBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.brandPrimary, borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  newRuleText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5 },
});
