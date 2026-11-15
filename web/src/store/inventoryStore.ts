/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// Page state. Every Lua message is read through a checker: wrong shapes are dropped, never rendered as they came.
// The page predicts moves so drag and drop feels instant. ug-core decides: a refused action puts the touched slots
// back, and every server change overwrites the prediction.

import { create } from "zustand";
import { flattenLabels } from "@/lib/labels";
import { applyLayout, applyTheme } from "@/lib/theme";
import * as nui from "@/lib/nui";
import { unitsOf } from "@/lib/format";
import {
  Category,
  ClothingMode,
  ClothingPiece,
  ErrorCode,
  HotbarPosition,
  Kind,
  NuiAction,
  PocketsSide,
  Side,
  ToastPosition,
  type ClothingSlot,
  type ClothingState,
  type Container,
  type Definition,
  type Inventory,
  type Item,
  type Layout,
  type Listing,
  type MetadataValue,
  type NearbyPlayer,
  type NuiMessage,
  type PageConfig,
  type Shop,
  type ThemeConfig,
  type Toast,
  type WeaponMetadata,
} from "@/types/protocol";

/** English labels until Lua sends the configured language. Same keys as `page` in locales/en.json. */
export const DEFAULT_LABELS: Record<string, string> = {
  pockets: "Pockets",
  ground: "Ground",
  close: "Close",
  "error.internal_error": "Something went wrong. Try again.",
};

export const Filter = {
  All: "all",
  Weapons: "weapons",
  Usable: "usable",
} as const;

export type Filter = (typeof Filter)[keyof typeof Filter];

/** What an amount dialog does once confirmed. */
export type AmountAction =
  | { kind: "split"; side: Side; slot: number }
  | { kind: "move"; side: Side; slot: number }
  | { kind: "drop"; slot: number }
  | { kind: "give"; slot: number; target: number }
  | { kind: "buy"; index: number };

export interface AmountDialog {
  action: AmountAction;
  /** Item name, for the icon and the title. */
  name: string;
  max: number;
  value: number;
  /** Price per unit, for buying. */
  price?: number;
}

export interface ContextMenu {
  side: Side;
  slot: number;
  x: number;
  y: number;
}

export interface ToastEntry extends Toast {
  id: number;
}

export interface Notice {
  id: number;
  text: string;
}

interface InventoryState {
  config: PageConfig;
  open: boolean;
  player: Inventory | null;
  other: Container | Shop | null;
  definitions: Record<string, Definition>;
  /** Serial of the weapon in hand. */
  equipped: string | null;
  nearby: NearbyPlayer[];
  weapons: boolean;
  /** Clothing slots, null when the owner turned clothing off. */
  clothing: ClothingState | null;
  search: string;
  filter: Filter;
  menu: ContextMenu | null;
  amount: AmountDialog | null;
  /** Player slot of the weapon on the workbench. */
  workbench: number | null;
  toasts: ToastEntry[];
  /** The hotbar shown while the screen is closed, after a slot key. */
  hotbar: { active: number; items: Record<number, Item>; at: number } | null;
  wheel: { slots: number; items: Record<number, Item> } | null;
  notice: Notice | null;
  /** Slots that just changed, as `<side>:<slot>`, to flash them. */
  flashes: Record<string, number>;
  /** Units the quick actions, drags and gives take from a stack. 0 is the whole stack. */
  quantity: number;
}

/** Same values as the layout in server/config.default.lua. */
export const DEFAULT_LAYOUT: Layout = {
  pockets: PocketsSide.Left,
  columns: 5,
  slotSize: 5.1,
  vignette: true,
  hints: true,
  quantityBar: true,
  quantityPresets: [1, 5, 10, 50],
  closeButton: true,
  hotbar: HotbarPosition.Bottom,
  toasts: ToastPosition.BottomRight,
  animations: true,
};

const DEFAULT_TOAST_MS = 3500;

const initial: InventoryState = {
  config: {
    labels: DEFAULT_LABELS,
    locale: "en",
    hotbar: 5,
    wheel: 8,
    toasts: true,
    sounds: true,
    layout: DEFAULT_LAYOUT,
    toastDuration: DEFAULT_TOAST_MS,
    giving: true,
    dropping: true,
    workbench: true,
  },
  open: false,
  player: null,
  other: null,
  definitions: {},
  equipped: null,
  nearby: [],
  weapons: false,
  clothing: null,
  search: "",
  filter: Filter.All,
  menu: null,
  amount: null,
  workbench: null,
  toasts: [],
  hotbar: null,
  wheel: null,
  notice: null,
  flashes: {},
  quantity: 0,
};

export const useInventory = create<InventoryState>(() => initial);

const get = useInventory.getState;
const set = useInventory.setState;

// ---------------------------------------------------------------------------------------------------------------
// Readers. Lua's json encodes an empty table as `{}` or `[]`, so lists are read from either.

const ERRORS = Object.values(ErrorCode) as string[];
const KINDS = Object.values(Kind) as string[];
const CATEGORIES = Object.values(Category) as string[];
const PIECES = Object.values(ClothingPiece) as string[];
const CLOTHING_MODES = Object.values(ClothingMode) as string[];
const MAX_TEXT = 64;
const MAX_LONG_TEXT = 300;
const MAX_SLOTS = 1000;
const MAX_LISTING = 200;
const MAX_COMPONENTS = 16;
const MAX_NEARBY = 32;
const MAX_INFO = 12;
const MAX_QUANTITY = 1_000_000;
const INFO_KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
// Metadata fields shown on their own, never in the info list.
const OWN_FIELDS = new Set(["label", "description", "serial", "ammo", "durability", "components", "tint"]);
const MAX_TOASTS = 5;
const HOTBAR_MS = 2000;
const NOTICE_MS = 3000;
const FLASH_MS = 700;
const NAME = /^[a-z][a-z0-9_]*$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown, max = MAX_TEXT): string | undefined =>
  typeof value === "string" && value.length > 0 ? value.slice(0, max) : undefined;
const whole = (value: unknown, max: number): number | undefined => (isNumber(value) ? Math.min(Math.max(Math.round(value), 0), max) : undefined);
const name = (value: unknown): string | undefined => (typeof value === "string" && value.length <= MAX_TEXT && NAME.test(value) ? value : undefined);

function list(value: unknown, max: number): unknown[] {
  if (Array.isArray(value)) {
    return value.slice(0, max);
  }

  return isObject(value) ? Object.values(value).slice(0, max) : [];
}

function readWeapon(value: Record<string, unknown>): WeaponMetadata | undefined {
  const serial = text(value.serial);

  if (!serial) {
    return undefined;
  }

  const components = list(value.components, MAX_COMPONENTS).map(name).filter((entry): entry is string => entry !== undefined);
  const weapon: WeaponMetadata = {
    serial,
    ammo: whole(value.ammo, 100_000) ?? 0,
    durability: whole(value.durability, 100) ?? 100,
    components,
  };
  const tint = whole(value.tint, 64);

  if (tint !== undefined) weapon.tint = tint;

  return weapon;
}

/** Plain metadata fields other than the ones shown on their own: short keys, short values, at most MAX_INFO. */
function readInfo(value: Record<string, unknown>): [string, MetadataValue][] {
  const info: [string, MetadataValue][] = [];

  for (const key of Object.keys(value).sort()) {
    if (info.length >= MAX_INFO) break;
    if (OWN_FIELDS.has(key) || !INFO_KEY.test(key)) continue;

    const field = value[key];

    if (typeof field === "boolean" || isNumber(field)) info.push([key, field]);
    else if (typeof field === "string" && field.length > 0) info.push([key, field.slice(0, MAX_TEXT)]);
  }

  return info;
}

/** An item without its slot. */
function readStack(value: unknown, slot: number): Item | null {
  if (!isObject(value)) {
    return null;
  }

  const itemName = name(value.name);
  const count = whole(value.count, 1_000_000);

  if (!itemName || !count) {
    return null;
  }

  const item: Item = { slot, name: itemName, count };
  const itemText = text(value.label);

  if (itemText) item.label = itemText;

  if (isObject(value.metadata)) {
    const weapon = readWeapon(value.metadata);
    const label = text(value.metadata.label);
    const description = text(value.metadata.description, MAX_LONG_TEXT);
    const info = readInfo(value.metadata);

    if (weapon || label || description || info.length > 0) {
      item.metadata = {};
      if (weapon) item.metadata.weapon = weapon;
      if (label) item.metadata.label = label;
      if (description) item.metadata.description = description;
      if (info.length > 0) item.metadata.info = info;
    }
  }

  return item;
}

function readItems(value: unknown, slots: number): Record<number, Item> {
  const items: Record<number, Item> = {};

  for (const entry of list(value, MAX_SLOTS)) {
    const slot = isObject(entry) ? whole(entry.slot, MAX_SLOTS) : undefined;
    const item = slot && slot <= slots ? readStack(entry, slot) : null;

    if (item) {
      items[item.slot] = item;
    }
  }

  return items;
}

function readInventory(value: unknown): Inventory | null {
  if (!isObject(value)) {
    return null;
  }

  const slots = whole(value.slots, MAX_SLOTS);
  const maxWeight = whole(value.maxWeight, 100_000_000);

  if (!slots || maxWeight === undefined) {
    return null;
  }

  return { slots, maxWeight, items: readItems(value.items, slots) };
}

function readShop(value: Record<string, unknown>): Shop | null {
  const label = text(value.label);
  const account = name(value.account);

  if (!label || !account) {
    return null;
  }

  const listing: Listing[] = [];

  for (const entry of list(value.listing, MAX_LISTING)) {
    if (!isObject(entry)) continue;

    const index = whole(entry.index, MAX_LISTING);
    const itemName = name(entry.name);
    const price = whole(entry.price, 1_000_000_000);

    if (index && itemName && price !== undefined) {
      const stock = whole(entry.stock, 1_000_000);

      listing.push(stock === undefined ? { index, name: itemName, price } : { index, name: itemName, price, stock });
    }
  }

  const shop: Shop = { kind: Kind.Shop, label, account, listing };
  const balance = whole(value.balance, Number.MAX_SAFE_INTEGER);

  if (balance !== undefined) shop.balance = balance;

  return shop;
}

function readOther(value: unknown): Container | Shop | null {
  if (!isObject(value) || typeof value.kind !== "string" || !KINDS.includes(value.kind)) {
    return null;
  }

  if (value.kind === Kind.Shop) {
    return readShop(value);
  }

  const inventory = readInventory(value);

  if (!inventory) {
    return null;
  }

  const container: Container = { ...inventory, kind: value.kind as Container["kind"] };
  const label = text(value.label);

  if (label) container.label = label;

  return container;
}

function readDefinitions(value: unknown): Record<string, Definition> {
  const definitions: Record<string, Definition> = {};

  if (!isObject(value)) {
    return definitions;
  }

  for (const [key, entry] of Object.entries(value).slice(0, 5000)) {
    if (!name(key) || !isObject(entry)) continue;

    const label = text(entry.label) ?? key;
    const stack = entry.stack !== false;
    const definition: Definition = {
      label,
      weight: whole(entry.weight, 10_000_000) ?? 0,
      stack,
      maxStack: stack ? (whole(entry.maxStack, 1_000_000) ?? 1_000_000) : 1,
      usable: entry.usable === true,
      category: typeof entry.category === "string" && CATEGORIES.includes(entry.category) ? (entry.category as Category) : Category.Item,
    };
    const description = text(entry.description, MAX_LONG_TEXT);

    if (description) definition.description = description;

    definitions[key] = definition;
  }

  return definitions;
}

function readNearby(value: unknown): NearbyPlayer[] {
  const players: NearbyPlayer[] = [];

  for (const entry of list(value, MAX_NEARBY)) {
    if (!isObject(entry)) continue;

    const id = whole(entry.id, 65535);
    const playerName = text(entry.name, 40);

    if (id && playerName) players.push({ id, name: playerName });
  }

  return players;
}

function readClothing(value: unknown): ClothingState | null {
  if (!isObject(value) || typeof value.mode !== "string" || !CLOTHING_MODES.includes(value.mode)) return null;

  const seen = new Set<string>();
  const pieces: ClothingSlot[] = [];

  for (const entry of list(value.pieces, PIECES.length)) {
    if (!isObject(entry) || typeof entry.piece !== "string" || !PIECES.includes(entry.piece) || seen.has(entry.piece)) continue;

    seen.add(entry.piece);

    const slot: ClothingSlot = {
      piece: entry.piece as ClothingPiece,
      worn: entry.worn === true,
      available: entry.available === true,
      restorable: entry.restorable === true,
    };
    const item = name(entry.item);

    if (item) slot.item = item;
    pieces.push(slot);
  }

  return { mode: value.mode as ClothingMode, pieces };
}

const POCKETS = Object.values(PocketsSide) as string[];
const HOTBAR_POSITIONS = Object.values(HotbarPosition) as string[];
const TOAST_POSITIONS = Object.values(ToastPosition) as string[];
const MAX_PRESETS = 6;

/** A number within bounds, or the fallback. */
function within(value: unknown, min: number, max: number, fallback: number): number {
  return isNumber(value) && value >= min && value <= max ? value : fallback;
}

/** One of `values`, or the fallback. */
function oneOf<T extends string>(value: unknown, values: string[], fallback: T): T {
  return typeof value === "string" && values.includes(value) ? (value as T) : fallback;
}

/** The owner layout. Lua checked it; every field falls back to its default here too. */
function readLayout(value: unknown): Layout {
  if (!isObject(value)) return DEFAULT_LAYOUT;

  const presets = list(value.quantityPresets, MAX_PRESETS)
    .filter((entry): entry is number => isNumber(entry) && Number.isInteger(entry) && entry >= 1 && entry <= MAX_QUANTITY);
  const flag = (key: keyof Layout) => (typeof value[key] === "boolean" ? (value[key] as boolean) : (DEFAULT_LAYOUT[key] as boolean));

  return {
    pockets: oneOf(value.pockets, POCKETS, DEFAULT_LAYOUT.pockets),
    columns: Math.round(within(value.columns, 3, 10, DEFAULT_LAYOUT.columns)),
    slotSize: within(value.slotSize, 3.5, 8, DEFAULT_LAYOUT.slotSize),
    vignette: flag("vignette"),
    hints: flag("hints"),
    quantityBar: flag("quantityBar"),
    quantityPresets: Array.isArray(value.quantityPresets) || isObject(value.quantityPresets) ? presets : DEFAULT_LAYOUT.quantityPresets,
    closeButton: flag("closeButton"),
    hotbar: oneOf(value.hotbar, HOTBAR_POSITIONS, DEFAULT_LAYOUT.hotbar),
    toasts: oneOf(value.toasts, TOAST_POSITIONS, DEFAULT_LAYOUT.toasts),
    animations: flag("animations"),
  };
}

function readConfig(value: unknown): PageConfig | null {
  if (!isObject(value)) {
    return null;
  }

  const labels = isObject(value.labels) ? flattenLabels(value.labels) : {};
  const config: PageConfig = {
    labels: { ...DEFAULT_LABELS, ...labels },
    locale: text(value.locale) ?? "en",
    hotbar: whole(value.hotbar, 10) ?? 0,
    wheel: whole(value.wheel, 10) ?? 0,
    toasts: value.toasts !== false,
    sounds: value.sounds !== false,
    layout: readLayout(value.layout),
    toastDuration: Math.round(within(value.toastDuration, 1000, 15000, DEFAULT_TOAST_MS)),
    giving: value.giving !== false,
    dropping: value.dropping !== false,
    workbench: value.workbench !== false,
  };
  const openKey = text(value.openKey, 16);

  if (openKey) config.openKey = openKey.toUpperCase();
  if (isObject(value.theme)) config.theme = value.theme as unknown as ThemeConfig;

  return config;
}

/** Slots 1 to `count` from a list of items, for the hotbar and the wheel. */
function readSlots(value: unknown, count: number): Record<number, Item> {
  return readItems(value, count);
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers.

/** The inventory on one side, when it holds items: a shop does not. */
export function inventoryOf(state: Pick<InventoryState, "player" | "other">, side: Side): Inventory | null {
  if (side === Side.Player) {
    return state.player;
  }

  return state.other && state.other.kind !== Kind.Shop ? state.other : null;
}

/** Grams carried. */
export function weightOf(inventory: Inventory, definitions: Record<string, Definition>): number {
  let total = 0;

  for (const item of Object.values(inventory.items)) {
    total += (definitions[item.name]?.weight ?? 0) * item.count;
  }

  return total;
}

/** Whether two stacks MAY merge: same item, stacking, and nothing unique about either. */
function stacks(a: Item, b: Item, definitions: Record<string, Definition>): boolean {
  return a.name === b.name && definitions[a.name]?.stack !== false && !a.metadata && !b.metadata;
}

/** Where a quick move lands on `side`: a stack with room, else the first empty slot. */
export function freeSlotFor(inventory: Inventory, item: Item, definitions: Record<string, Definition>, skip?: number): number | null {
  const maxStack = definitions[item.name]?.maxStack ?? 1;

  for (let slot = 1; slot <= inventory.slots; slot++) {
    const current = inventory.items[slot];

    if (slot !== skip && current && stacks(current, item, definitions) && current.count < maxStack) {
      return slot;
    }
  }

  for (let slot = 1; slot <= inventory.slots; slot++) {
    if (slot !== skip && !inventory.items[slot]) {
      return slot;
    }
  }

  return null;
}

export function label(key: string, fallback?: string): string {
  return get().config.labels[key] ?? fallback ?? key;
}

/** What an item is called: its own label when it has one, else its definition's. */
export function itemLabel(item: Pick<Item, "name" | "metadata" | "label">): string {
  return item.metadata?.label ?? get().definitions[item.name]?.label ?? item.label ?? item.name;
}

let nextToast = 1;
let nextNotice = 1;

function notify(code: string | undefined): void {
  const key = `error.${code && ERRORS.includes(code) ? code : ErrorCode.InternalError}`;
  const notice = { id: nextNotice++, text: label(key, label("error.internal_error")) };

  set({ notice });
  setTimeout(() => {
    if (get().notice?.id === notice.id) set({ notice: null });
  }, NOTICE_MS);
}

function flash(keys: string[]): void {
  if (keys.length === 0) return;

  const at = Date.now();

  set((state) => {
    const flashes = { ...state.flashes };

    for (const key of keys) flashes[key] = at;

    return { flashes };
  });
  setTimeout(() => {
    set((state) => {
      const flashes = { ...state.flashes };

      for (const key of keys) if (flashes[key] === at) delete flashes[key];

      return { flashes };
    });
  }, FLASH_MS);
}

// ---------------------------------------------------------------------------------------------------------------
// Requests. Each one gets an id; Lua answers with a result of that id. A refused move puts its slots back.

interface Pending {
  /** Slots as they were before the prediction, by `<side>:<slot>`. Null for empty slots. */
  slots: Record<string, Item | null>;
}

const pending = new Map<number, Pending>();
let nextRequest = 1;

function request(slots: Record<string, Item | null> = {}): number {
  const id = nextRequest++;

  pending.set(id, { slots });

  return id;
}

/** Puts the slots a request predicted back as they were. */
function revert(entry: Pending): void {
  set((state) => {
    let player = state.player;
    let other = state.other;

    for (const [key, item] of Object.entries(entry.slots)) {
      const [side, slotText] = key.split(":");
      const slot = Number(slotText);
      const inventory = side === Side.Player ? player : other && other.kind !== Kind.Shop ? other : null;

      if (!inventory) continue;

      const items = { ...inventory.items };

      if (item) items[slot] = item;
      else delete items[slot];

      if (side === Side.Player) player = { ...inventory, items };
      else other = { ...(inventory as Container), items };
    }

    return { player, other };
  });
}

/** When Lua does not take the body at all, no result follows. */
function settleRejected(id: number) {
  return (accepted: boolean) => {
    if (!accepted) handleResult({ id, ok: false, error: ErrorCode.InvalidArgs });
  };
}

function handleResult(value: unknown): void {
  if (!isObject(value)) return;

  const id = whole(value.id, Number.MAX_SAFE_INTEGER);
  const entry = id ? pending.get(id) : undefined;

  if (!id || !entry) return;

  pending.delete(id);

  if (value.ok !== true) {
    revert(entry);
    notify(typeof value.error === "string" ? value.error : undefined);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Messages.

function applyChanges(side: Side, value: unknown): void {
  const state = get();
  const inventory = inventoryOf(state, side);

  if (!inventory) return;

  const items = { ...inventory.items };
  const changed: string[] = [];

  for (const entry of list(value, MAX_SLOTS)) {
    if (!isObject(entry)) continue;

    const slot = whole(entry.slot, inventory.slots);

    if (!slot) continue;

    const item = readStack(entry.item, slot);
    const before = items[slot];

    if (item) items[slot] = item;
    else delete items[slot];

    if (item && (!before || before.name !== item.name || before.count < item.count)) {
      changed.push(`${side}:${slot}`);
    }
  }

  if (side === Side.Player) set({ player: { ...inventory, items } });
  else set({ other: { ...(inventory as Container), items } });

  flash(changed);
}

function pushToasts(value: unknown): void {
  if (!get().config.toasts) return;

  const entries: ToastEntry[] = [];

  for (const entry of list(value, MAX_TOASTS)) {
    if (!isObject(entry)) continue;

    const itemName = name(entry.name);
    const delta = isNumber(entry.delta) ? Math.round(entry.delta) : 0;

    if (itemName && delta !== 0) {
      entries.push({ id: nextToast++, name: itemName, label: text(entry.label) ?? itemName, delta });
    }
  }

  if (entries.length === 0) return;

  set((state) => ({ toasts: [...state.toasts, ...entries].slice(-MAX_TOASTS) }));

  const ids = new Set(entries.map((entry) => entry.id));

  setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => !ids.has(toast.id)) })), get().config.toastDuration);
}

export function handleMessage(message: NuiMessage): void {
  const payload = message.payload;

  switch (message.action) {
    case NuiAction.Config: {
      const config = readConfig(payload);

      if (config) {
        applyTheme(config.theme);
        applyLayout(config.layout);
        set({ config });
      }

      break;
    }
    case NuiAction.Open: {
      if (!isObject(payload)) break;

      const player = readInventory(payload.player);

      if (!player) break;

      pending.clear();
      set({
        open: true,
        player,
        other: readOther(payload.other),
        definitions: readDefinitions(payload.definitions),
        equipped: text(payload.equipped) ?? null,
        nearby: readNearby(payload.nearby),
        weapons: payload.weapons === true,
        clothing: readClothing(payload.clothing),
        menu: null,
        amount: null,
        workbench: null,
        hotbar: null,
        wheel: null,
        notice: null,
      });

      break;
    }
    case NuiAction.Close:
      pending.clear();
      set({ open: false, other: null, menu: null, amount: null, workbench: null, search: "", flashes: {} });
      break;
    case NuiAction.Update: {
      if (!isObject(payload) || (payload.side !== Side.Player && payload.side !== Side.Other)) break;

      if (payload.side === Side.Player && payload.inventory !== undefined) {
        const player = readInventory(payload.inventory);

        if (player) set({ player });
      } else {
        applyChanges(payload.side, payload.changes);
      }

      break;
    }
    case NuiAction.Other: {
      const other = readOther(payload);

      if (other) set({ other });

      break;
    }
    case NuiAction.OtherClosed:
      set((state) => ({ other: state.other?.kind === Kind.Shop ? state.other : null, amount: null, menu: null }));
      break;
    case NuiAction.Equipped:
      if (isObject(payload)) set({ equipped: payload.armed === true ? (text(payload.serial) ?? null) : null });
      break;
    case NuiAction.Result:
      handleResult(payload);
      break;
    case NuiAction.Clothing:
      set({ clothing: readClothing(payload) });
      break;
    case NuiAction.Toast:
      pushToasts(payload);
      break;
    case NuiAction.Hotbar: {
      if (!isObject(payload)) break;

      const count = get().config.hotbar;
      const active = whole(payload.active, count);

      if (!active) break;

      const at = Date.now();

      set({ hotbar: { active, items: readSlots(payload.items, count), at } });
      setTimeout(() => {
        if (get().hotbar?.at === at) set({ hotbar: null });
      }, HOTBAR_MS);

      break;
    }
    case NuiAction.Wheel: {
      if (!isObject(payload)) break;

      const slots = whole(payload.slots, 10);

      if (slots) {
        wheelHover = 0;
        set({ wheel: { slots, items: readSlots(payload.items, slots) } });
      }

      break;
    }
    case NuiAction.WheelClose:
      // The key was released: what the mouse is over is the pick.
      pickWheel(wheelHover);
      break;
    default:
      break;
  }
}

/** Listens for Lua messages. Returns the uninstaller. */
export function installMessages(): () => void {
  const listener = (event: MessageEvent<NuiMessage>) => {
    if (isObject(event.data) && typeof event.data.action === "string") {
      handleMessage(event.data);
    }
  };

  window.addEventListener("message", listener);

  return () => window.removeEventListener("message", listener);
}

// ---------------------------------------------------------------------------------------------------------------
// Actions the page asks for.

/** Predicts a move like ug-core runs it: into an empty slot, onto a matching stack, or a swap of whole stacks. */
function predictMove(from: Side, fromSlot: number, to: Side, toSlot: number, count: number): Record<string, Item | null> | null {
  const state = get();
  const source = inventoryOf(state, from);
  const target = inventoryOf(state, to);
  const item = source?.items[fromSlot];

  if (!source || !target || !item || toSlot > target.slots || count < 1 || count > item.count) {
    return null;
  }

  const fromKey = `${from}:${fromSlot}`;
  const toKey = `${to}:${toSlot}`;
  const current = target.items[toSlot];
  const before: Record<string, Item | null> = { [fromKey]: item, [toKey]: current ?? null };

  if (from === to && fromSlot === toSlot) {
    return null;
  }

  // Weight is only checked when it changes inventory: ug-core refuses the rest anyway.
  if (from !== to) {
    const weight = (state.definitions[item.name]?.weight ?? 0) * count;

    if (weightOf(target, state.definitions) + weight > target.maxWeight) {
      notify(ErrorCode.CannotCarry);

      return null;
    }
  }

  const write = (side: Side, slot: number, value: Item | null) => {
    const inventory = inventoryOf(get(), side);

    if (!inventory) return;

    const items = { ...inventory.items };

    if (value) items[slot] = { ...value, slot };
    else delete items[slot];

    if (side === Side.Player) set({ player: { ...inventory, items } });
    else set({ other: { ...(inventory as Container), items } });
  };

  const rest = item.count - count;

  if (!current) {
    write(to, toSlot, { ...item, count });
    write(from, fromSlot, rest > 0 ? { ...item, count: rest } : null);
  } else if (stacks(current, item, state.definitions)) {
    const maxStack = state.definitions[item.name]?.maxStack ?? 1;
    const moved = Math.min(count, maxStack - current.count);

    if (moved <= 0) {
      return null;
    }

    write(to, toSlot, { ...current, count: current.count + moved });
    write(from, fromSlot, item.count - moved > 0 ? { ...item, count: item.count - moved } : null);
  } else if (rest === 0) {
    write(to, toSlot, item);
    write(from, fromSlot, current);
  } else {
    return null;
  }

  return before;
}

/** Moves `count` units between two slots. */
export function move(from: Side, fromSlot: number, to: Side, toSlot: number, count: number): void {
  const before = predictMove(from, fromSlot, to, toSlot, count);

  if (!before) return;

  const id = request(before);

  void nui.sendMove(id, from, fromSlot, to, toSlot, count).then(settleRejected(id));
}

/** Units an action takes from a stack of `count`, from the quantity bar. */
export function amountOf(count: number): number {
  return unitsOf(count, get().quantity);
}

export function setQuantity(quantity: number): void {
  set({ quantity: Number.isFinite(quantity) ? Math.min(Math.max(Math.round(quantity), 0), MAX_QUANTITY) : 0 });
}

/** Shift-click and Ctrl-click: sends units of a stack to the other side, onto a matching stack or into the first empty slot. */
export function quickMove(side: Side, slot: number, count?: number): void {
  const state = get();
  const to = side === Side.Player ? Side.Other : Side.Player;
  const source = inventoryOf(state, side);
  const target = inventoryOf(state, to);
  const item = source?.items[slot];

  if (!item || !target) return;

  const toSlot = freeSlotFor(target, item, state.definitions);

  if (toSlot) move(side, slot, to, toSlot, count ?? item.count);
  else notify(ErrorCode.CannotCarry);
}

/** Splits a stack into the first empty slot of the same inventory. */
export function split(side: Side, slot: number, count: number): void {
  const inventory = inventoryOf(get(), side);

  if (!inventory) return;

  for (let target = 1; target <= inventory.slots; target++) {
    if (!inventory.items[target]) {
      move(side, slot, side, target, count);

      return;
    }
  }

  notify(ErrorCode.CannotCarry);
}

/** Uses a player slot: eats, drinks, equips. */
export function activate(slot: number): void {
  const id = request();

  void nui.sendUse(id, slot).then(settleRejected(id));
}

/** Takes a piece off, or puts it back on in toggle mode. */
export function toggleClothing(piece: ClothingPiece): void {
  const id = request();

  void nui.sendClothing(id, piece).then(settleRejected(id));
}

export function give(slot: number, count: number, target: number): void {
  if (!get().config.giving) return;

  const id = request();

  void nui.sendGive(id, slot, count, target).then(settleRejected(id));
}

export function drop(slot: number, count: number): void {
  if (!get().config.dropping) return;

  const id = request();

  void nui.sendDrop(id, slot, count).then(settleRejected(id));
}

export function buy(index: number, count: number): void {
  const id = request();

  void nui.sendBuy(id, index, count).then(settleRejected(id));
}

export function attach(weaponSlot: number, itemSlot: number): void {
  const id = request();

  void nui.sendAttach(id, weaponSlot, itemSlot).then(settleRejected(id));
}

export function detach(slot: number, item: string): void {
  const id = request();

  void nui.sendDetach(id, slot, item).then(settleRejected(id));
}

export function reload(): void {
  const id = request();

  void nui.sendReload(id).then(settleRejected(id));
}

export function unload(): void {
  const id = request();

  void nui.sendUnload(id).then(settleRejected(id));
}

/** The most a buyer can take of a listing: stock, money, and the request limit. */
export function buyLimit(entry: Listing, balance: number | undefined): number {
  let max = Math.min(entry.stock ?? 1000, 1000);

  if (balance !== undefined && entry.price > 0) {
    max = Math.min(max, Math.floor(balance / entry.price));
  }

  return Math.max(max, 0);
}

/** Runs what a confirmed amount dialog was for. */
export function confirmAmount(): void {
  const dialog = get().amount;

  set({ amount: null });

  if (!dialog || dialog.value < 1) return;

  const { action, value } = dialog;

  switch (action.kind) {
    case "split":
      split(action.side, action.slot, value);
      break;
    case "move":
      quickMove(action.side, action.slot, value);
      break;
    case "drop":
      drop(action.slot, value);
      break;
    case "give":
      give(action.slot, value, action.target);
      break;
    case "buy":
      buy(action.index, value);
      break;
  }
}

export function setAmount(value: number): void {
  set((state) => (state.amount ? { amount: { ...state.amount, value: Math.max(1, Math.min(state.amount.max, Math.round(value))) } } : {}));
}

export function openAmount(dialog: Omit<AmountDialog, "value"> & { value?: number }): void {
  if (dialog.max < 1) return;

  set({ amount: { ...dialog, value: Math.max(1, Math.min(dialog.max, dialog.value ?? Math.ceil(dialog.max / 2))) }, menu: null });
}

export function closeAmount(): void {
  set({ amount: null });
}

export function openMenu(menu: ContextMenu): void {
  set({ menu });
}

export function closeMenu(): void {
  set({ menu: null });
}

export function openWorkbench(slot: number | null): void {
  if (slot !== null && !get().config.workbench) return;

  set({ workbench: slot, menu: null });
}

export function setSearch(search: string): void {
  set({ search: search.slice(0, MAX_TEXT) });
}

export function setFilter(filter: Filter): void {
  set({ filter });
}

/** Whether an item shows under the search and filter. Hidden items stay in their slots, dimmed. */
export function matches(item: Item, search: string, filter: Filter, definitions: Record<string, Definition>): boolean {
  if (filter === Filter.Weapons && !item.metadata?.weapon) return false;
  if (filter === Filter.Usable && !definitions[item.name]?.usable) return false;

  const query = search.trim().toLowerCase();

  if (!query) return true;

  const definition = definitions[item.name];

  return item.name.includes(query) || (item.metadata?.label ?? definition?.label ?? "").toLowerCase().includes(query);
}

/** Closes at once. Lua drops focus and confirms with a close message. */
export function close(): void {
  set({ open: false, menu: null, amount: null, workbench: null });
  void nui.sendClose();
}

let wheelHover = 0;

/** The wheel slot under the mouse, 0 for none. */
export function hoverWheel(slot: number): void {
  wheelHover = slot;
}

/** Ends the wheel, using `slot`, or nothing with 0. */
export function pickWheel(slot: number): void {
  if (!get().wheel) return;

  set({ wheel: null });
  void nui.sendWheelPick(slot);
}

/** Back to the first state, for tests. */
export function resetInventory(): void {
  pending.clear();
  set(initial, true);
}
