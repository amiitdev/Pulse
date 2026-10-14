import { theme, darkTheme, lightTheme } from './index';
import type { Theme } from './index';

export { toneColor } from './colors';
export type { ColorTone } from './colors';

/**
 * Theme access hook. Currently always returns the dark theme (spec §4
 * default). Phase 7 adds the Settings toggle by reading stored preference.
 */
export function useTheme(): { theme: Theme; isDark: boolean } {
  return { theme, isDark: theme === darkTheme };
}

export { darkTheme, lightTheme };
