export * from './colors';
export * from './spacing';
export * from './typography';

import { darkColors, lightColors, ThemeColors } from './colors';
import { spacing, radius, shadow } from './spacing';
import { typography } from './typography';

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  typography: typeof typography;
}

/**
 * Dark (default) and light themes. Phase 7 adds a user-facing toggle;
 * the app defaults to dark per spec §4.
 */
export const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  radius,
  shadow,
  typography,
};

export const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  radius,
  shadow,
  typography,
};

export const theme = darkTheme;
