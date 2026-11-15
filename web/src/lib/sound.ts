/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// The page has no GTA audio: it asks Lua to play a frontend sound. Lua plays action results on its own.

import { sendSound } from "@/lib/nui";
import { useInventory } from "@/store/inventoryStore";
import type { Sound } from "@/types/protocol";

// Shortest gap between two sounds of the page. Sweeping the mouse over a row of slots stays a few ticks, and Lua
// allows 12 a second.
const GAP_MS = 90;

let last = 0;

/** Asks for a sound, unless the owner turned sounds off or one just played. */
export function playSound(sound: typeof Sound.Hover | typeof Sound.Pick | typeof Sound.Menu): void {
  if (!useInventory.getState().config.sounds) return;

  const now = performance.now();

  if (now - last < GAP_MS) return;

  last = now;
  void sendSound(sound);
}
