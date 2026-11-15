/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// The owner's ug-lib theme, applied to this page too, so every UgCore screen looks the same. Same rules as ug-lib.
// Lua merges this screen's own theme values on top, including the tokens only this screen has.

import type { Layout, ThemeConfig } from "@/types/protocol";

/** Theme tokens owners MAY override, mapped to their CSS variable. */
const THEME_TOKENS: Record<string, string> = {
  background: "--ug-background",
  foreground: "--ug-foreground",
  card: "--ug-card",
  cardForeground: "--ug-card-foreground",
  popover: "--ug-popover",
  popoverForeground: "--ug-popover-foreground",
  primary: "--ug-primary",
  primaryForeground: "--ug-primary-foreground",
  secondary: "--ug-secondary",
  secondaryForeground: "--ug-secondary-foreground",
  muted: "--ug-muted",
  mutedForeground: "--ug-muted-foreground",
  accent: "--ug-accent",
  accentForeground: "--ug-accent-foreground",
  destructive: "--ug-destructive",
  destructiveForeground: "--ug-destructive-foreground",
  success: "--ug-success",
  successForeground: "--ug-success-foreground",
  warning: "--ug-warning",
  warningForeground: "--ug-warning-foreground",
  border: "--ug-border",
  input: "--ug-input",
  ring: "--ug-ring",
  // This screen only: item category colors, and the shade that darkens the sides.
  weapon: "--ug-weapon",
  ammo: "--ug-ammo",
  attachment: "--ug-attachment",
  consumable: "--ug-consumable",
  clothing: "--ug-clothing",
  item: "--ug-item",
  overlay: "--ug-overlay",
};

const HSL_TRIPLET = /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/;
const SIZE = /^\d*\.?\d+(rem|px)$/;
const FONTS: Record<string, string> = {
  Inter: '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

/** Applies theme values to `<html>`. Lua checked them; they are checked again before reaching CSS. */
export function applyTheme(theme: ThemeConfig | undefined): void {
  const root = document.documentElement;

  root.classList.toggle("dark", theme?.mode !== "light");

  for (const [token, cssVar] of Object.entries(THEME_TOKENS)) {
    const value = theme?.colors?.[token];

    if (typeof value === "string" && HSL_TRIPLET.test(value)) {
      root.style.setProperty(cssVar, value);
    } else {
      root.style.removeProperty(cssVar);
    }
  }

  if (theme?.radius && SIZE.test(theme.radius)) {
    root.style.setProperty("--ug-radius", theme.radius);
  }

  const font = theme?.font ? FONTS[theme.font] : undefined;

  if (font) {
    root.style.setProperty("--ug-font-sans", font);
  }

  const scale = typeof theme?.scale === "number" && Number.isFinite(theme.scale) ? Math.min(Math.max(theme.scale, 0.75), 1.5) : 1;

  root.style.setProperty("--ug-scale", String(scale));
}

/** Gap between slots, in rem: Tailwind's gap-1.5. */
const SLOT_GAP = 0.375;
/** Padding of a panel on both sides together, in rem: Tailwind's p-4. */
const PANEL_PADDING = 2;

/** Sizes panels from the owner layout, and stills every animation when the owner turned them off. */
export function applyLayout(layout: Layout): void {
  const root = document.documentElement;
  const width = layout.columns * layout.slotSize + (layout.columns - 1) * SLOT_GAP + PANEL_PADDING;

  root.style.setProperty("--ug-columns", String(layout.columns));
  root.style.setProperty("--ug-slot", `${layout.slotSize}rem`);
  root.style.setProperty("--ug-panel-width", `${Math.round(width * 1000) / 1000}rem`);
  root.classList.toggle("ug-still", !layout.animations);
}
