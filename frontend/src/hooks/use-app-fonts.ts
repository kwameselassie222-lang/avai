// Load display + body fonts for ALIENS V A.I.
// Fonts are loaded from Google's public GitHub mirror (raw TTF).
// If the network is unreachable we still boot with system fallbacks.
import { useFonts } from "expo-font";

const GH_ROOT = "https://raw.githubusercontent.com/google/fonts/main/ofl";

export const useAppFonts = () =>
  useFonts({
    // Rajdhani for HUD/display
    Rajdhani: `${GH_ROOT}/rajdhani/Rajdhani-Regular.ttf`,
    "Rajdhani-Bold": `${GH_ROOT}/rajdhani/Rajdhani-Bold.ttf`,
    // IBM Plex Sans for body text
    IBMPlexSans: `${GH_ROOT}/ibmplexsans/IBMPlexSans-Regular.ttf`,
    "IBMPlexSans-Bold": `${GH_ROOT}/ibmplexsans/IBMPlexSans-Bold.ttf`,
    // IBM Plex Mono for terminal text
    IBMPlexMono: `${GH_ROOT}/ibmplexmono/IBMPlexMono-Regular.ttf`,
  });
