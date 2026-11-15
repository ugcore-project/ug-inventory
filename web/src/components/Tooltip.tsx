/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { Hand, Info, Weight } from "lucide-react";
import { TONES, categoryOf } from "@/lib/category";
import { cn } from "@/lib/cn";
import { fill, humanize, kilograms } from "@/lib/format";
import { useDrag } from "@/store/dragStore";
import { inventoryOf, itemLabel, label, useInventory } from "@/store/inventoryStore";
import { useHover } from "@/store/hoverStore";
import type { MetadataValue } from "@/types/protocol";

const WIDTH = 268;
const GAP = 12;

function metadataValue(value: MetadataValue): string {
  if (typeof value === "boolean") return label(value ? "yes" : "no");

  return String(value);
}

/** Details of the hovered item: category, description, weight, metadata, and for weapons their state. */
export function Tooltip() {
  const { side, slot, box } = useHover();
  const dragging = useDrag((state) => state.source !== null);
  const menu = useInventory((state) => state.menu !== null);
  const item = useInventory((state) => (side ? inventoryOf(state, side)?.items[slot] : undefined));
  const definition = useInventory((state) => (item ? state.definitions[item.name] : undefined));
  const equipped = useInventory((state) => state.equipped);
  const labels = useInventory((state) => state.config.labels);

  if (!item || !box || dragging || menu) return null;

  const weapon = item.metadata?.weapon;
  const info = item.metadata?.info ?? [];
  const description = item.metadata?.description ?? definition?.description;
  const category = categoryOf(item, definition);
  const tone = TONES[category];
  const unitWeight = definition?.weight ?? 0;
  // Right of the slot when it fits, otherwise left of it.
  const left = box.right + GAP + WIDTH < window.innerWidth ? box.right + GAP : box.left - GAP - WIDTH;
  const top = Math.max(8, Math.min(box.top, window.innerHeight - 320));

  return (
    <div
      role="tooltip"
      data-tooltip
      className="ug-panel ug-enter pointer-events-none fixed z-40 overflow-hidden rounded-xl text-xs text-white"
      style={{ left, top, width: WIDTH }}
    >
      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-semibold">{itemLabel(item)}</span>
            <span className={cn("inline-flex w-fit items-center gap-1 text-[0.625rem] font-medium uppercase tracking-wider", tone.text)}>
              <tone.icon className="size-3" />
              {label(`category.${category}`)}
            </span>
          </div>
          {item.count > 1 && <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-semibold tabular-nums">x{item.count}</span>}
        </div>

        <p data-description className={cn("leading-snug", description ? "text-white/75" : "italic text-white/35")}>
          {description ?? label("noDescription")}
        </p>

        <div className="flex flex-wrap gap-1.5 text-[0.6875rem]">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-white/70">
            <Weight className="size-3 text-brand-to" />
            {kilograms(unitWeight * item.count)} kg
            {item.count > 1 && <span className="text-white/40">({kilograms(unitWeight)} kg)</span>}
          </span>
          {definition?.usable && (
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-success">
              <Hand className="size-3" />
              {label("usable")}
            </span>
          )}
        </div>

        {weapon && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-white/[0.07] pt-2">
            <dt className="text-white/45">{label("serial")}</dt>
            <dd className="truncate font-mono text-white/90">{weapon.serial}</dd>
            <dt className="text-white/45">{label("durability")}</dt>
            <dd className="flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full bg-success" style={{ width: `${weapon.durability}%` }} />
              </span>
              <span className="tabular-nums">{weapon.durability}%</span>
            </dd>
            <dt className="text-white/45">{label("ammo")}</dt>
            <dd className="tabular-nums text-ammo">{weapon.ammo}</dd>
            {weapon.components.length > 0 && (
              <>
                <dt className="text-white/45">{label("attachments")}</dt>
                <dd className="text-attachment">
                  {weapon.components.map((component) => useInventory.getState().definitions[component]?.label ?? component).join(", ")}
                </dd>
              </>
            )}
            {weapon.tint !== undefined && weapon.tint > 0 && (
              <>
                <dt className="text-white/45" />
                <dd>{fill(label("tint"), { index: weapon.tint })}</dd>
              </>
            )}
            {equipped === weapon.serial && <dd className="col-span-2 mt-0.5 font-semibold text-success">{label("inHand")}</dd>}
          </dl>
        )}

        {info.length > 0 && (
          <div data-metadata className="flex flex-col gap-1 border-t border-white/[0.07] pt-2">
            <span className="flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-wider text-white/40">
              <Info className="size-3" />
              {label("details")}
            </span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {info.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-white/45">{labels[`metadata.${key}`] ?? humanize(key)}</dt>
                  <dd className="truncate text-right text-white/90">{metadataValue(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
