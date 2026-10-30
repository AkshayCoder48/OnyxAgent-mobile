import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * OnyxAgent design tokens — a 1:1 port of the webapp's globals.css variables
 * (src/app/globals.css `@theme` + `:root.light`/`:root.dark`), so the native
 * app renders the same "cyan on black" dark-first identity as the web app,
 * with the same opt-in light palette.
 */

export interface Palette {
  /** App canvas. Web: --color-background. */
  background: string;
  /** Primary text / glyphs. Web: --color-foreground. */
  foreground: string;
  /** Cards, popovers, composer card. Web: --color-card. */
  card: string;
  /** Raised surfaces: sidebar, chips, secondary buttons. Web: --color-secondary / --color-muted. */
  secondary: string;
  /** Hairline borders (1px). Web: --color-border. */
  border: string;
  /** Secondary text. Web: --color-muted-foreground. */
  mutedForeground: string;
  /** Brand cyan. Web: --color-primary. */
  primary: string;
  /** Brand cyan pressed/hover. Web: --color-brand-hover. */
  primaryHover: string;
  /** Ink on top of cyan fills. Web: --color-primary-foreground. */
  primaryForeground: string;
  /** Cyan wash — active rows, avatars. Web: --color-accent. */
  accent: string;
  /** Cyan muted — subtle strokes. Web: --color-brand-muted. */
  accentMuted: string;
  /** Destructive. Web: --color-destructive. */
  destructive: string;
  /** User chat bubble bg. Web: --chat-user-bg. */
  chatUserBg: string;
  /** User chat bubble border. Web: --chat-user-border. */
  chatUserBorder: string;
  /** User chat bubble text. Web: --chat-user-fg. */
  chatUserFg: string;
  /** Code block bg. Web: --chat-code-bg. */
  chatCodeBg: string;
  /** Code block text. Web: --chat-code-fg. */
  chatCodeFg: string;
  /** Backdrop dim over content (drawer / sheets). */
  scrim: string;
}

/** Dark theme (the app default) — verbatim web dark values. */
export const darkPalette: Palette = {
  background: '#000000',
  foreground: '#FFFFFF',
  card: '#0B0D10',
  secondary: '#16181D',
  border: '#23262C',
  mutedForeground: '#9AA3AD',
  primary: '#22D3EE',
  primaryHover: '#06B6D4',
  primaryForeground: '#05161C',
  accent: '#0D2A31',
  accentMuted: '#0E7490',
  destructive: '#F87171',
  chatUserBg: '#12333D',
  chatUserBorder: '#1D4653',
  chatUserFg: '#E8EEF2',
  chatCodeBg: '#10161C',
  chatCodeFg: '#D5E3EC',
  scrim: '#000000',
};

/** Light theme (opt-in) — verbatim web light values. */
export const lightPalette: Palette = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  card: '#FFFFFF',
  secondary: '#F1F5F9',
  border: '#E2E8F0',
  mutedForeground: '#64748B',
  primary: '#0891B2',
  primaryHover: '#0E7490',
  primaryForeground: '#FFFFFF',
  accent: '#ECFEFF',
  accentMuted: '#67C3D9',
  destructive: '#DC2626',
  chatUserBg: '#ECFEFF',
  chatUserBorder: '#CFFAFE',
  chatUserFg: '#0A0A0A',
  chatCodeBg: '#10161C',
  chatCodeFg: '#D5E3EC',
  scrim: '#0A0A0A',
};

export const radius = {
  /** Cards / composer card. Web: --radius-card 1rem. */
  card: 16,
  /** Chat bubbles. */
  bubble: 18,
  /** Pills, chips and circular controls. Web: --radius-pill. */
  pill: 999,
} as const;

/**
 * Typography — DM Sans (display/body) + JetBrains Mono (mono), loaded in App
 * via expo-font + @expo-google-fonts. Family names are the loaded constants.
 */
export const fonts = {
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemibold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

// ---------------------------------------------------------------------------
// Theme context
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  colors: Palette;
  fonts: typeof fonts;
  radius: typeof radius;
  scheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkPalette,
  fonts,
  radius,
  scheme: 'dark',
});

export function ThemeProvider({
  scheme,
  children,
}: {
  scheme: 'dark' | 'light';
  children: ReactNode;
}) {
  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'light' ? lightPalette : darkPalette,
      fonts,
      radius,
      scheme,
    }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
