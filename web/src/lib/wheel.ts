/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// Inside this radius the pointer picks nothing, so releasing in the middle cancels.
const DEAD_ZONE = 48;

/** The slot under a pointer at (x, y) relative to the wheel's center, 0 for none. */
export function slotAt(x: number, y: number, slots: number): number {
  if (Math.hypot(x, y) < DEAD_ZONE) return 0;

  const degrees = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;

  return Math.floor(degrees / (360 / slots)) + 1;
}
