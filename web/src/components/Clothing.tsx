/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import {
  Backpack,
  Ear,
  Footprints,
  Gem,
  Glasses,
  Hand,
  HardHat,
  Layers,
  PersonStanding,
  Shield,
  Shirt,
  Torus,
  VenetianMask,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { playSound } from "@/lib/sound";
import { pressItem, useDrag } from "@/store/dragStore";
import { label, toggleClothing, useInventory } from "@/store/inventoryStore";
import { ClothingMode, ClothingPiece, Side, Sound, type ClothingSlot } from "@/types/protocol";

const ICONS: Record<ClothingPiece, LucideIcon> = {
  [ClothingPiece.Hat]: HardHat,
  [ClothingPiece.Glasses]: Glasses,
  [ClothingPiece.Ears]: Ear,
  [ClothingPiece.Mask]: VenetianMask,
  [ClothingPiece.Chain]: Gem,
  [ClothingPiece.Top]: Shirt,
  [ClothingPiece.Undershirt]: Layers,
  [ClothingPiece.Gloves]: Hand,
  [ClothingPiece.Vest]: Shield,
  [ClothingPiece.Bag]: Backpack,
  [ClothingPiece.Watch]: Watch,
  [ClothingPiece.Bracelet]: Torus,
  [ClothingPiece.Legs]: PersonStanding,
  [ClothingPiece.Shoes]: Footprints,
};

/** What a click on the slot does, for its hint. */
function hintOf(slot: ClothingSlot, mode: ClothingMode): string {
  if (!slot.available) return label("clothing.unavailable");
  if (slot.worn) return label("clothing.takeOff");
  if (mode === ClothingMode.Toggle) return label(slot.restorable ? "clothing.putOn" : "clothing.nothing");

  return label("clothing.dragHere");
}

function Piece({ slot, mode, align }: { slot: ClothingSlot; mode: ClothingMode; align: "left" | "right" }) {
  const Icon = ICONS[slot.piece];
  const over = useDrag((state) => state.over === `zone:clothing:${slot.piece}`);
  // The piece's own item is being dragged: the slot it goes on lights up.
  const fits = useDrag((state) => slot.item !== undefined && state.source?.kind === "slot" && state.source.side === Side.Player && state.name === slot.item);
  const actionable = slot.available && (slot.worn || slot.restorable);
  const draggable = mode === ClothingMode.Items && slot.worn && slot.item !== undefined;

  return (
    <div className={cn("group relative flex items-center", align === "right" && "flex-row-reverse")}>
      <button
        type="button"
        data-zone="clothing"
        data-piece={slot.piece}
        data-worn={slot.worn}
        aria-label={label(`clothing.${slot.piece}`)}
        disabled={!slot.available}
        onClick={() => {
          if (actionable) toggleClothing(slot.piece);
        }}
        onPointerDown={draggable && slot.item ? (event) => pressItem(event, { kind: "clothing", piece: slot.piece }, slot.item as string, 1) : undefined}
        onPointerEnter={(event) => {
          if (slot.available && (event.buttons & 1) === 0) playSound(Sound.Hover);
        }}
        className={cn(
          "relative flex size-12 items-center justify-center rounded-lg border transition duration-150",
          slot.worn
            ? "border-white/10 bg-white/[0.07] text-white/85 hover:border-white/25 hover:bg-white/[0.12]"
            : "border-dashed border-white/10 bg-white/[0.02] text-white/25",
          slot.restorable && "border-clothing/40 text-white/50 hover:bg-clothing/10 hover:text-white/80",
          !slot.available && "cursor-not-allowed opacity-40",
          draggable && "cursor-grab",
          fits && "border-primary/60 text-white/70",
          over && fits && "scale-105 border-primary bg-primary/20 text-white",
        )}
      >
        <Icon className="size-5" />
        {slot.worn && <span className="absolute right-1 top-1 size-1 rounded-full bg-clothing" />}
      </button>
      <span
        className={cn(
          "pointer-events-none absolute z-30 flex w-max flex-col whitespace-nowrap rounded-md bg-[hsl(var(--ug-background)/0.95)] px-2 py-1 text-[0.6875rem] opacity-0 shadow-lg transition-opacity group-hover:opacity-100",
          align === "left" ? "left-full ml-2" : "right-full mr-2 items-end",
        )}
      >
        <span className="font-medium text-white">{label(`clothing.${slot.piece}`)}</span>
        <span className="text-white/45">{hintOf(slot, mode)}</span>
      </span>
    </div>
  );
}

/** Clothing slots on both sides of the character: the first half on the left, the rest on the right. */
export function Clothing() {
  const clothing = useInventory((state) => state.clothing);

  if (!clothing || clothing.pieces.length === 0) return null;

  const half = Math.ceil(clothing.pieces.length / 2);
  const columns: [ClothingSlot[], "left" | "right"][] = [
    [clothing.pieces.slice(0, half), "left"],
    [clothing.pieces.slice(half), "right"],
  ];

  return (
    <>
      {columns.map(([pieces, align]) => (
        <div
          key={align}
          data-clothing={align}
          className={cn("absolute top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5", align === "left" ? "left-2" : "right-2")}
        >
          {pieces.map((slot) => (
            <Piece key={slot.piece} slot={slot} mode={clothing.mode} align={align} />
          ))}
        </div>
      ))}
    </>
  );
}
