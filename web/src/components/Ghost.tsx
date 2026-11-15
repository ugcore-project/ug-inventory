/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { ItemIcon } from "@/components/ItemIcon";
import { shortCount } from "@/lib/format";
import { draggedUnits, useDrag } from "@/store/dragStore";

/** The item under the pointer while dragging, with the units the drop would move. */
export function Ghost() {
  const drag = useDrag();

  if (!drag.source) return null;

  const units = draggedUnits(drag);

  return (
    <div
      data-ghost
      className="pointer-events-none fixed z-[60] size-20 -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-lg border border-primary/60 bg-[hsl(var(--ug-card)/0.9)] shadow-[0_12px_32px_-6px_rgb(0_0_0/0.7)]"
      style={{ left: drag.x, top: drag.y }}
    >
      <ItemIcon name={drag.name} className="absolute inset-[15%] size-[70%]" />
      {drag.count > 1 && (
        <span className="absolute -right-2 -top-2 ug-brand rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums text-white">
          {shortCount(units)}
        </span>
      )}
    </div>
  );
}
