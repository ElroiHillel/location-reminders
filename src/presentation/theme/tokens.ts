/**
 * Design tokens for the Aurora design system.
 *
 * Colors live in ThemePalette (light + dark variants); everything here that is
 * theme-independent (spacing, radii, type scale, motion) is a plain constant.
 */

export type ThemeMode = "dark" | "light";

export interface ThemePalette {
  mode: ThemeMode;

  // Base backgrounds
  bg: string;
  bgElevated: string;

  // Aurora backdrop blobs (rgba, painted behind the frosted glass)
  auroraOne: string;
  auroraTwo: string;
  auroraThree: string;

  // Glass surfaces
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassHighlight: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Signature accent
  accent: string;
  accentGradientStart: string;
  accentGradientEnd: string;
  accentSoft: string;
  onAccent: string;

  // Secondary accent (violet→pink) for playful variety
  accentAltStart: string;
  accentAltEnd: string;

  // Semantic
  success: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  info: string;

  // Controls
  inputBg: string;
  inputBorder: string;
  overlay: string;
  chip: string;
  chipActive: string;

  // Elevation
  shadow: string;
}

export const darkPalette: ThemePalette = {
  mode: "dark",

  bg: "#060910",
  bgElevated: "#0B1120",

  auroraOne: "rgba(94, 234, 212, 0.28)", // mint
  auroraTwo: "rgba(139, 92, 246, 0.30)", // violet
  auroraThree: "rgba(244, 114, 182, 0.22)", // pink

  glass: "rgba(255, 255, 255, 0.055)",
  glassStrong: "rgba(255, 255, 255, 0.10)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
  glassHighlight: "rgba(255, 255, 255, 0.18)",

  text: "#F7FAFC",
  textSecondary: "#AEBACD",
  textMuted: "#727E93",

  accent: "#5EEAD4",
  accentGradientStart: "#5EEAD4",
  accentGradientEnd: "#38BDF8",
  accentSoft: "rgba(94, 234, 212, 0.16)",
  onAccent: "#04121A",

  accentAltStart: "#8B5CF6",
  accentAltEnd: "#F472B6",

  success: "#4ADE80",
  danger: "#FB7185",
  dangerSoft: "rgba(251, 113, 133, 0.16)",
  warning: "#FBBF24",
  info: "#38BDF8",

  inputBg: "rgba(255, 255, 255, 0.05)",
  inputBorder: "rgba(255, 255, 255, 0.14)",
  overlay: "rgba(3, 6, 12, 0.72)",
  chip: "rgba(255, 255, 255, 0.06)",
  chipActive: "rgba(94, 234, 212, 0.16)",

  shadow: "#000000",
};

export const lightPalette: ThemePalette = {
  mode: "light",

  bg: "#EEF2F9",
  bgElevated: "#FFFFFF",

  auroraOne: "rgba(45, 212, 191, 0.30)", // mint
  auroraTwo: "rgba(129, 140, 248, 0.28)", // indigo
  auroraThree: "rgba(244, 114, 182, 0.22)", // pink

  glass: "rgba(255, 255, 255, 0.62)",
  glassStrong: "rgba(255, 255, 255, 0.80)",
  glassBorder: "rgba(15, 23, 42, 0.08)",
  glassHighlight: "rgba(255, 255, 255, 0.9)",

  text: "#0C1526",
  textSecondary: "#475469",
  textMuted: "#8A94A6",

  accent: "#0D9488",
  accentGradientStart: "#0D9488",
  accentGradientEnd: "#0EA5E9",
  accentSoft: "rgba(13, 148, 136, 0.12)",
  onAccent: "#FFFFFF",

  accentAltStart: "#7C3AED",
  accentAltEnd: "#DB2777",

  success: "#16A34A",
  danger: "#E11D48",
  dangerSoft: "rgba(225, 29, 72, 0.10)",
  warning: "#D97706",
  info: "#0284C7",

  inputBg: "rgba(255, 255, 255, 0.72)",
  inputBorder: "rgba(15, 23, 42, 0.12)",
  overlay: "rgba(15, 23, 42, 0.35)",
  chip: "rgba(15, 23, 42, 0.05)",
  chipActive: "rgba(13, 148, 136, 0.14)",

  shadow: "#5B6478",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

export const typography = {
  hero: { fontSize: 26, lineHeight: 34, fontWeight: "800" as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800" as const },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: "700" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "500" as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "700" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const },
} as const;

export const motion = {
  fast: 160,
  base: 240,
  slow: 420,
} as const;
