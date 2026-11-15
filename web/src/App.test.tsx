/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { fill, humanize, kilograms, shortCount, unitsOf } from "@/lib/format";
import { slotAt } from "@/lib/wheel";
import { hoverWheel, move, quickMove, resetInventory, handleMessage, useInventory } from "@/store/inventoryStore";
import { Kind, NuiAction, Side } from "@/types/protocol";

MotionGlobalConfig.skipAnimations = true;

const nui = vi.hoisted(() => ({
  isEnvBrowser: () => false,
  sendReady: vi.fn(async () => true),
  sendClose: vi.fn(async () => true),
  sendMove: vi.fn(async (..._args: unknown[]) => true),
  sendUse: vi.fn(async (..._args: unknown[]) => true),
  sendGive: vi.fn(async (..._args: unknown[]) => true),
  sendDrop: vi.fn(async (..._args: unknown[]) => true),
  sendBuy: vi.fn(async (..._args: unknown[]) => true),
  sendAttach: vi.fn(async (..._args: unknown[]) => true),
  sendDetach: vi.fn(async (..._args: unknown[]) => true),
  sendReload: vi.fn(async (..._args: unknown[]) => true),
  sendUnload: vi.fn(async (..._args: unknown[]) => true),
  sendWheelPick: vi.fn(async (..._args: unknown[]) => true),
  sendSound: vi.fn(async (..._args: unknown[]) => true),
  sendClothing: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock("@/lib/nui", () => nui);

const english = JSON.parse(readFileSync("../locales/en.json", "utf8")) as { page: Record<string, unknown> };

const send = (action: string, payload?: unknown) => act(() => handleMessage({ action: action as NuiAction, payload }));
const slot = (side: string, number: number) => document.querySelector<HTMLElement>(`[data-side="${side}"][data-slot="${number}"]`);
const itemIn = (side: string, number: number) => slot(side, number)?.getAttribute("data-item") ?? null;

const DEFINITIONS = {
  water: { label: "Water", weight: 500, stack: true, maxStack: 10, usable: true, category: "consumable", description: "Cold and clear." },
  phone: { label: "Phone", weight: 200, stack: false, maxStack: 1, usable: true, category: "item" },
  brick: { label: "Brick", weight: 50000, stack: true, maxStack: 5, usable: false, category: "item" },
  weapon_pistol: { label: "Pistol", weight: 1200, stack: false, maxStack: 1, usable: true, category: "weapon" },
  flashlight: { label: "Flashlight", weight: 250, stack: true, maxStack: 5, usable: false, category: "attachment" },
};

const PISTOL = { serial: "UG-1", ammo: 12, durability: 80, components: ["flashlight"] };

const PLAYER = {
  slots: 10,
  maxWeight: 30000,
  items: [
    { slot: 1, name: "weapon_pistol", count: 1, metadata: PISTOL },
    { slot: 2, name: "water", count: 4 },
    { slot: 3, name: "phone", count: 1, metadata: { number: "555-0142", plate: "UG 42", locked: true, nested: { a: 1 } } },
  ],
};

const STASH = { kind: Kind.Stash, label: "Garage", slots: 6, maxWeight: 100000, items: [{ slot: 1, name: "water", count: 8 }] };

function openWith(other?: unknown, extra: Record<string, unknown> = {}) {
  render(<App />);
  send(NuiAction.Config, { labels: english.page, locale: "en", hotbar: 3, wheel: 4, toasts: true, openKey: "TAB" });
  send(NuiAction.Open, { player: PLAYER, other, definitions: DEFINITIONS, nearby: [{ id: 7, name: "Lena" }], weapons: true, ...extra });
}

/** The id of the last request of a sender: the first argument. */
const lastId = (sender: { mock: { calls: unknown[][] } }) => sender.mock.calls.at(-1)?.[0] as number;

beforeEach(() => {
  vi.clearAllMocks();
  act(() => resetInventory());
});

describe("screen", () => {
  it("says ready once, and shows nothing until Lua opens it", () => {
    render(<App />);

    expect(nui.sendReady).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-screen]")).toBeNull();
  });

  it("shows the pockets with hotbar keys, and the stash next to them", () => {
    openWith(STASH);

    expect(screen.getByText("Pockets")).toBeTruthy();
    expect(screen.getByText("Garage")).toBeTruthy();
    expect(itemIn(Side.Player, 2)).toBe("water");
    expect(itemIn(Side.Other, 1)).toBe("water");
    expect(slot(Side.Player, 3)?.textContent).toContain("3");
    expect(document.querySelectorAll(`[data-side="${Side.Other}"]`)).toHaveLength(6);
  });

  it("shows the ground when nothing is open next to the player", () => {
    openWith();

    expect(document.querySelector('[data-panel="ground"]')).not.toBeNull();
  });

  it("drops broken messages and items it cannot trust", () => {
    render(<App />);
    send(NuiAction.Open, { player: { slots: "10", maxWeight: 1, items: [] } });
    send(NuiAction.Open, null);

    expect(document.querySelector("[data-screen]")).toBeNull();

    send(NuiAction.Open, {
      player: {
        slots: 4,
        maxWeight: 1000,
        items: [
          { slot: 1, name: "<img src=x>", count: 1 },
          { slot: 2, name: "water", count: "5" },
          { slot: 9, name: "water", count: 1 },
          { slot: 3, name: "water", count: 2 },
        ],
      },
      definitions: DEFINITIONS,
    });

    expect(itemIn(Side.Player, 1)).toBeNull();
    expect(itemIn(Side.Player, 2)).toBeNull();
    expect(itemIn(Side.Player, 3)).toBe("water");
    expect(slot(Side.Player, 9)).toBeNull();
  });

  it("closes with Escape and with the open key, but not while typing in the search", () => {
    openWith();

    fireEvent.keyDown(screen.getByPlaceholderText("Search items"), { key: "Tab" });

    expect(nui.sendClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Tab" });

    expect(nui.sendClose).toHaveBeenCalledTimes(1);

    send(NuiAction.Open, { player: PLAYER, definitions: DEFINITIONS });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(nui.sendClose).toHaveBeenCalledTimes(2);
  });

  it("shows the description, the category and plain metadata of the hovered item", () => {
    openWith();
    fireEvent.pointerEnter(slot(Side.Player, 2) as HTMLElement);

    expect(document.querySelector("[data-tooltip]")?.textContent).toContain("Consumable");
    expect(document.querySelector("[data-description]")?.textContent).toBe("Cold and clear.");

    fireEvent.pointerLeave(slot(Side.Player, 2) as HTMLElement);
    fireEvent.pointerEnter(slot(Side.Player, 3) as HTMLElement);

    expect(document.querySelector("[data-description]")?.textContent).toBe("No description.");

    const details = document.querySelector("[data-metadata]")?.textContent ?? "";

    expect(details).toContain("Number555-0142");
    expect(details).toContain("PlateUG 42");
    expect(details).toContain("LockedYes");
    expect(details).not.toContain("Nested");
  });

  it("asks Lua for hover and menu sounds, spaced out, unless the owner turned them off", () => {
    let now = performance.now() + 100000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);

    openWith();
    fireEvent.pointerEnter(slot(Side.Player, 2) as HTMLElement);
    fireEvent.pointerEnter(slot(Side.Player, 3) as HTMLElement);
    now += 200;
    fireEvent.pointerEnter(slot(Side.Player, 9) as HTMLElement);
    fireEvent.contextMenu(slot(Side.Player, 2) as HTMLElement);

    expect(nui.sendSound.mock.calls).toEqual([["hover"], ["menu"]]);

    send(NuiAction.Config, { labels: english.page, locale: "en", sounds: false });
    now += 200;
    fireEvent.pointerEnter(slot(Side.Player, 3) as HTMLElement);

    expect(nui.sendSound).toHaveBeenCalledTimes(2);
    clock.mockRestore();
  });

  it("dims what the search and filter leave out", () => {
    openWith();

    fireEvent.change(screen.getByPlaceholderText("Search items"), { target: { value: "wat" } });

    expect(slot(Side.Player, 2)?.className).not.toContain("opacity-25");
    expect(slot(Side.Player, 3)?.className).toContain("opacity-25");

    fireEvent.change(screen.getByPlaceholderText("Search items"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Weapons" }));

    expect(slot(Side.Player, 1)?.className).not.toContain("opacity-25");
    expect(slot(Side.Player, 2)?.className).toContain("opacity-25");
  });
});

describe("moves", () => {
  it("predicts a move and keeps it when ug-core agrees", () => {
    openWith(STASH);
    act(() => move(Side.Player, 2, Side.Other, 4, 4));

    expect(nui.sendMove).toHaveBeenCalledWith(expect.any(Number), Side.Player, 2, Side.Other, 4, 4);
    expect(itemIn(Side.Player, 2)).toBeNull();
    expect(itemIn(Side.Other, 4)).toBe("water");

    send(NuiAction.Result, { id: lastId(nui.sendMove), ok: true });

    expect(itemIn(Side.Other, 4)).toBe("water");
  });

  it("puts the slots back and says why when ug-core refuses", () => {
    openWith(STASH);
    act(() => move(Side.Player, 3, Side.Other, 2, 1));
    send(NuiAction.Result, { id: lastId(nui.sendMove), ok: false, error: "no_permission" });

    expect(itemIn(Side.Player, 3)).toBe("phone");
    expect(itemIn(Side.Other, 2)).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("You can't do that here.");
  });

  it("merges up to the stack size, and swaps different whole stacks", () => {
    openWith(STASH);
    act(() => move(Side.Player, 2, Side.Other, 1, 4));

    // 8 + 4 with a stack of 10: two stay behind.
    expect(useInventory.getState().player?.items[2]?.count).toBe(2);
    expect(slot(Side.Other, 1)?.textContent).toContain("10");

    act(() => move(Side.Player, 1, Side.Player, 3, 1));

    expect(itemIn(Side.Player, 1)).toBe("phone");
    expect(itemIn(Side.Player, 3)).toBe("weapon_pistol");
  });

  it("refuses at once what would pass the weight", () => {
    openWith({ ...STASH, items: [{ slot: 1, name: "brick", count: 1 }] });
    act(() => move(Side.Other, 1, Side.Player, 5, 1));

    expect(nui.sendMove).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("You can't carry that.");
  });

  it("quick-moves onto a matching stack, else into the first empty slot", () => {
    openWith(STASH);
    act(() => quickMove(Side.Player, 2));

    expect(nui.sendMove).toHaveBeenLastCalledWith(expect.any(Number), Side.Player, 2, Side.Other, 1, 4);

    act(() => quickMove(Side.Player, 3));

    expect(nui.sendMove).toHaveBeenLastCalledWith(expect.any(Number), Side.Player, 3, Side.Other, 2, 1);
  });

  it("moves the stack with Shift-click, one with Ctrl-click, and uses with a double-click", () => {
    openWith(STASH);
    fireEvent.click(slot(Side.Player, 2) as HTMLElement, { shiftKey: true });

    expect(nui.sendMove).toHaveBeenLastCalledWith(expect.any(Number), Side.Player, 2, Side.Other, 1, 4);

    fireEvent.click(slot(Side.Other, 1) as HTMLElement, { ctrlKey: true });

    expect(nui.sendMove).toHaveBeenLastCalledWith(expect.any(Number), Side.Other, 1, Side.Player, 2, 1);

    fireEvent.doubleClick(slot(Side.Player, 3) as HTMLElement);

    expect(nui.sendUse).toHaveBeenCalledWith(expect.any(Number), 3);

    fireEvent.click(slot(Side.Player, 7) as HTMLElement, { shiftKey: true });
    fireEvent.doubleClick(slot(Side.Player, 7) as HTMLElement);

    expect(nui.sendMove).toHaveBeenCalledTimes(2);
    expect(nui.sendUse).toHaveBeenCalledTimes(1);
  });

  it("drags the quantity chosen at the bottom, or the whole stack", () => {
    openWith(STASH);
    fireEvent.click(document.querySelector('[data-quantity-preset="1"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-quantity-step="1"]') as HTMLElement);

    expect((document.querySelector("[data-quantity-input]") as HTMLInputElement).value).toBe("2");

    const target = slot(Side.Other, 3) as HTMLElement;

    document.elementFromPoint = () => target;
    fireEvent.pointerDown(slot(Side.Player, 2) as HTMLElement, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 });

    expect(document.querySelector("[data-ghost]")?.textContent).toBe("2");

    fireEvent.pointerUp(window, { clientX: 60, clientY: 60 });

    expect(nui.sendMove).toHaveBeenCalledWith(expect.any(Number), Side.Player, 2, Side.Other, 3, 2);
    expect(document.querySelector("[data-ghost]")).toBeNull();

    fireEvent.click(document.querySelector('[data-quantity-preset="0"]') as HTMLElement);
    fireEvent.pointerDown(slot(Side.Player, 3) as HTMLElement, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 });
    fireEvent.pointerUp(window, { clientX: 60, clientY: 60 });

    expect(nui.sendMove).toHaveBeenLastCalledWith(expect.any(Number), Side.Player, 3, Side.Other, 3, 1);
  });

  it("applies server changes and full syncs", () => {
    openWith(STASH);
    send(NuiAction.Update, { side: Side.Player, changes: [{ slot: 2 }, { slot: 5, item: { name: "phone", count: 1 } }] });

    expect(itemIn(Side.Player, 2)).toBeNull();
    expect(itemIn(Side.Player, 5)).toBe("phone");

    send(NuiAction.Update, { side: Side.Player, inventory: { slots: 2, maxWeight: 100, items: {} } });

    expect(document.querySelectorAll(`[data-side="${Side.Player}"]`)).toHaveLength(2);

    send(NuiAction.OtherClosed);

    expect(document.querySelector('[data-panel="ground"]')).not.toBeNull();
  });
});

describe("actions", () => {
  it("uses, gives, drops and splits from the context menu, with the chosen quantity", () => {
    openWith(STASH);
    fireEvent.contextMenu(slot(Side.Player, 2) as HTMLElement, { clientX: 5, clientY: 5 });
    fireEvent.click(document.querySelector('[data-quick="use"]') as HTMLElement);

    expect(nui.sendUse).toHaveBeenCalledWith(expect.any(Number), 2);

    fireEvent.click(document.querySelector('[data-quantity-preset="1"]') as HTMLElement);
    fireEvent.contextMenu(slot(Side.Player, 2) as HTMLElement, { clientX: 5, clientY: 5 });
    fireEvent.click(document.querySelector('[data-quick="give"]') as HTMLElement);

    // One player nearby: no list, the give goes out at once.
    expect(nui.sendGive).toHaveBeenCalledWith(expect.any(Number), 2, 1, 7);

    fireEvent.contextMenu(slot(Side.Player, 2) as HTMLElement, { clientX: 5, clientY: 5 });
    fireEvent.click(document.querySelector('[data-quick="drop"]') as HTMLElement);

    expect(nui.sendDrop).toHaveBeenCalledWith(expect.any(Number), 2, 1);

    fireEvent.contextMenu(slot(Side.Player, 2) as HTMLElement, { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Split/ }));
    fireEvent.change(document.querySelector("[data-amount-input]") as HTMLElement, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(nui.sendMove).toHaveBeenCalledWith(expect.any(Number), Side.Player, 2, Side.Player, 4, 3);

    fireEvent.contextMenu(slot(Side.Other, 1) as HTMLElement, { clientX: 5, clientY: 5 });

    expect(document.querySelector<HTMLButtonElement>('[data-quick="use"]')?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-quick="drop"]')?.disabled).toBe(true);
  });

  it("lists the players to give to when more than one is near", () => {
    openWith(undefined, { nearby: [{ id: 7, name: "Lena" }, { id: 9, name: "Tom" }] });
    fireEvent.contextMenu(slot(Side.Player, 3) as HTMLElement, { clientX: 5, clientY: 5 });
    fireEvent.click(document.querySelector('[data-quick="give"]') as HTMLElement);

    expect(nui.sendGive).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('[data-give-target="9"]') as HTMLElement);

    expect(nui.sendGive).toHaveBeenCalledWith(expect.any(Number), 3, 1, 9);
    expect(document.querySelector("[data-menu]")).toBeNull();
  });

  it("buys what the player can afford, never more than the stock", () => {
    openWith({
      kind: Kind.Shop,
      label: "24/7",
      account: "cash",
      balance: 30,
      listing: [
        { index: 1, name: "water", price: 5, stock: 3 },
        { index: 2, name: "phone", price: 450 },
      ],
    });

    expect(document.querySelector<HTMLButtonElement>('[data-listing="2"]')?.disabled).toBe(true);

    fireEvent.click(document.querySelector('[data-listing="1"]') as HTMLElement);
    fireEvent.change(document.querySelector("[data-amount-input]") as HTMLElement, { target: { value: "50" } });

    expect(document.querySelector("[data-total]")?.textContent).toBe("$15");

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(nui.sendBuy).toHaveBeenCalledWith(expect.any(Number), 1, 3);
  });

  it("works on a weapon: detach, and reload only while it is in hand", () => {
    openWith(undefined);
    fireEvent.contextMenu(slot(Side.Player, 1) as HTMLElement, { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Inspect/ }));

    expect(document.querySelector("[data-workbench]")?.textContent).toContain("UG-1");
    expect(document.querySelector("[data-reload]")).toBeNull();

    fireEvent.click(document.querySelector('[data-detach="flashlight"]') as HTMLElement);

    expect(nui.sendDetach).toHaveBeenCalledWith(expect.any(Number), 1, "flashlight");

    send(NuiAction.Equipped, { serial: "UG-1", armed: true });
    fireEvent.click(document.querySelector("[data-reload]") as HTMLElement);

    expect(nui.sendReload).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-equipped]")).not.toBeNull();
  });
});

describe("clothing", () => {
  const piece = (name: string) => document.querySelector<HTMLButtonElement>(`[data-piece="${name}"]`);
  const TOGGLE = {
    mode: "toggle",
    pieces: [
      { piece: "hat", worn: true, available: true, restorable: false },
      { piece: "top", worn: false, available: true, restorable: true },
      { piece: "legs", worn: false, available: true, restorable: false },
      { piece: "shoes", worn: true, available: false, restorable: false },
      { piece: "cape", worn: true, available: true, restorable: false },
    ],
  };

  it("shows the pieces on both sides of the character and takes them off or back on with a click", () => {
    openWith(undefined, { clothing: TOGGLE });

    expect(document.querySelectorAll('[data-clothing="left"] [data-piece]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-clothing="right"] [data-piece]')).toHaveLength(2);
    expect(piece("cape")).toBeNull();

    fireEvent.click(piece("hat") as HTMLElement);
    fireEvent.click(piece("top") as HTMLElement);
    fireEvent.click(piece("legs") as HTMLElement);

    expect(nui.sendClothing.mock.calls.map((call) => call[1])).toEqual(["hat", "top"]);
    expect(piece("shoes")?.disabled).toBe(true);

    send(NuiAction.Clothing, { mode: "toggle", pieces: [{ piece: "hat", worn: false, available: true, restorable: true }] });

    expect(piece("hat")?.dataset.worn).toBe("false");
    expect(piece("top")).toBeNull();
  });

  it("wears a piece's own item dropped on its slot, and takes a worn piece off by dragging it to the pockets", () => {
    const shirt = { slot: 4, name: "clothing_top", count: 1, metadata: { model: "mp_m_freemode_01", drawable: 9, texture: 0 } };

    openWith(undefined, {
      player: { ...PLAYER, items: [...PLAYER.items, shirt] },
      clothing: {
        mode: "items",
        pieces: [
          { piece: "hat", worn: true, available: true, restorable: false, item: "clothing_hat" },
          { piece: "top", worn: false, available: true, restorable: false, item: "clothing_top" },
        ],
      },
    });

    document.elementFromPoint = () => piece("hat");
    fireEvent.pointerDown(slot(Side.Player, 4) as HTMLElement, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 });
    fireEvent.pointerUp(window, { clientX: 60, clientY: 60 });

    expect(nui.sendUse).not.toHaveBeenCalled();

    document.elementFromPoint = () => piece("top");
    fireEvent.pointerDown(slot(Side.Player, 4) as HTMLElement, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 });
    fireEvent.pointerUp(window, { clientX: 60, clientY: 60 });

    expect(nui.sendUse).toHaveBeenCalledWith(expect.any(Number), 4);

    document.elementFromPoint = () => slot(Side.Player, 9);
    fireEvent.pointerDown(piece("hat") as HTMLElement, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 });
    fireEvent.pointerUp(window, { clientX: 60, clientY: 60 });

    expect(nui.sendClothing).toHaveBeenCalledWith(expect.any(Number), "hat");
  });

  it("shows no slots when the owner turned clothing off", () => {
    openWith();

    expect(document.querySelector("[data-clothing]")).toBeNull();
  });
});

describe("owner config", () => {
  const configure = (extra: Record<string, unknown>) =>
    send(NuiAction.Config, { labels: english.page, locale: "en", hotbar: 3, wheel: 4, toasts: true, ...extra });

  function openConfigured(extra: Record<string, unknown>, other?: unknown) {
    render(<App />);
    configure(extra);
    send(NuiAction.Open, { player: PLAYER, other, definitions: DEFINITIONS, nearby: [{ id: 7, name: "Lena" }], weapons: true });
  }

  const root = () => document.documentElement.style;

  it("lays out the screen as the owner set it, and keeps defaults for fields left out", () => {
    openConfigured({
      layout: { pockets: "right", columns: 7, slotSize: 4, hints: false, quantityBar: true, quantityPresets: [2, 25], closeButton: false, vignette: false },
    });

    expect(document.querySelector('[data-column="pockets"]')?.className).toContain("order-3");
    expect(document.querySelector('[data-column="other"]')?.className).toContain("order-1");
    expect(root().getPropertyValue("--ug-columns")).toBe("7");
    expect(root().getPropertyValue("--ug-slot")).toBe("4rem");
    // 7 slots of 4rem, 6 gaps of 0.375rem, 2rem of padding.
    expect(root().getPropertyValue("--ug-panel-width")).toBe("32.25rem");
    expect(document.querySelector("[data-help]")).toBeNull();
    expect(document.querySelector("[data-close]")).toBeNull();
    expect(document.querySelector("[data-vignette]")).toBeNull();
    expect([...document.querySelectorAll("[data-quantity-preset]")].map((entry) => entry.getAttribute("data-quantity-preset"))).toEqual(["0", "2", "25"]);
  });

  it("falls back to the default layout for values out of bounds", () => {
    openConfigured({ layout: { pockets: "middle", columns: 40, slotSize: "big", hints: "yes", toasts: "center" } });

    expect(useInventory.getState().config.layout).toMatchObject({ pockets: "left", columns: 5, slotSize: 5.1, hints: true, toasts: "bottom-right" });
    expect(document.querySelector("[data-help]")).not.toBeNull();
    expect(document.querySelector("[data-close]")).not.toBeNull();
  });

  it("hides give, drop and the workbench when the owner turned them off, and never sends them", () => {
    openConfigured({ giving: false, dropping: false, workbench: false });

    expect(document.querySelector('[data-panel="ground"]')).toBeNull();
    expect(document.querySelector('[data-panel="nothing"]')).not.toBeNull();

    fireEvent.contextMenu(slot(Side.Player, 1) as HTMLElement, { clientX: 5, clientY: 5 });

    expect(document.querySelector('[data-quick="use"]')).not.toBeNull();
    expect(document.querySelector('[data-quick="give"]')).toBeNull();
    expect(document.querySelector('[data-quick="drop"]')).toBeNull();
    expect(document.querySelector('[data-entry="inspect"]')).toBeNull();

    fireEvent(slot(Side.Player, 1) as HTMLElement, new MouseEvent("auxclick", { bubbles: true, button: 1 }));

    expect(useInventory.getState().workbench).toBeNull();

    configure({ workbench: true });
    fireEvent(slot(Side.Player, 1) as HTMLElement, new MouseEvent("auxclick", { bubbles: true, button: 1 }));

    expect(useInventory.getState().workbench).toBe(1);
    expect(nui.sendGive).not.toHaveBeenCalled();
    expect(nui.sendDrop).not.toHaveBeenCalled();
  });

  it("applies the theme colors, this screen's own tokens included, and skips anything else", () => {
    openConfigured({ theme: { colors: { primary: "10 80% 50%", weapon: "0 90% 70%", overlay: "0 0% 0%", hacker: "1 1% 1%", accent: "red" }, radius: "4px" } });

    expect(root().getPropertyValue("--ug-primary")).toBe("10 80% 50%");
    expect(root().getPropertyValue("--ug-weapon")).toBe("0 90% 70%");
    expect(root().getPropertyValue("--ug-overlay")).toBe("0 0% 0%");
    expect(root().getPropertyValue("--ug-accent")).toBe("");
    expect(root().getPropertyValue("--ug-hacker")).toBe("");
    expect(root().getPropertyValue("--ug-radius")).toBe("4px");
  });

  it("places the hotbar and the toasts where the owner set them, and keeps toasts for the set time", () => {
    vi.useFakeTimers();

    try {
      render(<App />);
      configure({ layout: { hotbar: "top", toasts: "top-left" }, toastDuration: 1000 });
      send(NuiAction.Hotbar, { active: 1, items: [] });
      send(NuiAction.Toast, [{ name: "water", label: "Water", delta: 2 }]);

      expect(document.querySelector("[data-hotbar-position]")?.getAttribute("data-hotbar-position")).toBe("top");
      expect(document.querySelector("[data-toasts]")?.className).toContain("left-6");
      expect(document.querySelectorAll("[data-toast]")).toHaveLength(1);

      act(() => vi.advanceTimersByTime(1100));

      expect(useInventory.getState().toasts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stills every animation when the owner turned them off", () => {
    openConfigured({ layout: { animations: false } });

    expect(document.documentElement.classList.contains("ug-still")).toBe(true);

    configure({ layout: { animations: true } });

    expect(document.documentElement.classList.contains("ug-still")).toBe(false);
  });
});

describe("outside the screen", () => {
  it("shows pickups as toasts, unless the owner turned them off", () => {
    render(<App />);
    send(NuiAction.Toast, [{ name: "water", label: "Water", delta: 2 }, { name: "bad name", label: "x", delta: 1 }]);

    expect(document.querySelectorAll("[data-toast]")).toHaveLength(1);
    expect(screen.getByText("+2")).toBeTruthy();

    send(NuiAction.Config, { labels: english.page, locale: "en", toasts: false });
    send(NuiAction.Toast, [{ name: "phone", label: "Phone", delta: -1 }]);

    expect(document.querySelector('[data-toast="phone"]')).toBeNull();
  });

  it("flashes the hotbar after a slot key", () => {
    render(<App />);
    send(NuiAction.Config, { labels: english.page, locale: "en", hotbar: 3 });
    send(NuiAction.Hotbar, { active: 2, items: [{ slot: 2, name: "water", count: 4 }] });

    expect(document.querySelectorAll("[data-hotbar-slot]")).toHaveLength(3);
  });

  it("uses the wheel slot under the mouse when the key is released", () => {
    render(<App />);
    send(NuiAction.Wheel, { slots: 4, items: [{ slot: 1, name: "water", count: 1, label: "Cold water" }] });

    expect(document.querySelectorAll("[data-wheel-slot]")).toHaveLength(4);

    fireEvent.pointerMove(window, { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 - 120 });

    expect(screen.getByText("Cold water")).toBeTruthy();

    act(() => hoverWheel(3));
    send(NuiAction.WheelClose);

    expect(nui.sendWheelPick).toHaveBeenCalledWith(3);
    expect(document.querySelector("[data-wheel]")).toBeNull();
  });
});

describe("helpers", () => {
  it("formats and measures", () => {
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(kilograms(1500)).toBe("1.5");
    expect(kilograms(12000)).toBe("12");
    expect(shortCount(999)).toBe("999");
    expect(shortCount(1250)).toBe("1.2k");
    expect(shortCount(15600)).toBe("15k");
    expect(unitsOf(9, 0)).toBe(9);
    expect(unitsOf(9, 5)).toBe(5);
    expect(unitsOf(3, 5)).toBe(3);
    expect(humanize("plateNumber")).toBe("Plate number");
    expect(humanize("serial_no")).toBe("Serial no");
  });

  it("finds the wheel slot from the angle, and none in the middle", () => {
    expect(slotAt(0, 0, 8)).toBe(0);
    expect(slotAt(0, -100, 8)).toBe(1);
    expect(slotAt(100, 0, 8)).toBe(3);
    expect(slotAt(-100, -1, 4)).toBe(4);
  });
});
