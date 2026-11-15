/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArrowDownToLine, Backpack, Box, Car, CircleAlert, Hand, Package, UserRound, X } from "lucide-react";
import { AmountDialog } from "@/components/AmountDialog";
import { ContextMenu } from "@/components/ContextMenu";
import { Ghost } from "@/components/Ghost";
import { InventoryPanel } from "@/components/InventoryPanel";
import { ShopPanel } from "@/components/ShopPanel";
import { Stage } from "@/components/Stage";
import { Tooltip } from "@/components/Tooltip";
import { hideTooltip } from "@/store/hoverStore";
import { Workbench } from "@/components/Workbench";
import { cn } from "@/lib/cn";
import { Zone, useDrag } from "@/store/dragStore";
import { close, closeMenu, label, openWorkbench, useInventory } from "@/store/inventoryStore";
import { Kind, PocketsSide, Side, type Container } from "@/types/protocol";

const KIND_ICONS = {
  [Kind.Stash]: <Archive className="size-4" />,
  [Kind.Trunk]: <Car className="size-4" />,
  [Kind.Glovebox]: <Box className="size-4" />,
  [Kind.Drop]: <Package className="size-4" />,
  [Kind.Inventory]: <UserRound className="size-4" />,
};

/** Nothing open next to the player, and the owner turned dropping off: an empty place, not a drop zone. */
function Nothing() {
  return (
    <section
      data-panel="nothing"
      className="flex h-72 w-[var(--ug-panel-width)] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-[hsl(var(--ug-background)/0.5)] text-center text-white/45 backdrop-blur-[2px]"
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-white/[0.05] text-white/50">
        <Hand className="size-7" />
      </span>
      <div>
        <p className="text-sm font-semibold">{label("nothingOpen")}</p>
        <p className="mt-1 max-w-56 text-xs text-white/50">{label("nothingOpenHint")}</p>
      </div>
    </section>
  );
}

/** With nothing open next to the player, the other side is the ground: dropping there drops the item. */
function Ground() {
  const active = useDrag((state) => state.source?.kind === "slot" && state.source.side === Side.Player);
  const over = useDrag((state) => state.over === `zone:${Zone.Drop}`);

  return (
    <section
      data-panel="ground"
      data-zone={Zone.Drop}
      className={cn(
        "flex h-72 w-[var(--ug-panel-width)] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center backdrop-blur-[2px] transition-all duration-200",
        active ? "border-destructive/40 bg-destructive/[0.06] text-white" : "border-white/10 bg-[hsl(var(--ug-background)/0.5)] text-white/45",
        over && "scale-[1.02] border-solid border-destructive bg-destructive/15",
      )}
    >
      <span className={cn("flex size-12 items-center justify-center rounded-xl transition", active ? "bg-destructive/15 text-destructive" : "bg-white/[0.05] text-white/50")}>
        <ArrowDownToLine className={cn("size-7 transition-transform", over && "translate-y-1")} />
      </span>
      <div>
        <p className="text-sm font-semibold">{label("ground")}</p>
        <p className="mt-1 max-w-56 text-xs text-white/50">{label("groundHint")}</p>
      </div>
    </section>
  );
}

function OtherSide() {
  const other = useInventory((state) => state.other);
  const dropping = useInventory((state) => state.config.dropping);

  if (!other) return dropping ? <Ground /> : <Nothing />;
  if (other.kind === Kind.Shop) return <ShopPanel shop={other} />;

  const container: Container = other;

  return (
    <InventoryPanel
      side={Side.Other}
      inventory={container}
      title={container.label ?? label(`kind.${container.kind}`)}
      icon={KIND_ICONS[container.kind]}
    />
  );
}

function Notice() {
  const notice = useInventory((state) => state.notice);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role="alert"
            data-notice
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -3, 3, 0] }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-[hsl(var(--ug-background)/0.92)] px-4 py-2 text-sm text-white shadow-[0_0_30px_-8px_hsl(var(--ug-destructive))]"
          >
            <CircleAlert className="size-4 text-destructive" />
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Whether a key event names `key`, as FiveM key mappings write keys: `TAB`, `I`, `F2`. */
function isKey(event: KeyboardEvent, key: string | undefined): boolean {
  if (!key) return false;

  return event.key.toUpperCase() === key || event.code.toUpperCase() === key || event.code.toUpperCase() === `KEY${key}`;
}

/** The inventory screen: pockets on the left, the character in the middle, the other side on the right. */
export function Inventory() {
  const open = useInventory((state) => state.open);
  const player = useInventory((state) => state.player);
  const openKey = useInventory((state) => state.config.openKey);
  const layout = useInventory((state) => state.config.layout);
  // The pockets slide in from their own edge, the other side from the opposite one.
  const pocketsFirst = layout.pockets === PocketsSide.Left;
  const pocketsFrom = pocketsFirst ? -60 : 60;

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement && event.target.type !== "range";
      const state = useInventory.getState();

      if (event.key === "Tab") event.preventDefault();

      if (event.key === "Escape") {
        if (state.menu) closeMenu();
        else if (state.workbench) openWorkbench(null);
        else if (!state.amount) close();

        return;
      }

      if (!typing && !state.amount && isKey(event, openKey)) close();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      hideTooltip();
    };
  }, [open, openKey]);

  return (
    <>
      <AnimatePresence>
        {open && player && (
          <motion.div
            key="screen"
            data-screen
            className="fixed inset-0 flex items-stretch gap-4 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onContextMenu={(event) => event.preventDefault()}
          >
            {/* Darkens the sides so the panels read over any scene, and leaves the character in the light. */}
            {layout.vignette && (
              <div
                data-vignette
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_30%_70%_at_50%_55%,transparent,hsl(var(--ug-overlay)/0.72))]"
              />
            )}
            <motion.div
              data-column="pockets"
              className={cn("relative flex items-center", !pocketsFirst && "order-3")}
              initial={{ x: pocketsFrom, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <InventoryPanel side={Side.Player} inventory={player} title={label("pockets")} icon={<Backpack className="size-4" />} />
            </motion.div>
            <div className="order-2 flex min-w-0 flex-1">
              <Stage />
            </div>
            <motion.div
              data-column="other"
              className={cn("relative flex items-center", pocketsFirst ? "order-3" : "order-1")}
              initial={{ x: -pocketsFrom, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.04 }}
            >
              <OtherSide />
            </motion.div>
            {layout.closeButton && (
              <button
                type="button"
                aria-label={label("close")}
                onClick={close}
                data-close
                className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white/60 ring-1 ring-white/10 transition hover:rotate-90 hover:bg-destructive/80 hover:text-white hover:ring-destructive/50"
              >
                <X className="size-4" />
              </button>
            )}
            <Workbench />
          </motion.div>
        )}
      </AnimatePresence>
      {open && (
        <>
          <Tooltip />
          <ContextMenu />
          <AmountDialog />
          <Ghost />
        </>
      )}
      <Notice />
    </>
  );
}
