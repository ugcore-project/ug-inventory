/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { ShoppingCart, Store, Wallet } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { cn } from "@/lib/cn";
import { fill, money } from "@/lib/format";
import { pressItem } from "@/store/dragStore";
import { buyLimit, label, openAmount, useInventory } from "@/store/inventoryStore";
import type { Shop } from "@/types/protocol";

/** What a shop sells. Drag an entry to the pockets, or click it, to choose how many. */
export function ShopPanel({ shop }: { shop: Shop }) {
  const definitions = useInventory((state) => state.definitions);
  const locale = useInventory((state) => state.config.locale);

  return (
    <section
      data-panel="other"
      data-shop
      className="ug-panel flex max-h-full w-[var(--ug-panel-width)] flex-col gap-3 rounded-2xl p-4"
    >
      <header className="flex items-center gap-2 text-white">
        <span className="flex items-center text-primary">
          <Store className="size-4" />
        </span>
        <h2 className="flex-1 truncate text-sm font-semibold tracking-wide">{shop.label}</h2>
        {shop.balance !== undefined && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2 py-1 text-xs font-semibold tabular-nums text-success" data-balance>
            <Wallet className="size-3.5" />
            {money(shop.balance, locale)}
          </span>
        )}
      </header>
      <ul className="-mx-1 grid grid-cols-2 gap-1.5 overflow-y-auto px-1">
        {shop.listing.map((entry) => {
          const max = buyLimit(entry, shop.balance);
          const soldOut = entry.stock === 0;
          const affordable = max > 0;
          const definition = definitions[entry.name];

          return (
            <li key={entry.index}>
              <button
                type="button"
                data-listing={entry.index}
                disabled={!affordable}
                onPointerDown={affordable ? (event) => pressItem(event, { kind: "listing", index: entry.index }, entry.name, max) : undefined}
                onClick={() =>
                  openAmount({ action: { kind: "buy", index: entry.index }, name: entry.name, max, value: 1, price: entry.price })
                }
                className={cn(
                  "group flex w-full items-center gap-2 rounded-xl bg-white/[0.04] p-2 text-left transition",
                  "hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
                )}
              >
                <ItemIcon name={entry.name} className="size-11 shrink-0 transition-transform group-hover:scale-110" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium text-white">{definition?.label ?? entry.name}</span>
                  <span className={cn("text-sm font-semibold tabular-nums", affordable ? "text-success" : "text-destructive")}>
                    {money(entry.price, locale)}
                  </span>
                  <span className="text-[0.625rem] text-white/50">
                    {soldOut ? label("soldOut") : entry.stock !== undefined ? fill(label("inStock"), { count: entry.stock }) : " "}
                  </span>
                </span>
                <ShoppingCart className="size-4 shrink-0 text-white/30 transition-colors group-hover:text-brand-to" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
