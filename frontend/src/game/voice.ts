import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";

// Backend base URL — derives absolute URL for expo-audio
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const MUTE_KEY = "aliens_vai_voice_muted";

export type Speaker = "unit_one" | "renn" | "apollyon" | "narrator" | "queen";

/**
 * Heuristic speaker detection based on panel body / header text.
 * A.I. UNIT ONE — the game's protagonist AI (deep voice)
 * Dr. Kaya Renn — human scientist
 * Apollyon — ancient alien AI
 * Hive Queen — voice from the Tokyo hive
 * Narrator — default cinematic voice for setting/threat/action lines
 */
export function detectSpeaker(header: string, body: string): Speaker {
  const h = header.toUpperCase();
  const b = body.toUpperCase();
  const both = `${h}\n${b}`;

  if (h.includes("APOLLYON") || b.includes("APOLLYON") || h.includes("THE VOICE")) return "apollyon";
  if (h.includes("HIVE QUEEN") || h.includes("HER VOICE") || b.includes("HIVE QUEEN")) return "queen";
  if (h.includes("DR.") || h.includes("KAYA RENN") || b.includes("DR. RENN") || b.includes("KAYA RENN")) return "renn";
  if (both.includes("A.I. UNIT ONE") || both.includes("UNIT ONE:") || h.includes("DIRECTIVE") || h.includes("ACTIVATE")) return "unit_one";
  return "narrator";
}

// Module-level player + mute state
let voicePlayer: ReturnType<typeof createAudioPlayer> | null = null;
let audioModeSet = false;
let voiceMuted = false;
let muteLoaded = false;
type MuteListener = (muted: boolean) => void;
const muteListeners: Set<MuteListener> = new Set();

async function ensureMode() {
  if (audioModeSet) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
    audioModeSet = true;
  } catch {}
}

/** Load persisted mute preference. Call at app start (or before first play). */
export async function loadMutePref(): Promise<boolean> {
  if (muteLoaded) return voiceMuted;
  try {
    const raw = await AsyncStorage.getItem(MUTE_KEY);
    voiceMuted = raw === "1";
  } catch {
    voiceMuted = false;
  }
  muteLoaded = true;
  return voiceMuted;
}

/** Current mute state (synchronous). Call loadMutePref() at app start to hydrate. */
export function isVoiceMuted(): boolean {
  return voiceMuted;
}

/** Toggle or set mute — stops current playback if muting. Persists to storage. */
export async function setVoiceMuted(m: boolean): Promise<void> {
  voiceMuted = m;
  muteLoaded = true;
  try { await AsyncStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch {}
  if (m) stopVoice();
  muteListeners.forEach((fn) => fn(m));
}

export function subscribeMute(fn: MuteListener): () => void {
  muteListeners.add(fn);
  return () => { muteListeners.delete(fn); };
}

export function stopVoice() {
  try { voicePlayer?.pause(); } catch {}
}

/**
 * Fetch TTS URL from backend, download-cache-free playback via streaming.
 * Returns true if playback started, false on failure or muted.
 */
export async function playPanelVoice(header: string, body: string, forceSpeaker?: Speaker): Promise<boolean> {
  try {
    if (!muteLoaded) await loadMutePref();
    if (voiceMuted) return false;
    await ensureMode();
    const speaker = forceSpeaker || detectSpeaker(header, body);
    const line = `${header}. ${body}`;
    const res = await api.v2TTSCreate(line, speaker);
    // Respect a race: user may have muted while awaiting network
    if (voiceMuted) return false;
    const absoluteUrl = res.url.startsWith("http") ? res.url : `${API_BASE}${res.url}`;
    // Stop previous
    stopVoice();
    // Create / replace player
    if (voicePlayer) {
      try { voicePlayer.replace({ uri: absoluteUrl }); } catch {
        voicePlayer = createAudioPlayer({ uri: absoluteUrl });
      }
    } else {
      voicePlayer = createAudioPlayer({ uri: absoluteUrl });
    }
    voicePlayer.volume = 1.0;
    voicePlayer.play();
    return true;
  } catch (e) {
    console.warn("voice-over failed", e);
    return false;
  }
}
