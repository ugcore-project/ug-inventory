/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// The hovered slot, for the tooltip. Slots set it; the tooltip reads it.

import { create } from "zustand";
import type { Side } from "@/types/protocol";

interface HoverState {
  side: Side | null;
  slot: number;
  /** Screen box of the hovered slot. */
  box: { left: number; right: number; top: number } | null;
}

export const useHover = create<HoverState>(() => ({ side: null, slot: 0, box: null }));

export function showTooltip(side: Side, slot: number, element: HTMLElement): void {
  const rect = element.getBoundingClientRect();

  useHover.setState({ side, slot, box: { left: rect.left, right: rect.right, top: rect.top } });
}

export function hideTooltip(): void {
  useHover.setState({ side: null, box: null });
}
