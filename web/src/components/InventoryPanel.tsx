/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Slot } from "@/components/Slot";
import { cn } from "@/lib/cn";
import { kilograms } from "@/lib/format";
import { Filter, label, matches, setFilter, setSearch, useInventory, weightOf } from "@/store/inventoryStore";
import { Side, type Inventory } from "@/types/protocol";

const FILTERS: Filter[] = [Filter.All, Filter.Weapons, Filter.Usable];

function WeightBar({ inventory }: { inventory: Inventory }) {
  const definitions = useInventory((state) => state.definitions);
  const weight = weightOf(inventory, definitions);
  const ratio = inventory.maxWeight > 0 ? Math.min(weight / inventory.maxWeight, 1) : 0;

  return (
    <div className="flex items-center gap-2" data-weight={weight}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-500 ease-out",
            ratio > 0.9 ? "bg-destructive" : ratio > 0.7 ? "bg-warning" : "ug-brand",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-[0.6875rem] tabular-nums text-white/60">
        {kilograms(weight)} <span className="text-white/35">/ {kilograms(inventory.maxWeight)} kg</span>
      </span>
    </div>
  );
}

function SearchBar() {
  const search = useInventory((state) => state.search);
  const filter = useInventory((state) => state.filter);
  const weapons = useInventory((state) => state.weapons);

  return (
    <div className="flex items-center gap-2">
      <label className="flex h-8 flex-1 items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 transition focus-within:bg-white/[0.08] focus-within:ring-1 focus-within:ring-primary/50">
        <Search className="size-3.5 shrink-0 text-white/40" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={label("search")}
          maxLength={64}
          className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
          data-search
        />
        {search && (
          <button type="button" aria-label={label("close")} onClick={() => setSearch("")} className="text-white/50 hover:text-white">
            <X className="size-3.5" />
          </button>
        )}
      </label>
      <div className="flex gap-0.5">
        {FILTERS.filter((entry) => weapons || entry !== Filter.Weapons).map((entry) => (
          <button
            key={entry}
            type="button"
            data-filter={entry}
            onClick={() => setFilter(entry)}
            className={cn(
              "rounded-md px-2 py-1 text-[0.6875rem] font-medium transition",
              filter === entry ? "bg-primary/20 text-white" : "text-white/45 hover:text-white",
            )}
          >
            {label(`filter.${entry}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface InventoryPanelProps {
  side: Side;
  inventory: Inventory;
  title: string;
  icon: ReactNode;
  /** Extra content under the title, such as the search bar. */
  children?: ReactNode;
}

/** A titled grid of slots with its weight. The player's has the search, the hotbar keys and the filter. */
export function InventoryPanel({ side, inventory, title, icon, children }: InventoryPanelProps) {
  const search = useInventory((state) => state.search);
  const filter = useInventory((state) => state.filter);
  const definitions = useInventory((state) => state.definitions);
  const hotbar = useInventory((state) => state.config.hotbar);
  const player = side === Side.Player;
  const slots = Array.from({ length: inventory.slots }, (_, index) => index + 1);
  const used = Object.keys(inventory.items).length;

  return (
    <section
      data-panel={side}
      className="ug-panel flex max-h-full w-[var(--ug-panel-width)] flex-col gap-3 rounded-2xl p-4"
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-white">
          <span className="text-primary">{icon}</span>
          <h2 className="flex-1 truncate text-sm font-semibold">{title}</h2>
          <span data-slots className="text-[0.6875rem] tabular-nums text-white/40">
            {used} / {inventory.slots}
          </span>
        </div>
        <WeightBar inventory={inventory} />
        {player && <SearchBar />}
        {children}
      </header>
      <div className="-mx-1 -mr-2 overflow-y-auto px-1 pb-1 pr-2 pt-1">
        <div className="grid grid-cols-[repeat(var(--ug-columns),minmax(0,1fr))] gap-1.5">
          {slots.map((slot) => {
            const item = inventory.items[slot];

            return (
              <Slot
                key={slot}
                side={side}
                slot={slot}
                item={item}
                hidden={player && item !== undefined && !matches(item, search, filter, definitions)}
                hotkey={player && slot <= hotbar ? slot : undefined}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
