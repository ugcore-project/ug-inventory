/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { memo } from "react";
import { ItemIcon } from "@/components/ItemIcon";
import { hideTooltip, showTooltip } from "@/store/hoverStore";
import { cn } from "@/lib/cn";
import { playSound } from "@/lib/sound";
import { shortCount } from "@/lib/format";
import { pressItem, useDrag } from "@/store/dragStore";
import { activate, itemLabel, openMenu, openWorkbench, quickMove, useInventory } from "@/store/inventoryStore";
import { Side, Sound, type Item } from "@/types/protocol";

interface SlotProps {
  side: Side;
  slot: number;
  item?: Item | undefined;
  /** Dimmed by the search or filter. */
  hidden?: boolean;
  /** Key number on hotbar slots. */
  hotkey?: number | undefined;
}

function durabilityColor(durability: number): string {
  if (durability > 60) return "bg-success";
  if (durability > 25) return "bg-warning";

  return "bg-destructive";
}

/**
 * One slot. Mouse: drag to move, double-click to use (or to take from the other side), Shift-click to move the stack
 * to the other side, Ctrl-click to move one, right-click for actions, middle-click to inspect a weapon.
 */
export const Slot = memo(function Slot({ side, slot, item, hidden = false, hotkey }: SlotProps) {
  const key = `${side}:${slot}`;
  const over = useDrag((state) => state.over === `slot:${key}`);
  const dragged = useDrag((state) => state.source?.kind === "slot" && state.source.side === side && state.source.slot === slot);
  const flashed = useInventory((state) => key in state.flashes);
  const equipped = useInventory((state) => item?.metadata?.weapon !== undefined && state.equipped === item.metadata.weapon.serial);
  const definition = useInventory((state) => (item ? state.definitions[item.name] : undefined));
  const weapon = item?.metadata?.weapon;
  const player = side === Side.Player;

  return (
    <div
      data-side={side}
      data-slot={slot}
      data-item={item?.name}
      className={cn(
        "group relative aspect-square select-none overflow-hidden rounded-lg border transition-[transform,border-color,background-color,opacity] duration-150",
        "border-transparent bg-white/[0.04]",
        // Every slot answers the pointer, empty or not.
        "hover:border-white/15 hover:bg-white/[0.08]",
        item && "cursor-grab",
        over && "scale-105 border-primary bg-primary/15",
        dragged && "opacity-30",
        hidden && "opacity-25",
        flashed && "ug-slot-flash",
        equipped && "border-success/50",
      )}
      onPointerDown={item ? (event) => pressItem(event, { kind: "slot", side, slot }, item.name, item.count) : undefined}
      onClick={(event) => {
        if (!item) return;

        if (event.shiftKey) quickMove(side, slot);
        else if (event.ctrlKey) quickMove(side, slot, 1);
      }}
      onDoubleClick={(event) => {
        if (!item || event.shiftKey || event.ctrlKey) return;

        if (!player) quickMove(side, slot);
        else if (definition?.usable || weapon) activate(slot);
      }}
      onContextMenu={(event) => {
        event.preventDefault();

        if (!item) return;

        playSound(Sound.Menu);
        openMenu({ side, slot, x: event.clientX, y: event.clientY });
      }}
      onAuxClick={(event) => {
        if (item && weapon && player && event.button === 1) openWorkbench(slot);
      }}
      onPointerEnter={
        item
          ? (event) => {
              showTooltip(side, slot, event.currentTarget);
              // No hover ticks under a drag: the drop says enough.
              if ((event.buttons & 1) === 0) playSound(Sound.Hover);
            }
          : undefined
      }
      onPointerLeave={item ? hideTooltip : undefined}
    >
      {hotkey !== undefined && (
        <span className="pointer-events-none absolute left-1.5 top-1 text-[0.625rem] font-semibold tabular-nums text-primary">{hotkey}</span>
      )}
      {item && (
        <>
          <ItemIcon
            name={item.name}
            weapon={weapon !== undefined}
            className="absolute inset-[16%] size-[68%] transition-transform duration-200 group-hover:scale-110"
          />
          {item.count > 1 && (
            <span key={item.count} className="ug-pop absolute right-1.5 top-1 text-[0.6875rem] font-semibold tabular-nums text-white/90">
              {shortCount(item.count)}
            </span>
          )}
          <span className="absolute inset-x-1 bottom-1 truncate text-center text-[0.625rem] leading-tight text-white/55">
            {itemLabel(item)}
          </span>
          {weapon && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-white/10">
              <span className={cn("block h-full", durabilityColor(weapon.durability))} style={{ width: `${weapon.durability}%` }} />
            </span>
          )}
          {equipped && <span className="absolute right-1.5 bottom-4 size-1.5 animate-pulse rounded-full bg-success" />}
        </>
      )}
    </div>
  );
});
