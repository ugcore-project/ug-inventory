/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// Showcase scenes: what the page shows for the README. The preview plays them, and `npm run capture` saves each one
// to .github/assets/<id>.webp, animated when `animated` is set. Add a scene for every screen worth showing.

import { browserLog } from "@/lib/nui";
import { hideTooltip } from "@/store/hoverStore";
import { ErrorCode, Kind, NuiAction, Side, type NuiMessage } from "@/types/protocol";

/** One step: a message as Lua would send it, a click or a drag, then a pause. */
export interface SceneStep {
  send?: NuiMessage;
  /** CSS selector of the element to click. */
  click?: string;
  /** CSS selector of the element to right-click. */
  menu?: string;
  /** Drags from one element to another, through real pointer events. */
  drag?: { from: string; to: string };
  /** CSS selector of the element to hover, for its tooltip. */
  hover?: string;
  /** Moves the pointer to this offset from the middle of the screen, in CSS pixels. */
  pointer?: { x: number; y: number };
  /** Answers the last request the page posted, as Lua would. */
  answer?: { ok: boolean; error?: ErrorCode };
  /** Milliseconds before the next step. */
  wait?: number;
}

export interface Scene {
  /** File name of the capture: lowercase, digits and dashes. */
  id: string;
  title: string;
  steps: SceneStep[];
  /** Captured as an animated image of the whole run, instead of a still of the end. */
  animated?: boolean;
  /** CSS selector of the element the capture is cropped to, with a margin. The whole screen when unset. */
  crop?: string;
}

/** A screen area in CSS pixels. */
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Sample data, shaped like Lua sends it.

const DEFINITIONS = {
  water: { label: "Water", weight: 500, stack: true, maxStack: 50, description: "Cold and clear.", usable: true, category: "consumable" },
  sandwich: { label: "Sandwich", weight: 300, stack: true, maxStack: 20, description: "Ham and cheese.", usable: true, category: "consumable" },
  bandage: { label: "Bandage", weight: 100, stack: true, maxStack: 20, description: "Stops the bleeding.", usable: true, category: "consumable" },
  phone: { label: "Phone", weight: 200, stack: false, maxStack: 1, description: "A smartphone with a cracked screen.", usable: true, category: "item" },
  lockpick: { label: "Lockpick", weight: 150, stack: true, maxStack: 10, usable: true, category: "item" },
  money_bag: { label: "Money bag", weight: 2000, stack: true, maxStack: 10, description: "Heavy, and not yours.", usable: false, category: "item" },
  weapon_pistol: { label: "Pistol", weight: 1200, stack: false, maxStack: 1, usable: true, category: "weapon" },
  weapon_smg: { label: "SMG", weight: 3000, stack: false, maxStack: 1, usable: true, category: "weapon" },
  ammo_9mm: { label: "9mm rounds", weight: 10, stack: true, maxStack: 250, usable: true, category: "ammo" },
  suppressor: { label: "Suppressor", weight: 300, stack: true, maxStack: 5, description: "Fits most pistols.", usable: false, category: "attachment" },
  flashlight: { label: "Flashlight", weight: 250, stack: true, maxStack: 5, usable: false, category: "attachment" },
  repair_kit: { label: "Repair kit", weight: 2500, stack: true, maxStack: 5, usable: true, category: "item" },
  radio: { label: "Radio", weight: 400, stack: false, maxStack: 1, usable: true, category: "item" },
  cola: { label: "eCola", weight: 350, stack: true, maxStack: 50, usable: true, category: "consumable" },
};

const PISTOL = {
  serial: "UG-48213-PX",
  ammo: 12,
  durability: 86,
  components: ["flashlight"],
  tint: 2,
};

const PLAYER = {
  slots: 50,
  maxWeight: 30000,
  items: [
    { slot: 1, name: "weapon_pistol", count: 1, metadata: PISTOL },
    { slot: 2, name: "water", count: 4 },
    { slot: 3, name: "bandage", count: 6 },
    { slot: 4, name: "phone", count: 1, metadata: { number: "555-0142", owner: "Ana Silva" } },
    { slot: 5, name: "sandwich", count: 2 },
    { slot: 7, name: "ammo_9mm", count: 120 },
    { slot: 8, name: "lockpick", count: 3 },
    { slot: 9, name: "suppressor", count: 1 },
    { slot: 12, name: "money_bag", count: 2 },
    { slot: 14, name: "radio", count: 1, metadata: { frequency: 101.5, encrypted: true } },
    { slot: 18, name: "cola", count: 6 },
    { slot: 23, name: "flashlight", count: 1 },
  ],
};

const TRUNK = {
  kind: Kind.Trunk,
  label: "Trunk · Sultan RS",
  slots: 25,
  maxWeight: 60000,
  items: [
    { slot: 1, name: "repair_kit", count: 2 },
    { slot: 2, name: "weapon_smg", count: 1, metadata: { serial: "UG-90122-SM", ammo: 0, durability: 41, components: [] } },
    { slot: 3, name: "cola", count: 12 },
    { slot: 6, name: "water", count: 10 },
  ],
};

const SHOP = {
  kind: Kind.Shop,
  label: "24/7 Supermarket",
  account: "cash",
  balance: 340,
  listing: [
    { index: 1, name: "water", price: 5 },
    { index: 2, name: "sandwich", price: 12 },
    { index: 3, name: "cola", price: 8, stock: 24 },
    { index: 4, name: "bandage", price: 40, stock: 6 },
    { index: 5, name: "phone", price: 450 },
    { index: 6, name: "radio", price: 120, stock: 0 },
    { index: 7, name: "flashlight", price: 60, stock: 3 },
    { index: 8, name: "repair_kit", price: 250 },
  ],
};

const NEARBY = [
  { id: 12, name: "Lena Ortiz" },
  { id: 27, name: "Marcus Hale" },
];

// Toggle mode: most pieces worn, the hat taken off, no glasses or bag.
const OFF = new Set(["hat", "glasses", "bag", "bracelet"]);
const CLOTHING = {
  mode: "toggle",
  pieces: ["hat", "glasses", "ears", "mask", "chain", "top", "undershirt", "gloves", "vest", "bag", "watch", "bracelet", "legs", "shoes"].map(
    (piece) => ({ piece, worn: !OFF.has(piece) && piece !== "mask" && piece !== "ears", available: true, restorable: piece === "hat" }),
  ),
};

const open = (other: unknown, equipped?: string): NuiMessage => ({
  action: NuiAction.Open,
  payload: { player: PLAYER, other, definitions: DEFINITIONS, equipped, nearby: NEARBY, weapons: true, clothing: CLOTHING },
});

/** Slots 1 to `count` with their labels, as Lua sends hotbar and wheel items. */
const firstSlots = (count: number) =>
  PLAYER.items
    .filter((item) => item.slot <= count)
    .map((item) => ({ ...item, label: DEFINITIONS[item.name as keyof typeof DEFINITIONS].label }));

const OPEN_TRUNK = open(TRUNK, PISTOL.serial);
const OPEN_SHOP = open(SHOP);
const OPEN_ALONE = open(undefined, PISTOL.serial);
const CLOSE: NuiMessage = { action: NuiAction.Close };
const SLOT = (side: string, slot: number) => `[data-side="${side}"][data-slot="${slot}"]`;

export const SCENES: Scene[] = [
  {
    id: "inventory-trunk",
    title: "Pockets and a trunk",
    steps: [
      { send: OPEN_TRUNK, wait: 300 },
      { hover: SLOT(Side.Player, 4), wait: 300 },
    ],
  },
  {
    id: "inventory-shop",
    title: "Shop",
    steps: [{ send: OPEN_SHOP, wait: 300 }],
  },
  {
    id: "inventory-workbench",
    title: "Weapon workbench",
    steps: [
      { send: OPEN_ALONE, wait: 200 },
      { menu: SLOT(Side.Player, 1), wait: 200 },
      { click: '[data-entry="inspect"]', wait: 300 },
    ],
  },
  {
    id: "inventory-actions",
    title: "Quick actions",
    steps: [
      { send: OPEN_ALONE, wait: 200 },
      { click: '[data-quantity-preset="5"]', wait: 100 },
      { menu: SLOT(Side.Player, 3), wait: 150 },
      { click: '[data-quick="give"]', wait: 300 },
    ],
  },
  {
    id: "inventory-drag",
    title: "Drag, quantities and give",
    animated: true,
    steps: [
      { send: OPEN_TRUNK, wait: 900 },
      { drag: { from: SLOT(Side.Other, 3), to: SLOT(Side.Player, 6) }, wait: 600 },

      { click: '[data-quantity-preset="50"]', wait: 400 },
      { drag: { from: SLOT(Side.Player, 7), to: SLOT(Side.Other, 4) }, wait: 500 },
      { click: '[data-quantity-preset="0"]', wait: 300 },
      { menu: SLOT(Side.Player, 3), wait: 400 },
      { click: '[data-quick="give"]', wait: 500 },
      { click: '[data-give-target="12"]', wait: 300 },
      { send: { action: NuiAction.Update, payload: { side: Side.Player, changes: [{ slot: 3 }] } } },
      { send: { action: NuiAction.Toast, payload: [{ name: "bandage", label: "Bandage", delta: -6 }] }, wait: 600 },
      { drag: { from: SLOT(Side.Player, 12), to: SLOT(Side.Other, 5) }, wait: 500 },
      { answer: { ok: false, error: ErrorCode.CannotCarry }, wait: 1600 },
    ],
  },
  {
    id: "quick-use-wheel",
    title: "Quick-use wheel",
    crop: "[data-wheel] svg",
    steps: [
      { send: CLOSE },
      { send: { action: NuiAction.Wheel, payload: { slots: 8, items: firstSlots(8) } }, wait: 100 },
      { pointer: { x: 120, y: -60 }, wait: 400 },
    ],
  },
  {
    id: "hotbar-and-toasts",
    title: "Hotbar and pickups",
    animated: true,
    steps: [
      { send: { action: NuiAction.WheelClose } },
      { send: CLOSE, wait: 400 },
      { send: { action: NuiAction.Hotbar, payload: { active: 2, items: firstSlots(5) } }, wait: 700 },
      { send: { action: NuiAction.Toast, payload: [{ name: "water", label: "Water", delta: -1 }] }, wait: 900 },
      {
        send: {
          action: NuiAction.Toast,
          payload: [
            { name: "money_bag", label: "Money bag", delta: 1 },
            { name: "lockpick", label: "Lockpick", delta: 2 },
          ],
        },
        wait: 2600,
      },
    ],
  },
];

/** Fires the pointer events of a drag from one element's center to another's. */
async function dragBetween(from: Element, to: Element): Promise<void> {
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  const x0 = start.left + start.width / 2;
  const y0 = start.top + start.height / 2;
  const x1 = end.left + end.width / 2;
  const y1 = end.top + end.height / 2;
  const options = (x: number, y: number) => ({ bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1 });
  const steps = 18;

  from.dispatchEvent(new PointerEvent("pointerdown", options(x0, y0)));

  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    // Eases out, like a hand slowing down near the target.
    const eased = 1 - (1 - t) ** 3;

    window.dispatchEvent(new PointerEvent("pointermove", options(x0 + (x1 - x0) * eased, y0 + (y1 - y0) * eased)));
    await new Promise((resolve) => setTimeout(resolve, 22));
  }

  window.dispatchEvent(new PointerEvent("pointerup", options(x1, y1)));
}

/**
 * Plays a scene through `send`. Resolves after the last step's pause, with the area the crop element covered after
 * any step, or null without a crop or when it never showed.
 */
export async function playScene(scene: Scene, send: (message: NuiMessage) => void): Promise<Area | null> {
  let area: Area | null = null;

  // A tooltip left from the scene before would cover this one.
  hideTooltip();

  for (const step of scene.steps) {
    if (step.send) {
      send(step.send);
    }

    if (step.click) {
      document.querySelector<HTMLElement>(step.click)?.click();
    }

    if (step.menu) {
      const target = document.querySelector(step.menu);
      const box = target?.getBoundingClientRect();

      if (target && box) {
        target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: box.right - 8, clientY: box.top + 12 }));
      }
    }

    if (step.drag) {
      const from = document.querySelector(step.drag.from);
      const to = document.querySelector(step.drag.to);

      if (from && to) await dragBetween(from, to);
    }

    if (step.hover) {
      document.querySelector(step.hover)?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerId: 1 }));
    }

    if (step.pointer) {
      const x = window.innerWidth / 2 + step.pointer.x;
      const y = window.innerHeight / 2 + step.pointer.y;

      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
    }

    if (step.answer) {
      const last = browserLog.at(-1)?.data as { id?: unknown } | undefined;

      if (typeof last?.id === "number") send({ action: NuiAction.Result, payload: { id: last.id, ...step.answer } });
    }

    await new Promise((resolve) => setTimeout(resolve, step.wait ?? 0));

    const box = scene.crop ? document.querySelector(scene.crop)?.getBoundingClientRect() : undefined;

    if (box && box.width > 0) {
      const left = Math.min(area?.x ?? box.left, box.left);
      const top = Math.min(area?.y ?? box.top, box.top);
      const right = Math.max(area ? area.x + area.width : box.right, box.right);
      const bottom = Math.max(area ? area.y + area.height : box.bottom, box.bottom);

      area = { x: left, y: top, width: right - left, height: bottom - top };
    }
  }

  return area;
}
