/**
 * Pulse color system — deep charcoal, AMOLED-friendly dark theme,
 * refined coral/rose-red accent with neutral balance. (spec §4)
 *
 * A light palette is defined for the optional light theme (Phase 7).
 * All colors are plain values so they can be serialized if needed.
 */

export const palette = {
  // Rose-red / coral accent family
  coral500: '#FF5C69',
  coral400: '#FF7B85',
  coral300: '#FFA3AA',
  coral700: '#C93B4A',

  // Neutrals (dark)
  charcoal000: '#000000', // AMOLED true black (app background)
  charcoal050: '#0A0A0D', // near-black surface
  charcoal100: '#14141A', // card surface
  charcoal200: '#1C1C24', // raised surface
  charcoal300: '#262630', // borders / separators
  charcoal400: '#3A3A46', // disabled / tracks

  // Text (dark theme)
  textPrimary: '#F4F4F7',
  textSecondary: '#A2A2AE',
  textTertiary: '#6E6E7A',

  // Semantic
  green: '#3DDC97',
  amber: '#FFB020',
  red: '#FF5C69',
  blue: '#5AC8FA',
  purple: '#A78BFA',

  // Neutrals (light)
  paper: '#F7F7FA',
  card: '#FFFFFF',
  ink: '#16161C',
  inkSecondary: '#5A5A66',
  line: '#E4E4EC',
} as const;

export type ColorTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  ok: string;
  warn: string;
  danger: string;
  info: string;
  track: string;
  skeleton: string;
  tabBar: string;
  tabInactive: string;
}

export const darkColors: ThemeColors = {
  background: palette.charcoal000,
  surface: palette.charcoal100,
  surfaceRaised: palette.charcoal200,
  border: palette.charcoal300,
  textPrimary: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textTertiary: palette.textTertiary,
  accent: palette.coral500,
  accentSoft: 'rgba(255, 92, 105, 0.14)',
  accentText: '#FFFFFF',
  ok: palette.green,
  warn: palette.amber,
  danger: palette.red,
  info: palette.blue,
  track: palette.charcoal300,
  skeleton: palette.charcoal200,
  tabBar: palette.charcoal050,
  tabInactive: palette.textTertiary,
};

export const lightColors: ThemeColors = {
  background: palette.paper,
  surface: palette.card,
  surfaceRaised: '#F0F0F5',
  border: palette.line,
  textPrimary: palette.ink,
  textSecondary: palette.inkSecondary,
  textTertiary: '#8A8A96',
  accent: palette.coral500,
  accentSoft: 'rgba(255, 92, 105, 0.12)',
  accentText: '#FFFFFF',
  ok: '#12A46A',
  warn: '#B87400',
  danger: '#D63B4A',
  info: '#0E86B8',
  track: palette.line,
  skeleton: '#E8E8EF',
  tabBar: palette.card,
  tabInactive: palette.textTertiary,
};

/** Map a tone to a concrete color for badges/gauges. */
export function toneColor(colors: ThemeColors, tone: ColorTone): string {
  switch (tone) {
    case 'ok':
      return colors.ok;
    case 'warn':
      return colors.warn;
    case 'danger':
      return colors.danger;
    case 'info':
      return colors.info;
    case 'neutral':
    default:
      return colors.textSecondary;
  }
}
