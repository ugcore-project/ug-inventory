/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { AnimatePresence, motion } from "framer-motion";
import { ItemIcon } from "@/components/ItemIcon";
import { cn } from "@/lib/cn";
import { shortCount } from "@/lib/format";
import { useInventory } from "@/store/inventoryStore";
import { HotbarPosition } from "@/types/protocol";

/** Slots 1 to N, shown for a moment after a slot key while the screen is closed. */
export function Hotbar() {
  const hotbar = useInventory((state) => state.hotbar);
  const count = useInventory((state) => state.config.hotbar);
  const open = useInventory((state) => state.open);
  const top = useInventory((state) => state.config.layout.hotbar === HotbarPosition.Top);
  // It rises from its own edge.
  const from = top ? -24 : 24;

  return (
    <div className={cn("pointer-events-none fixed inset-x-0 z-40 flex justify-center", top ? "top-6" : "bottom-6")} data-hotbar-position={top ? HotbarPosition.Top : HotbarPosition.Bottom}>
      <AnimatePresence>
        {hotbar && !open && (
          <motion.div
            data-hotbar
            initial={{ opacity: 0, y: from }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: from }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="flex gap-1.5"
          >
            {Array.from({ length: count }, (_, index) => index + 1).map((slot) => {
              const item = hotbar.items[slot];
              const active = slot === hotbar.active;

              return (
                <div
                  key={slot}
                  data-hotbar-slot={slot}
                  className={cn(
                    "relative size-16 rounded-lg border bg-black/70 transition-all duration-200",
                    active && "scale-110 border-primary shadow-[0_0_24px_-4px_hsl(var(--ug-primary))]",
                    active && (top ? "translate-y-2" : "-translate-y-2"),
                    !active && "border-white/10",
                  )}
                >
                  <span className={cn("absolute left-1 top-0.5 text-[0.625rem] font-bold", active ? "text-primary" : "text-white/50")}>{slot}</span>
                  {item && (
                    <>
                      <ItemIcon name={item.name} weapon={item.metadata?.weapon !== undefined} className="absolute inset-[18%] size-[64%]" />
                      {item.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[0.625rem] font-semibold tabular-nums text-white/80">{shortCount(item.count)}</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
