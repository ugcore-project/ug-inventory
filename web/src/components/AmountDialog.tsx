/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/format";
import { closeAmount, confirmAmount, label, setAmount, useInventory } from "@/store/inventoryStore";

const TITLES = { split: "split", move: "moveAll", drop: "drop", give: "give", buy: "buy" } as const;

/** Chooses how many units an action takes, with a slider. Enter confirms, Escape cancels. */
export function AmountDialog() {
  const dialog = useInventory((state) => state.amount);
  const definition = useInventory((state) => (state.amount ? state.definitions[state.amount.name] : undefined));
  const locale = useInventory((state) => state.config.locale);
  const input = useRef<HTMLInputElement>(null);

  const shown = dialog !== null;

  useEffect(() => {
    if (shown) input.current?.select();
  }, [shown]);

  if (!dialog) return null;

  const { max, value, price } = dialog;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onPointerDown={(event) => event.target === event.currentTarget && closeAmount()}>
      <form
        data-amount
        className="ug-panel ug-enter flex w-80 flex-col gap-4 rounded-2xl p-5 text-white"
        onSubmit={(event) => {
          event.preventDefault();
          confirmAmount();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            closeAmount();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <ItemIcon name={dialog.name} className="size-12 shrink-0" />
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary">{label(TITLES[dialog.action.kind])}</p>
            <p className="truncate text-sm font-semibold">{definition?.label ?? dialog.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="-1" onClick={() => setAmount(value - 1)} className="rounded-md border border-white/10 p-1.5 hover:bg-white/10">
            <Minus className="size-3.5" />
          </button>
          <input
            type="range"
            min={1}
            max={max}
            value={value}
            onChange={(event) => setAmount(Number(event.target.value))}
            className="flex-1 accent-[hsl(var(--ug-primary))]"
            aria-label={label("amount")}
          />
          <button type="button" aria-label="+1" onClick={() => setAmount(value + 1)} className="rounded-md border border-white/10 p-1.5 hover:bg-white/10">
            <Plus className="size-3.5" />
          </button>
          <input
            ref={input}
            type="number"
            min={1}
            max={max}
            value={value}
            onChange={(event) => setAmount(Number(event.target.value) || 1)}
            className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-primary"
            data-amount-input
          />
        </div>
        <div className="flex gap-1.5">
          {[1, Math.floor(max / 2), max].filter((entry, index, all) => entry >= 1 && all.indexOf(entry) === index).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setAmount(entry)}
              className="flex-1 rounded-md bg-white/5 py-1 text-xs tabular-nums text-white/70 hover:bg-white/10 hover:text-white"
            >
              {entry}
            </button>
          ))}
        </div>
        {price !== undefined && (
          <div className="flex items-baseline justify-between border-t border-white/10 pt-3 text-sm">
            <span className="text-white/60">{label("total")}</span>
            <span className="font-semibold tabular-nums text-success" data-total>
              {money(price * value, locale)}
            </span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeAmount} className="border-white/15 text-white">
            {label("cancel")}
          </Button>
          <Button type="submit" data-confirm>
            {label("confirm")}
          </Button>
        </div>
      </form>
    </div>
  );
}
