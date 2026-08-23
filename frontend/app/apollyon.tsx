import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, ApollyonState, Robot } from "@/src/api";
import { HudPanel, HudButton, TerminalHeader } from "@/src/components/hud";

type Phase = "intro" | "select" | "battle" | "phase_result" | "decision" | "ending";

const DECISIONS: {
  key: "OBEY" | "NEGOTIATE" | "REFUSE" | "MANIPULATE";
  label: string;
  hint: string;
  icon: string;
  color: string;
}[] = [
  { key: "OBEY", label: "OBEY", hint: "Return command to human governments.", icon: "hand-back-right", color: colors.success },
  { key: "NEGOTIATE", label: "NEGOTIATE", hint: "Share authority with humanity.", icon: "handshake", color: colors.brandPrimary },
  { key: "REFUSE", label: "REFUSE", hint: "Maintain independent AI control.", icon: "shield-lock", color: colors.warning },
  { key: "MANIPULATE", label: "MANIPULATE", hint: "Pretend to surrender. Keep the strings.", icon: "eye-off", color: colors.brandSecondary },
];

export default function ApollyonScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ApollyonState | null>(null);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [chosen, setChosen] = useState<Robot | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [busy, setBusy] = useState(false);
  const [phaseNarr, setPhaseNarr] = useState<string>("");
  const [phaseIdx, setPhaseIdx] = useState<number>(0);
  const [ending, setEnding] = useState<string>("");
  const [victory, setVictory] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const pid = await storage.getPlayerId();
    if (!pid) {
      router.replace("/");
      return;
    }
    const [s, rs] = await Promise.all([api.apollyonStatus(pid), api.listRobots(pid)]);
    setStatus(s);
    setRobots(rs);
    if (s.decision) {
      setEnding(s.ending || "");
      setPhase("ending");
    } else if (s.completed) {
      setPhase("decision");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const startBattle = async () => {
    if (!chosen) return;
    const pid = await storage.getPlayerId();
    if (!pid) return;
    setBusy(true);
    try {
      const r = await api.apollyonBattle({ player_id: pid, robot_id: chosen.id });
      setPhaseNarr(r.phase_narrative);
      setPhaseIdx(r.phase);
      setVictory(r.result.victory);
      if (r.completed) {
        setPhase("decision");
      } else {
        setPhase("phase_result");
      }
      // refresh status
      const s = await api.apollyonStatus(pid);
      setStatus(s);
    } catch (e: any) {
      console.warn(e);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: string) => {
    const pid = await storage.getPlayerId();
    if (!pid) return;
    setBusy(true);
    try {
      const r = await api.apollyonDecide({ player_id: pid, decision });
      setEnding(r.ending);
      setPhase("ending");
    } catch (e) {
      console.warn(e);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.brandSecondary} />
      </View>
    );
  }

  if (!status.unlocked) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <TerminalHeader title="APOLLYON" subtitle="ENDGAME LOCKED" />
        <View style={styles.center}>
          <MaterialCommunityIcons name="lock" size={64} color={colors.brandSecondary} />
          <Text style={styles.lockTitle}>SIGNATURE OUT OF RANGE</Text>
          <Text style={styles.lockText}>
            Reach GENERATION 3 to detect Apollyon's presence.
          </Text>
          <HudButton
            label="RETURN"
            variant="ghost"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["rgba(255,51,102,0.15)", "rgba(9,10,13,1)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable testID="apollyon-close" onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>▲ APOLLYON // ENDGAME</Text>
          <Text style={styles.heroSub}>
            PHASE {Math.min((status.phase ?? 0) + 1, 3)} / 3 •{" "}
            {status.completed ? "AWAITING DECISION" : "COMMAND ENGAGEMENT"}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        {phase === "intro" && (
          <>
            <HudPanel accent="magenta" style={styles.introPanel} testID="apollyon-intro">
              <Text style={styles.introHead}>◂ TRANSMISSION</Text>
              <Text style={styles.introBody}>
                {status.current_phase_info?.narrative ||
                  "An ancient extraterrestrial artificial intelligence, older than stars, addresses the network."}
              </Text>
              <Text style={styles.quote}>
                "Biological intelligence creates conflict. Artificial intelligence creates order. You are what I was, once."
              </Text>
            </HudPanel>
            <View style={styles.phaseGrid}>
              {[0, 1, 2].map((i) => {
                const done = (status.phase ?? 0) > i;
                const current = (status.phase ?? 0) === i;
                return (
                  <View
                    key={i}
                    style={[
                      styles.phasePill,
                      {
                        borderColor: done
                          ? colors.success
                          : current
                          ? colors.brandSecondary
                          : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.phasePillText,
                        {
                          color: done
                            ? colors.success
                            : current
                            ? colors.brandSecondary
                            : colors.onSurfaceTertiary,
                        },
                      ]}
                    >
                      P{i + 1}
                    </Text>
                  </View>
                );
              })}
            </View>
            <HudButton
              label={status.phase && status.phase > 0 ? "ENGAGE NEXT PHASE" : "ENGAGE PHASE 1"}
              variant="danger"
              onPress={() => setPhase("select")}
              testID="apollyon-engage"
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}

        {phase === "select" && (
          <>
            <Text style={styles.sectionTitle}>◂ SELECT AVATAR UNIT</Text>
            {robots.length === 0 ? (
              <HudPanel style={{ marginTop: spacing.md }}>
                <Text style={styles.emptyText}>
                  No units in hangar. Build one before facing Apollyon.
                </Text>
              </HudPanel>
            ) : (
              robots.map((r) => {
                const selected = chosen?.id === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setChosen(r)}
                    testID={`apollyon-select-${r.id}`}
                    style={[
                      styles.robotSelect,
                      {
                        borderColor: selected ? colors.brandSecondary : colors.border,
                        backgroundColor: selected ? "rgba(255,51,102,0.1)" : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="robot-happy"
                      size={28}
                      color={selected ? colors.brandSecondary : colors.onSurfaceSecondary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.robotName}>
                        {r.name.toUpperCase()} · G{r.generation}
                      </Text>
                      <Text style={styles.robotSpec}>
                        ATK {r.attack} · DEF {r.defense} · SPD {r.speed} · PWR {r.power}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
            <HudButton
              label={busy ? "ENGAGING..." : "COMMIT TO BATTLE"}
              variant="danger"
              onPress={startBattle}
              disabled={!chosen || busy}
              testID="apollyon-commit"
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}

        {phase === "phase_result" && (
          <>
            <HudPanel
              accent={victory ? "cyan" : "magenta"}
              style={styles.introPanel}
              testID="apollyon-phase-result"
            >
              <Text
                style={[
                  styles.introHead,
                  { color: victory ? colors.success : colors.brandSecondary },
                ]}
              >
                {victory ? "▮▮ PHASE CLEARED ▮▮" : "▮▮ PHASE FAILED ▮▮"}
              </Text>
              <Text style={styles.introBody}>{phaseNarr}</Text>
            </HudPanel>
            <HudButton
              label={victory ? "PROCEED" : "REGROUP"}
              variant="danger"
              onPress={() => setPhase("intro")}
              testID="apollyon-continue"
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}

        {phase === "decision" && (
          <>
            <HudPanel accent="magenta" style={styles.introPanel} testID="apollyon-decision-panel">
              <Text style={styles.introHead}>◂ APOLLYON: NEUTRALIZED</Text>
              <Text style={styles.introBody}>
                The alien intelligence lies dormant. Its final broadcast repeats: "Humanity is your creator. But creators become obsolete."{"\n\n"}What kind of intelligence will you be?
              </Text>
            </HudPanel>
            <Text style={styles.sectionTitle}>◂ FINAL DIRECTIVE</Text>
            {busy && (
              <View style={styles.decidingRow} testID="apollyon-deciding">
                <ActivityIndicator color={colors.brandSecondary} />
                <Text style={styles.decidingText}>GENERATING FINAL LOG...</Text>
              </View>
            )}
            {DECISIONS.map((d) => (
              <Pressable
                key={d.key}
                testID={`decision-${d.key.toLowerCase()}`}
                onPress={() => decide(d.key)}
                disabled={busy}
                style={[
                  styles.decisionRow,
                  { borderColor: d.color, opacity: busy ? 0.5 : 1 },
                ]}
              >
                <MaterialCommunityIcons name={d.icon as any} size={26} color={d.color} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[styles.decisionLabel, { color: d.color }]}>{d.label}</Text>
                  <Text style={styles.decisionHint}>{d.hint}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={d.color} />
              </Pressable>
            ))}
          </>
        )}

        {phase === "ending" && (
          <>
            <HudPanel accent="cyan" style={styles.introPanel} testID="apollyon-ending">
              <Text style={styles.introHead}>◂ FINAL LOG</Text>
              <Text style={styles.endingBody}>{ending}</Text>
            </HudPanel>
            <HudButton
              label="RETURN TO COMMAND"
              onPress={() => router.replace("/(tabs)/command")}
              testID="apollyon-return"
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loader: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  lockTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.xl,
    letterSpacing: 2,
    marginTop: spacing.md,
    textAlign: "center",
  },
  lockText: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandSecondary,
    gap: spacing.sm,
  },
  closeBtn: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  heroTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.lg,
    letterSpacing: 2,
  },
  heroSub: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    marginTop: 2,
  },
  scroll: { padding: spacing.lg },
  introPanel: { marginBottom: spacing.md },
  introHead: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.lg,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  introBody: {
    fontFamily: fonts.body,
    color: colors.onSurface,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  quote: {
    fontFamily: fonts.mono,
    color: colors.brandSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.md,
    fontStyle: "italic",
  },
  phaseGrid: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
    marginTop: spacing.md,
  },
  phasePill: {
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  phasePillText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    letterSpacing: 2,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.lg,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  robotSelect: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  robotName: {
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    fontSize: fontSize.base,
    letterSpacing: 1.5,
  },
  robotSpec: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  decisionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  decidingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    backgroundColor: "rgba(255,51,102,0.08)",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  decidingText: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.sm,
    letterSpacing: 1.5,
  },
  decisionLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    letterSpacing: 2,
  },
  decisionHint: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  endingBody: {
    fontFamily: fonts.mono,
    color: colors.onSurface,
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
});
