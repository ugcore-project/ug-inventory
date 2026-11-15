/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { Crosshair, Download, RefreshCw, Wrench, X } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/format";
import { Zone, useDrag } from "@/store/dragStore";
import { detach, itemLabel, label, openWorkbench, reload, unload, useInventory } from "@/store/inventoryStore";

const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function DurabilityRing({ value }: { value: number }) {
  const color = value > 60 ? "hsl(var(--ug-success))" : value > 25 ? "hsl(var(--ug-warning))" : "hsl(var(--ug-destructive))";

  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums">{value}%</span>
        <span className="text-[0.5625rem] uppercase tracking-wider text-white/50">{label("durability")}</span>
      </div>
    </div>
  );
}

/**
 * One weapon up close: durability, ammo, attachments. Dropping an item from the pockets on it attaches it; ug-core
 * decides what fits. Reload and unload act on the weapon in hand.
 */
export function Workbench() {
  const slot = useInventory((state) => state.workbench);
  const item = useInventory((state) => (state.workbench ? state.player?.items[state.workbench] : undefined));
  const equipped = useInventory((state) => state.equipped);
  const definitions = useInventory((state) => state.definitions);
  const dragging = useDrag((state) => state.source?.kind === "slot");
  const over = useDrag((state) => state.over === `zone:${Zone.Workbench}`);
  const weapon = item?.metadata?.weapon;

  if (!slot || !item || !weapon) return null;

  const inHand = equipped === weapon.serial;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[8%] z-30 flex justify-center">
      <section
        data-workbench
        className="ug-panel ug-enter pointer-events-auto w-[26rem] rounded-2xl p-4 text-white"
      >
        <header className="mb-3 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Wrench className="size-4" />
          </span>
          <h2 className="flex-1 truncate text-sm font-semibold">{itemLabel(item)}</h2>
          {inHand && <span className="rounded bg-success/15 px-2 py-0.5 text-[0.625rem] font-semibold uppercase text-success">{label("inHand")}</span>}
          <button type="button" aria-label={label("close")} onClick={() => openWorkbench(null)} className="text-white/50 hover:text-white">
            <X className="size-4" />
          </button>
        </header>
        <div
          data-zone={Zone.Workbench}
          className={cn(
            "relative flex items-center gap-4 rounded-lg border border-dashed p-3 transition-all",
            dragging ? "border-primary/50 bg-primary/5" : "border-white/10",
            over && "scale-[1.02] border-solid border-primary bg-primary/15 shadow-[0_0_30px_-8px_hsl(var(--ug-primary))]",
          )}
        >
          <ItemIcon name={item.name} weapon className="h-20 flex-1" />
          <DurabilityRing value={weapon.durability} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-white/5 px-3 py-2">
            <dt className="text-white/50">{label("serial")}</dt>
            <dd className="truncate font-mono">{weapon.serial}</dd>
          </div>
          <div className="rounded-md bg-white/5 px-3 py-2">
            <dt className="text-white/50">{label("ammo")}</dt>
            <dd className="flex items-center gap-1.5 font-semibold tabular-nums">
              <Crosshair className="size-3 text-white/50" />
              {weapon.ammo}
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-white/50">{label("attachments")}</p>
          {weapon.components.length === 0 && weapon.tint === undefined ? (
            <p className="text-xs text-white/40">{label("attachHint")}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {weapon.components.map((component) => (
                <li key={component} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 py-1 pl-1 pr-1.5 text-xs">
                  <ItemIcon name={component} className="size-6" />
                  {definitions[component]?.label ?? component}
                  <button
                    type="button"
                    data-detach={component}
                    aria-label={label("detach")}
                    onClick={() => detach(slot, component)}
                    className="ml-0.5 rounded p-0.5 text-white/50 hover:bg-destructive/30 hover:text-white"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
              {weapon.tint !== undefined && weapon.tint > 0 && (
                <li className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs">{fill(label("tint"), { index: weapon.tint })}</li>
              )}
            </ul>
          )}
        </div>
        {inHand && (
          <div className="mt-4 flex gap-2">
            <Button type="button" className="flex-1" onClick={reload} data-reload>
              <RefreshCw className="size-4" />
              {label("reload")}
            </Button>
            <Button type="button" variant="outline" className="flex-1 border-white/15 text-white" onClick={unload}>
              <Download className="size-4" />
              {label("unload")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
