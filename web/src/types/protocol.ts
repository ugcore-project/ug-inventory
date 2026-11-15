/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// Mirrors `UgInventory.Enums` in shared/enums.lua. tests/nui.lua checks both sides match.

/** Messages Lua sends: `{ action, payload }`. */
export const NuiAction = {
  Config: "config",
  Open: "open",
  Close: "close",
  Update: "update",
  Other: "other",
  OtherClosed: "otherClosed",
  Equipped: "equipped",
  Result: "result",
  Toast: "toast",
  Hotbar: "hotbar",
  Wheel: "wheel",
  WheelClose: "wheelClose",
  Clothing: "clothing",
} as const;

export type NuiAction = (typeof NuiAction)[keyof typeof NuiAction];

/** Callbacks the page posts. Lua checks every body. */
export const NuiCallback = {
  Ready: "ready",
  Close: "close",
  Move: "move",
  Use: "use",
  Give: "give",
  Drop: "drop",
  Buy: "buy",
  Attach: "attach",
  Detach: "detach",
  Reload: "reload",
  Unload: "unload",
  WheelPick: "wheelPick",
  Sound: "sound",
  Clothing: "clothing",
} as const;

export type NuiCallback = (typeof NuiCallback)[keyof typeof NuiCallback];

/** ug-core's names for the two inventories on screen. */
export const Side = {
  Player: "player",
  Other: "other",
} as const;

export type Side = (typeof Side)[keyof typeof Side];

/** What can open next to the player's inventory. */
export const Kind = {
  Stash: "stash",
  Trunk: "trunk",
  Glovebox: "glovebox",
  Drop: "drop",
  Shop: "shop",
  /** Opened by server code, such as an admin: another player's pockets, a house stash. */
  Inventory: "inventory",
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

/** What an item is, for its colour. Weapons, ammo and attachments come from ug-core's weapons config. */
export const Category = {
  Weapon: "weapon",
  Ammo: "ammo",
  Attachment: "attachment",
  Consumable: "consumable",
  Clothing: "clothing",
  Item: "item",
} as const;

export type Category = (typeof Category)[keyof typeof Category];

/** Clothing pieces shown next to the character. */
export const ClothingPiece = {
  Hat: "hat",
  Glasses: "glasses",
  Ears: "ears",
  Mask: "mask",
  Chain: "chain",
  Top: "top",
  Undershirt: "undershirt",
  Gloves: "gloves",
  Vest: "vest",
  Bag: "bag",
  Watch: "watch",
  Bracelet: "bracelet",
  Legs: "legs",
  Shoes: "shoes",
} as const;

export type ClothingPiece = (typeof ClothingPiece)[keyof typeof ClothingPiece];

/** Toggle: a click takes a piece off and puts it back on. Items: a piece comes off as an item, worn again by using it. */
export const ClothingMode = {
  Toggle: "toggle",
  Items: "items",
} as const;

export type ClothingMode = (typeof ClothingMode)[keyof typeof ClothingMode];

export interface ClothingSlot {
  piece: ClothingPiece;
  worn: boolean;
  /** The character's model has a known drawable without the piece. */
  available: boolean;
  /** Toggle mode: off, and can go back on. */
  restorable: boolean;
  /** Items mode: the item the piece comes off as. */
  item?: string;
}

export interface ClothingState {
  mode: ClothingMode;
  pieces: ClothingSlot[];
}

/** Screen sounds, played by the game. The page MAY ask for Hover, Pick and Menu only: Lua plays the rest. */
export const Sound = {
  Open: "open",
  Close: "close",
  Hover: "hover",
  Pick: "pick",
  Menu: "menu",
  Move: "move",
  Use: "use",
  Give: "give",
  Drop: "drop",
  Buy: "buy",
  Attach: "attach",
  Detach: "detach",
  Reload: "reload",
  Error: "error",
} as const;

export type Sound = (typeof Sound)[keyof typeof Sound];

/** ug-core error codes, `UgCore.Enums.Errors`. */
export const ErrorCode = {
  InvalidArgs: "invalid_args",
  NotFound: "not_found",
  NotLoaded: "not_loaded",
  RateLimited: "rate_limited",
  NoPermission: "no_permission",
  InsufficientFunds: "insufficient_funds",
  InsufficientItems: "insufficient_items",
  CannotCarry: "cannot_carry",
  Timeout: "timeout",
  InternalError: "internal_error",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** ug-lib's theme, from `GlobalState['ug-lib:Config'].theme`, with this screen's owner values on top. */
export interface ThemeConfig {
  mode?: string;
  colors?: Record<string, string>;
  radius?: string;
  font?: string;
  scale?: number;
}

export interface PageConfig {
  theme?: ThemeConfig;
  labels: Record<string, string>;
  locale: string;
  /** Slots 1 to `hotbar` are the hotbar. */
  hotbar: number;
  /** Slots 1 to `wheel` are in the quick-use wheel. */
  wheel: number;
  toasts: boolean;
  /** The page asks Lua for hover, pick and menu sounds. */
  sounds: boolean;
  /** The key that opens the screen also closes it, as a key name such as `TAB`. */
  openKey?: string;
  layout: Layout;
  /** Ms a toast stays. */
  toastDuration: number;
  /** Owner features. Off hides them. */
  giving: boolean;
  dropping: boolean;
  workbench: boolean;
}

export const PocketsSide = { Left: "left", Right: "right" } as const;
export type PocketsSide = (typeof PocketsSide)[keyof typeof PocketsSide];

export const HotbarPosition = { Bottom: "bottom", Top: "top" } as const;
export type HotbarPosition = (typeof HotbarPosition)[keyof typeof HotbarPosition];

export const ToastPosition = {
  BottomRight: "bottom-right",
  BottomLeft: "bottom-left",
  TopRight: "top-right",
  TopLeft: "top-left",
} as const;
export type ToastPosition = (typeof ToastPosition)[keyof typeof ToastPosition];

/** Owner config layout: where things are and what shows. */
export interface Layout {
  pockets: PocketsSide;
  /** Slots per row. */
  columns: number;
  /** Slot size in rem. */
  slotSize: number;
  vignette: boolean;
  hints: boolean;
  quantityBar: boolean;
  /** Quantity buttons next to "All". */
  quantityPresets: number[];
  closeButton: boolean;
  hotbar: HotbarPosition;
  toasts: ToastPosition;
  animations: boolean;
}

/** Weapon metadata ug-core keeps on weapon items. */
export interface WeaponMetadata {
  serial: string;
  ammo: number;
  durability: number;
  components: string[];
  tint?: number;
}

export interface Item {
  slot: number;
  name: string;
  count: number;
  /** The definition label, sent with hotbar and wheel items. */
  label?: string;
  /** Only the fields the page reads, checked. */
  metadata?: ItemMetadata;
}

/** A plain metadata value, shown as it is. */
export type MetadataValue = string | number | boolean;

export interface ItemMetadata {
  weapon?: WeaponMetadata;
  label?: string;
  description?: string;
  /** Every other plain field, sorted by key, bounded. */
  info?: [string, MetadataValue][];
}

export interface Definition {
  label: string;
  /** Grams per unit. */
  weight: number;
  stack: boolean;
  /** Units per slot. */
  maxStack: number;
  description?: string;
  usable: boolean;
  category: Category;
}

export interface Inventory {
  slots: number;
  /** Grams. */
  maxWeight: number;
  /** By slot. */
  items: Record<number, Item>;
}

export interface Container extends Inventory {
  kind: Exclude<Kind, "shop">;
  label?: string;
}

export interface Listing {
  index: number;
  name: string;
  price: number;
  /** Units left. Unset means unlimited. */
  stock?: number;
}

export interface Shop {
  kind: "shop";
  label: string;
  account: string;
  balance?: number;
  listing: Listing[];
}

export interface NearbyPlayer {
  id: number;
  name: string;
}

export interface Toast {
  name: string;
  label: string;
  delta: number;
}

export interface NuiMessage {
  action: NuiAction;
  payload?: unknown;
}
