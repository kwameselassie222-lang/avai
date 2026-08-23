import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { api, storage, Robot, Threat, BattleResult, Region, ALIEN_CLASS_META } from "@/src/api";
import { HudPanel, HudButton, StatPill, TerminalHeader } from "@/src/components/hud";

const ARENA_BG =
  "https://images.pexels.com/photos/7900586/pexels-photo-7900586.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

type Phase = "select" | "briefing" | "combat" | "result";

export default function Combat() {
  const params = useLocalSearchParams<{ threat?: string; region?: string }>();
  const router = useRouter();
  const parsedRegion: Region | null = params.region ? JSON.parse(params.region as string) : null;
  const threat: Threat | null = params.threat
    ? JSON.parse(params.threat as string)
    : parsedRegion
    ? {
        id: `region-${parsedRegion.id}`,
        name: `${parsedRegion.name} Defense`,
        location: parsedRegion.location,
        alien_class: "sentinel",
        threat_level: 5,
        hp: 60,
        attack: 15,
        defense: 8,
        speed: 8,
        weakness: "emp",
        reward_xp: 90,
        reward_credits: 150,
        reward_materials: 55,
        reward_research: 12,
        description: `Regional Incursion in ${parsedRegion.name} — Apollyon strike team destabilizing our ${parsedRegion.resource} pipeline.`,
      }
    : null;

  const [phase, setPhase] = useState<Phase>("select");
  const [robots, setRobots] = useState<Robot[]>([]);
  const [chosen, setChosen] = useState<Robot | null>(null);
  const [brief, setBrief] = useState<string>("");
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [replayIdx, setReplayIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const pid = await storage.getPlayerId();
      if (!pid || !threat) {
        router.back();
        return;
      }
      const list = await api.listRobots(pid);
      setRobots(list);
    })();
  }, [router, threat]);

  const openBrief = async () => {
    if (!threat) return;
    setPhase("briefing");
    setLoadingBrief(true);
    setBrief("");
    try {
      const res = await api.brief(threat);
      setBrief(res.brief);
    } catch (e) {
      setBrief(
        `// APOLLYON SCAN — ${threat.name.toUpperCase()}\nSIGNAL LOST\nRE-ATTEMPT LATER`
      );
    } finally {
      setLoadingBrief(false);
    }
  };

  const engage = async () => {
    if (!threat || !chosen) return;
    const pid = await storage.getPlayerId();
    if (!pid) return;
    setPhase("combat");
    setReplayIdx(0);
    try {
      if (parsedRegion) {
        const r = await api.attackRegion({
          player_id: pid,
          region_id: parsedRegion.id,
          robot_id: chosen.id,
        });
        setResult(r.result);
      } else {
        const r = await api.battle({
          player_id: pid,
          robot_id: chosen.id,
          threat,
        });
        setResult(r);
      }
    } catch (e) {
      console.warn("battle failed", e);
      router.back();
    }
  };

  // Replay animation
  useEffect(() => {
    if (phase !== "combat" || !result) return;
    if (replayIdx >= result.rounds.length) {
      const t = setTimeout(() => setPhase("result"), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setReplayIdx((n) => n + 1), 550);
    return () => clearTimeout(t);
  }, [phase, replayIdx, result]);

  if (!threat) return null;

  const currentRound = result?.rounds[Math.max(0, replayIdx - 1)];
  const robotHp = currentRound?.robot_hp ?? (chosen ? 40 + chosen.defense * 3 : 40);
  const threatHp = currentRound?.threat_hp ?? threat.hp;
  const maxRobotHp = chosen ? 40 + chosen.defense * 3 : 40;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <Image source={{ uri: ARENA_BG }} style={styles.bg} contentFit="cover" />
      <LinearGradient
        colors={["rgba(9,10,13,0.4)", "rgba(9,10,13,0.95)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.top}>
        <Pressable onPress={() => router.back()} testID="combat-close" style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.hostileRow}>
            <MaterialCommunityIcons
              name={ALIEN_CLASS_META[threat.alien_class].icon as any}
              size={16}
              color={ALIEN_CLASS_META[threat.alien_class].color}
            />
            <Text
              style={[
                styles.hostileHeader,
                { color: ALIEN_CLASS_META[threat.alien_class].color },
              ]}
              testID="alien-class-banner"
            >
              {ALIEN_CLASS_META[threat.alien_class].label} // {threat.name.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.hostileSub}>
            {threat.location.toUpperCase()} • CLASS {threat.threat_level} • {ALIEN_CLASS_META[threat.alien_class].tag}
          </Text>
        </View>
      </View>

      {phase === "select" && (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <Text style={styles.sectionTitle}>◂ SELECT DEPLOYMENT UNIT</Text>
          {robots.length === 0 ? (
            <HudPanel style={{ marginTop: spacing.lg }}>
              <Text style={styles.emptyText}>
                No units in hangar. Build a robot before engaging.
              </Text>
              <HudButton
                label="OPEN BUILDER"
                onPress={() => router.replace("/(tabs)/builder")}
                testID="goto-builder"
                style={{ marginTop: spacing.md }}
              />
            </HudPanel>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {robots.map((r) => {
                const selected = chosen?.id === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setChosen(r)}
                    testID={`select-${r.name.replace(/\s+/g, "-")}`}
                    style={[
                      styles.robotSelect,
                      {
                        borderColor: selected ? colors.brandPrimary : colors.border,
                        backgroundColor: selected ? colors.brandTertiary : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="robot-happy"
                      size={28}
                      color={selected ? colors.brandPrimary : colors.onSurfaceSecondary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.robotSelectName}>{r.name.toUpperCase()}</Text>
                      <Text style={styles.robotSelectSpec}>
                        ATK {r.attack} • DEF {r.defense} • SPD {r.speed} • PWR {r.power}
                      </Text>
                    </View>
                    {r.weapon === threat.weakness && (
                      <View style={styles.matchBadge}>
                        <Text style={styles.matchText}>WEAK↑</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.actionsRow}>
            <HudButton
              label="SCAN ▶"
              variant="ghost"
              onPress={openBrief}
              testID="scan-button"
              style={{ flex: 1 }}
            />
            <HudButton
              label="ENGAGE"
              variant="danger"
              onPress={engage}
              disabled={!chosen}
              testID="engage-button"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

      {phase === "briefing" && (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <HudPanel accent="magenta" style={{ flex: 1 }} testID="brief-panel">
            <Text style={styles.briefTitle}>◂ APOLLYON COUNTER-SCAN</Text>
            {loadingBrief ? (
              <View style={{ marginTop: spacing.lg }}>
                <ActivityIndicator color={colors.brandSecondary} />
                <Text style={styles.briefLoading}>DECRYPTING ALIEN SIGNAL...</Text>
              </View>
            ) : (
              <ScrollView>
                <Text style={styles.briefText} testID="brief-text">{brief}</Text>
              </ScrollView>
            )}
          </HudPanel>
          <HudButton
            label="RETURN"
            variant="ghost"
            onPress={() => setPhase("select")}
            style={{ marginTop: spacing.md }}
            testID="brief-return"
          />
        </View>
      )}

      {(phase === "combat" || phase === "result") && chosen && (
        <View style={{ flex: 1, padding: spacing.lg }}>
          {/* Threat panel */}
          <HudPanel accent="magenta" style={styles.combatPanel} testID="combat-threat">
            <Text style={styles.combatName}>{threat.name.toUpperCase()}</Text>
            <HpBar hp={threatHp} max={threat.hp} color={colors.brandSecondary} testID="hp-threat" />
          </HudPanel>

          {/* Log */}
          <ScrollView style={styles.log} contentContainerStyle={{ padding: spacing.md }}>
            {result?.rounds.slice(0, replayIdx).map((r) => (
              <Text key={r.round} style={styles.logLine}>
                {`> RND ${String(r.round).padStart(2, "0")}  YOU→${r.robot_dmg}  ENEMY→${r.threat_dmg}`}
              </Text>
            ))}
            {phase === "result" && result && (
              <Text
                style={[
                  styles.logResult,
                  { color: result.victory ? colors.success : colors.brandSecondary },
                ]}
                testID="battle-outcome"
              >
                {result.victory ? "▮▮ VICTORY ▮▮" : "▮▮ DEFEAT ▮▮"}
              </Text>
            )}
            {phase === "result" && result?.adaptation_note && (
              <Text style={styles.adaptLine} testID="adaptation-note">
                ⚠ {result.adaptation_note}
              </Text>
            )}
            {phase === "result" && result && (
              <View style={styles.rewardBlock}>
                <Text style={styles.rewardLine}>+{result.xp_gained} XP  +{result.credits_gained}c</Text>
                {result.materials_gained !== 0 && (
                  <Text style={[styles.rewardLine, { color: result.materials_gained > 0 ? colors.brandPrimary : colors.brandSecondary }]}>
                    {result.materials_gained > 0 ? "+" : ""}{result.materials_gained} MATERIALS
                  </Text>
                )}
                {result.research_gained > 0 && (
                  <Text style={[styles.rewardLine, { color: colors.brandSecondary }]}>
                    +{result.research_gained} RESEARCH ⚛
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Player panel */}
          <HudPanel accent="cyan" style={styles.combatPanel} testID="combat-robot">
            <Text style={styles.combatName}>{chosen.name.toUpperCase()}</Text>
            <HpBar hp={robotHp} max={maxRobotHp} color={colors.brandPrimary} testID="hp-robot" />
          </HudPanel>

          {phase === "result" && (
            <HudButton
              testID="combat-done"
              label="RETURN TO COMMAND"
              onPress={() => router.replace("/(tabs)/command")}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function HpBar({ hp, max, color, testID }: { hp: number; max: number; color: string; testID?: string }) {
  const pct = Math.max(0, Math.min(1, hp / max));
  const segments = 20;
  const filled = Math.round(pct * segments);
  return (
    <View testID={testID} style={styles.hpRow}>
      <View style={styles.hpBar}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.hpSeg,
              {
                backgroundColor: i < filled ? color : colors.surfaceTertiary,
                borderColor: i < filled ? color : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.hpText, { color }]}>{hp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 0.5 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandSecondary,
    gap: spacing.sm,
  },
  closeBtn: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hostileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hostileHeader: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.lg,
    letterSpacing: 1.5,
    flexShrink: 1,
  },
  hostileSub: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandPrimary,
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
  robotSelectName: {
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    fontSize: fontSize.base,
    letterSpacing: 1.5,
  },
  robotSelectSpec: {
    fontFamily: fonts.body,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: 1,
  },
  matchBadge: {
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(0,255,102,0.1)",
  },
  matchText: {
    fontFamily: fonts.displayBold,
    color: colors.success,
    fontSize: 10,
    letterSpacing: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  briefTitle: {
    fontFamily: fonts.displayBold,
    color: colors.brandSecondary,
    fontSize: fontSize.lg,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  briefLoading: {
    fontFamily: fonts.mono,
    color: colors.brandSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
    textAlign: "center",
    letterSpacing: 1,
  },
  briefText: {
    fontFamily: fonts.mono,
    color: colors.onSurface,
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
  combatPanel: { marginBottom: spacing.md },
  combatName: {
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    fontSize: fontSize.base,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  hpRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hpBar: { flex: 1, flexDirection: "row", gap: 1 },
  hpSeg: { flex: 1, height: 10, borderWidth: 1 },
  hpText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    width: 40,
    textAlign: "right",
  },
  log: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0,0,0,0.55)",
    marginBottom: spacing.md,
  },
  logLine: {
    fontFamily: fonts.mono,
    color: colors.brandPrimary,
    fontSize: fontSize.sm,
    marginBottom: 4,
  },
  logResult: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xxl,
    letterSpacing: 3,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  rewardLine: {
    fontFamily: fonts.displayBold,
    color: colors.warning,
    fontSize: fontSize.base,
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  rewardBlock: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  adaptLine: {
    fontFamily: fonts.displayBold,
    color: colors.warning,
    fontSize: fontSize.sm,
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: "rgba(255,176,32,0.08)",
  },
});
