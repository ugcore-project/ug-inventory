/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { Crosshair, Layers, Minus, Plus, Wrench } from "lucide-react";
import { Clothing } from "@/components/Clothing";
import { ItemIcon } from "@/components/ItemIcon";
import { cn } from "@/lib/cn";
import { itemLabel, label, openWorkbench, setQuantity, useInventory } from "@/store/inventoryStore";
import type { Item } from "@/types/protocol";

function EquippedCard({ item }: { item: Item }) {
  const weapon = item.metadata?.weapon;
  const workbench = useInventory((state) => state.config.workbench);

  if (!weapon) return null;

  return (
    <button
      type="button"
      data-equipped
      disabled={!workbench}
      onClick={() => openWorkbench(item.slot)}
      className="ug-panel ug-enter group flex items-center gap-3 rounded-xl px-3 py-2 text-left text-white transition hover:bg-[hsl(var(--ug-background)/0.95)]"
    >
      <span className="relative flex size-11 items-center justify-center rounded-lg bg-white/[0.05]">
        <ItemIcon name={item.name} weapon className="size-10" />
      </span>
      <span className="flex flex-col">
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-success">{label("inHand")}</span>
        <span className="text-sm font-semibold">{itemLabel(item)}</span>
        <span className="flex items-center gap-2 text-[0.6875rem] text-white/60">
          <Crosshair className="size-3 text-weapon" />
          <span className="tabular-nums">{weapon.ammo}</span>
          <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full bg-success" style={{ width: `${weapon.durability}%` }} />
          </span>
        </span>
      </span>
      {workbench && <Wrench className="ml-1 size-4 text-white/30 transition group-hover:rotate-12 group-hover:text-primary" />}
    </button>
  );
}

function Hint({ keys, action }: { keys: string; action: string }) {
  return (
    <span>
      <span className="text-white/60">{keys}</span> <span className="text-white/35">{action}</span>
    </span>
  );
}

/** How many units drags, quick moves, gives and drops take from a stack. */
function QuantityBar() {
  const quantity = useInventory((state) => state.quantity);
  const owned = useInventory((state) => state.config.layout.quantityPresets);
  // Quantities one click away. 0 is the whole stack, always first.
  const presets = [0, ...owned];

  return (
    <div data-quantity className="ug-panel flex items-center gap-2 rounded-xl px-2 py-1.5 text-white">
      <span className="flex items-center gap-1.5 pl-1 text-xs text-white/50">
        <Layers className="size-3.5 text-primary" />
        {label("quantity")}
      </span>
      <div className="flex items-center rounded-lg bg-white/[0.05]">
        <button
          type="button"
          aria-label={label("less")}
          data-quantity-step="-1"
          onClick={() => setQuantity(Math.max(quantity - 1, 0))}
          className="flex size-8 items-center justify-center rounded-l-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          type="number"
          min={0}
          max={1000000}
          value={quantity === 0 ? "" : quantity}
          placeholder={label("all")}
          onChange={(event) => setQuantity(Number(event.target.value) || 0)}
          data-quantity-input
          className="h-8 w-14 bg-transparent text-center text-sm font-medium tabular-nums text-white outline-none placeholder:text-white/70"
        />
        <button
          type="button"
          aria-label={label("more")}
          data-quantity-step="1"
          onClick={() => setQuantity(quantity + 1)}
          className="flex size-8 items-center justify-center rounded-r-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            data-quantity-preset={preset}
            onClick={() => setQuantity(preset)}
            className={cn(
              "h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition",
              quantity === preset ? "bg-primary/20 text-white" : "text-white/45 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {preset === 0 ? label("all") : preset}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The middle of the screen: the character (drawn by the game), its clothing, the weapon in hand, and the quantity bar. */
export function Stage() {
  const equipped = useInventory((state) => {
    if (!state.equipped || !state.player) return undefined;

    return Object.values(state.player.items).find((item) => item.metadata?.weapon?.serial === state.equipped);
  });
  const layout = useInventory((state) => state.config.layout);

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-between py-2">
      <Clothing />
      <div className="relative">{equipped && <EquippedCard item={equipped} />}</div>
      <div className="relative flex flex-col items-center gap-2.5">
        {layout.quantityBar && <QuantityBar />}
        {layout.hints && (
          <p data-help className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.625rem]">
            <Hint keys={label("mouse.doubleClick")} action={label("hint.use")} />
            <Hint keys={label("mouse.shiftClick")} action={label("hint.moveAll")} />
            <Hint keys={label("mouse.ctrlClick")} action={label("hint.moveOne")} />
            <Hint keys={label("mouse.rightClick")} action={label("hint.actions")} />
          </p>
        )}
      </div>
    </div>
  );
}
