/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// Pointer-based drag and drop. HTML5 drag shows no custom ghost in CEF, so the page draws its own. Drop targets are
// marked in the DOM: `data-side` and `data-slot` on slots, `data-zone` on zones. A drag carries the quantity chosen
// in the quantity bar, or the whole stack.

import { create } from "zustand";
import { activate, amountOf, attach, buy, buyLimit, drop, inventoryOf, move, openAmount, toggleClothing, useInventory } from "@/store/inventoryStore";
import { playSound } from "@/lib/sound";
import { Kind, Side, Sound, type ClothingPiece } from "@/types/protocol";

export const Zone = {
  Drop: "drop",
  Workbench: "workbench",
  Clothing: "clothing",
} as const;

export type Zone = (typeof Zone)[keyof typeof Zone];

export type DragSource =
  | { kind: "slot"; side: Side; slot: number }
  | { kind: "listing"; index: number }
  /** A worn piece, in items mode: dropped on the pockets it comes off. */
  | { kind: "clothing"; piece: ClothingPiece };

interface DragState {
  source: DragSource | null;
  name: string;
  count: number;
  x: number;
  y: number;
  /** The target under the pointer, as `slot:<side>:<slot>` or `zone:<zone>`, to highlight it. */
  over: string | null;
}

const initial: DragState = { source: null, name: "", count: 0, x: 0, y: 0, over: null };

export const useDrag = create<DragState>(() => initial);

// Pixels the pointer moves before a press becomes a drag, so clicks and double-clicks stay clicks.
const DRAG_THRESHOLD = 5;

interface Target {
  key: string;
  element: HTMLElement;
}

function targetAt(x: number, y: number): Target | null {
  const element = document.elementFromPoint?.(x, y)?.closest<HTMLElement>("[data-slot],[data-zone]");

  if (!element) return null;

  if (element.dataset.zone) {
    const piece = element.dataset.piece;

    return { key: piece ? `zone:${element.dataset.zone}:${piece}` : `zone:${element.dataset.zone}`, element };
  }

  return { key: `slot:${element.dataset.side}:${element.dataset.slot}`, element };
}

/** What a drop on `element` does with the dragged item. */
function dropOn(element: HTMLElement, source: DragSource, units: number): void {
  const zone = element.dataset.zone;
  const inventory = useInventory.getState();

  if (source.kind === "listing") {
    const shop = inventory.other?.kind === Kind.Shop ? inventory.other : null;
    const entry = shop?.listing.find((listing) => listing.index === source.index);

    if (!shop || !entry || element.dataset.side !== Side.Player) return;

    const max = buyLimit(entry, shop.balance);

    // With a quantity chosen the drag buys it at once; without one it asks how many.
    if (inventory.quantity === 0) openAmount({ action: { kind: "buy", index: entry.index }, name: entry.name, max, value: 1, price: entry.price });
    else if (max > 0) buy(entry.index, Math.min(units, max));

    return;
  }

  if (source.kind === "clothing") {
    if (element.dataset.side === Side.Player) toggleClothing(source.piece);

    return;
  }

  if (zone === Zone.Clothing) {
    const piece = inventory.clothing?.pieces.find((entry) => entry.piece === element.dataset.piece);
    const item = source.side === Side.Player ? inventory.player?.items[source.slot] : undefined;

    // Items mode: the piece's own item goes on.
    if (piece?.item && item?.name === piece.item) activate(source.slot);

    return;
  }

  if (zone === Zone.Drop) {
    if (source.side === Side.Player) drop(source.slot, units);

    return;
  }

  if (zone === Zone.Workbench) {
    const weaponSlot = inventory.workbench;

    if (source.side === Side.Player && weaponSlot && weaponSlot !== source.slot) attach(weaponSlot, source.slot);

    return;
  }

  const side = element.dataset.side as Side | undefined;
  const slot = Number(element.dataset.slot);

  if ((side === Side.Player || side === Side.Other) && Number.isInteger(slot) && slot > 0) {
    move(source.side, source.slot, side, slot, units);
  }
}

/** The units a drag carries, for the ghost. */
export function draggedUnits(state: Pick<DragState, "count">): number {
  return amountOf(state.count);
}

/**
 * Starts watching a press on an item. It becomes a drag once the pointer moves past the threshold; a release before
 * that is a click and does nothing here.
 */
export function pressItem(event: React.PointerEvent, source: DragSource, name: string, count: number): void {
  if (event.button !== 0) return;

  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  const onMove = (moveEvent: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return;

      dragging = true;
      document.body.classList.add("ug-dragging");
      playSound(Sound.Pick);
    }

    const target = targetAt(moveEvent.clientX, moveEvent.clientY);

    useDrag.setState({
      source,
      name,
      count,
      x: moveEvent.clientX,
      y: moveEvent.clientY,
      over: target?.key ?? null,
    });
  };

  const onKey = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key === "Escape" && dragging) {
      keyEvent.stopPropagation();
      finish();
    }
  };

  const finish = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKey, true);
    document.body.classList.remove("ug-dragging");
    useDrag.setState(initial);
  };

  const onUp = (upEvent: PointerEvent) => {
    const state = useDrag.getState();
    const target = dragging ? targetAt(upEvent.clientX, upEvent.clientY) : null;

    finish();

    if (target && state.source) dropOn(target.element, state.source, draggedUnits(state));
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onKey, true);
}

/** The item a drag from a slot carries, or null when that slot is empty. */
export function sourceItem(source: DragSource | null) {
  if (!source || source.kind !== "slot") return null;

  return inventoryOf(useInventory.getState(), source.side)?.items[source.slot] ?? null;
}
