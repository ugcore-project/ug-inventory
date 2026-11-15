/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { AnimatePresence, motion } from "framer-motion";
import { ItemIcon } from "@/components/ItemIcon";
import { cn } from "@/lib/cn";
import { useInventory } from "@/store/inventoryStore";
import { ToastPosition } from "@/types/protocol";

// Where the toasts stack. Bottom places leave room for the hotbar. Written out: Tailwind keeps literal classes only.
const PLACES: Record<ToastPosition, string> = {
  [ToastPosition.BottomRight]: "bottom-28 right-6 items-end",
  [ToastPosition.BottomLeft]: "bottom-28 left-6 items-start",
  [ToastPosition.TopRight]: "top-6 right-6 items-end",
  [ToastPosition.TopLeft]: "top-6 left-6 items-start",
};

/** Items gained and lost, shown whether the screen is open or not. */
export function Toasts() {
  const toasts = useInventory((state) => state.toasts);
  const position = useInventory((state) => state.config.layout.toasts);
  // They slide in from their own edge.
  const from = position === ToastPosition.BottomLeft || position === ToastPosition.TopLeft ? -40 : 40;

  return (
    <div className={cn("pointer-events-none fixed z-40 flex flex-col gap-1.5", PLACES[position])} data-toasts={position}>
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const gained = toast.delta > 0;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: from, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: from, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="ug-panel flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 text-white"
              data-toast={toast.name}
            >
              <ItemIcon name={toast.name} className="size-8" />
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  gained ? "text-success" : "text-destructive",
                )}
              >
                {gained ? "+" : "−"}
                {Math.abs(toast.delta)}
              </span>
              <span className="max-w-40 truncate text-xs text-white/80">{toast.label}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
