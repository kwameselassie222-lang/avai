import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, Doctrine, Robot, LayerId } from "@/src/api";
import { LAYER_META } from "@/src/defense-meta";
import { TerminalHeader, HudButton } from "@/src/components/hud";

const LAYER_OPTIONS: LayerId[] = ["deep_space", "orbital", "atmosphere", "ground"];

export default function DoctrinesScreen() {
  const router = useRouter();
  const [doctrines, setDoctrines] = useState<Doctrine[]>([]);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Doctrine | null>(null);

  const load = useCallback(async () => {
    const id = await storage.getPlayerId();
    if (!id) return;
    const [d, r] = await Promise.all([api.listDoctrines(id), api.listRobots(id)]);
    setDoctrines(d);
    setRobots(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () =>
    setEditor({ name: `DOCTRINE_${doctrines.length + 1}`, robot_ids: [], target_layer: "orbital" });

  const save = async () => {
    if (!editor) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    if (!editor.name.trim()) { Alert.alert("Name required"); return; }
    try {
      setBusy(true);
      await api.saveDoctrine({ player_id: id, doctrine: editor });
      setEditor(null);
      await load();
    } catch (e: any) {
      Alert.alert("SAVE FAILED", String(e.message || e));
    } finally { setBusy(false); }
  };

  const remove = async (docId?: string) => {
    if (!docId) return;
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      await api.deleteDoctrine({ player_id: id, doctrine_id: docId });
      await load();
    } catch (e: any) {
      Alert.alert("DELETE FAILED", String(e.message || e));
    } finally { setBusy(false); }
  };

  const deploy = async (d: Doctrine) => {
    if (!d.id || !d.target_layer) { Alert.alert("Set target layer first"); return; }
    const id = await storage.getPlayerId();
    if (!id) return;
    try {
      setBusy(true);
      const res = await api.deployDoctrine({ player_id: id, doctrine_id: d.id });
      Alert.alert("DEPLOYED", `${res.assigned} robot${res.assigned === 1 ? "" : "s"} → ${LAYER_META[res.layer]?.name}`);
    } catch (e: any) {
      Alert.alert("DEPLOY FAILED", String(e.message || e));
    } finally { setBusy(false); }
  };

  const toggleRobot = (rid: string) => {
    if (!editor) return;
    if (editor.robot_ids.includes(rid)) {
      setEditor({ ...editor, robot_ids: editor.robot_ids.filter((x) => x !== rid) });
    } else {
      setEditor({ ...editor, robot_ids: [...editor.robot_ids, rid] });
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.brandPrimary} /></View>;

  // Editor view
  if (editor) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <TerminalHeader
          title="DOCTRINE EDITOR"
          subtitle={editor.id ? "EDIT" : "NEW LOADOUT"}
          right={<Pressable onPress={() => setEditor(null)} style={styles.back}><MaterialCommunityIcons name="chevron-left" size={20} color={colors.brandPrimary} /></Pressable>}
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>▮ NAME</Text>
          <TextInput
            value={editor.name}
            onChangeText={(t) => setEditor({ ...editor, name: t })}
            style={styles.input}
            placeholder="DOCTRINE_1"
            placeholderTextColor={colors.onSurfaceTertiary}
            testID="doctrine-name"
          />
          <Text style={styles.label}>▮ TARGET LAYER</Text>
          <View style={styles.layerRow}>
            {LAYER_OPTIONS.map((lid) => {
              const m = LAYER_META[lid];
              const selected = editor.target_layer === lid;
              return (
                <Pressable
                  key={lid}
                  onPress={() => setEditor({ ...editor, target_layer: lid })}
                  style={[
                    styles.layerChip,
                    { borderColor: selected ? m.color : colors.border, backgroundColor: selected ? `${m.color}22` : colors.surfaceSecondary },
                  ]}
                  testID={`doctrine-layer-${lid}`}
                >
                  <MaterialCommunityIcons name={m.icon as any} size={14} color={m.color} />
                  <Text style={[styles.layerChipText, { color: selected ? m.color : colors.onSurfaceSecondary }]}>{m.name.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>▮ ROBOTS ({editor.robot_ids.length})</Text>
          {robots.length === 0 && <Text style={styles.empty}>No robots. Build in Builder tab.</Text>}
          {robots.map((r) => {
            const sel = editor.robot_ids.includes(r.id);
            return (
              <Pressable
                key={r.id}
                onPress={() => toggleRobot(r.id)}
                style={[styles.robotRow, { borderColor: sel ? colors.brandPrimary : colors.border }]}
                testID={`doctrine-robot-${r.id}`}
              >
                <MaterialCommunityIcons name={sel ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={sel ? colors.brandPrimary : colors.onSurfaceTertiary} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.robotName}>{r.name}</Text>
                  <Text style={styles.robotMeta}>GEN {r.generation} • PWR {r.power} • {r.weapon.toUpperCase()}</Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: 20 }} />
          <HudButton label={busy ? "..." : "▮ SAVE DOCTRINE"} onPress={save} disabled={busy || !editor.name.trim()} testID="btn-save-doctrine" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <TerminalHeader
        title="DEFENSE // DOCTRINES"
        subtitle={`${doctrines.length} named loadout${doctrines.length === 1 ? "" : "s"}`}
        right={<Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="close" size={20} color={colors.brandPrimary} /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>◆ Save named robot loadouts and deploy them to a layer as a single unit.</Text>
        {doctrines.map((d) => {
          const m = d.target_layer ? LAYER_META[d.target_layer] : null;
          return (
            <View key={d.id} style={styles.doctrineCard} testID={`doctrine-${d.id}`}>
              <View style={styles.doctrineHeader}>
                <MaterialCommunityIcons name={m?.icon as any || "shield-account"} size={18} color={m?.color || colors.brandPrimary} />
                <Text style={styles.doctrineName}>{d.name.toUpperCase()}</Text>
                <Pressable onPress={() => remove(d.id)} style={styles.iconBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.brandSecondary} />
                </Pressable>
                <Pressable onPress={() => setEditor(d)} style={styles.iconBtn}>
                  <MaterialCommunityIcons name="pencil" size={16} color={colors.brandPrimary} />
                </Pressable>
              </View>
              <Text style={styles.doctrineMeta}>
                {d.robot_ids.length} robot{d.robot_ids.length === 1 ? "" : "s"}
                {m ? `  →  ${m.name.toUpperCase()}` : "  → NO TARGET LAYER"}
              </Text>
              <Pressable
                onPress={() => deploy(d)}
                disabled={busy || !d.target_layer || d.robot_ids.length === 0}
                style={[
                  styles.deployBtn,
                  {
                    borderColor: d.target_layer && d.robot_ids.length > 0 ? (m?.color || colors.brandPrimary) : colors.border,
                    opacity: d.target_layer && d.robot_ids.length > 0 ? 1 : 0.4,
                  },
                ]}
                testID={`deploy-${d.id}`}
              >
                <MaterialCommunityIcons name="rocket-launch" size={14} color={m?.color || colors.brandPrimary} />
                <Text style={[styles.deployText, { color: m?.color || colors.brandPrimary }]}>DEPLOY</Text>
              </Pressable>
            </View>
          );
        })}
        <Pressable onPress={openNew} style={styles.newBtn} testID="new-doctrine">
          <MaterialCommunityIcons name="plus-circle" size={18} color={colors.brandPrimary} />
          <Text style={styles.newText}>NEW DOCTRINE</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  back: { padding: spacing.xs },
  hint: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginBottom: spacing.md, letterSpacing: 0.5 },
  label: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.xs, letterSpacing: 1.5, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    color: colors.onSurface, fontFamily: fonts.displayBold, fontSize: fontSize.lg, letterSpacing: 1.5,
    padding: spacing.sm, backgroundColor: colors.surfaceSecondary,
  },
  layerRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  layerChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: radius.md,
  },
  layerChipText: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1 },
  empty: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginBottom: spacing.md },
  robotRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  robotName: { fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.sm, letterSpacing: 1 },
  robotMeta: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  doctrineCard: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  doctrineHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  doctrineName: { flex: 1, fontFamily: fonts.displayBold, color: colors.onSurface, fontSize: fontSize.base, letterSpacing: 1.5 },
  iconBtn: { padding: 4 },
  doctrineMeta: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 4, letterSpacing: 0.5 },
  deployBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", marginTop: spacing.sm,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.md,
  },
  deployText: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, letterSpacing: 1.5 },
  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.brandPrimary, borderStyle: "dashed",
    borderRadius: radius.md, padding: spacing.md,
    justifyContent: "center", marginTop: spacing.sm,
  },
  newText: { fontFamily: fonts.displayBold, color: colors.brandPrimary, fontSize: fontSize.sm, letterSpacing: 1.5 },
});
