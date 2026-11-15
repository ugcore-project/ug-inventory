/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// The only file that calls `fetch`. NUI callbacks are POSTs to `https://<resource>/<callback>`.

import { NuiCallback, type ClothingPiece, type Side, type Sound } from "@/types/protocol";

declare global {
  interface Window {
    GetParentResourceName?: () => string;
  }
}

/** True in a normal browser (`npm run dev`), where no NUI callback endpoint exists. */
export function isEnvBrowser(): boolean {
  return typeof window.GetParentResourceName !== "function";
}

function resourceName(): string {
  return window.GetParentResourceName?.() ?? "ug-inventory";
}

/** Sent requests in a browser, for the dev preview and tests. */
export const browserLog: { callback: string; data: unknown }[] = [];

/** Posts to Lua. Resolves whether Lua accepted the body. */
export async function postNui(callback: NuiCallback, data: unknown): Promise<boolean> {
  if (isEnvBrowser()) {
    browserLog.push({ callback, data });

    return true;
  }

  try {
    const response = await fetch(`https://${resourceName()}/${callback}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(data),
    });
    const reply = (await response.json()) as { ok?: unknown };

    return reply.ok === true;
  } catch {
    return false;
  }
}

// Every action carries a request id: Lua answers with a result message of the same id.
export const sendReady = () => postNui(NuiCallback.Ready, {});
export const sendClose = () => postNui(NuiCallback.Close, {});
export const sendMove = (id: number, from: Side, fromSlot: number, to: Side, toSlot: number, count: number) =>
  postNui(NuiCallback.Move, { id, from, fromSlot, to, toSlot, count });
export const sendUse = (id: number, slot: number) => postNui(NuiCallback.Use, { id, slot });
export const sendGive = (id: number, slot: number, count: number, target: number) =>
  postNui(NuiCallback.Give, { id, slot, count, target });
export const sendDrop = (id: number, slot: number, count: number) => postNui(NuiCallback.Drop, { id, slot, count });
export const sendBuy = (id: number, index: number, count: number) => postNui(NuiCallback.Buy, { id, index, count });
export const sendAttach = (id: number, weaponSlot: number, itemSlot: number) =>
  postNui(NuiCallback.Attach, { id, weaponSlot, itemSlot });
export const sendDetach = (id: number, slot: number, item: string) => postNui(NuiCallback.Detach, { id, slot, item });
export const sendReload = (id: number) => postNui(NuiCallback.Reload, { id });
export const sendUnload = (id: number) => postNui(NuiCallback.Unload, { id });
export const sendSound = (sound: Sound) => postNui(NuiCallback.Sound, { sound });
export const sendClothing = (id: number, piece: ClothingPiece) => postNui(NuiCallback.Clothing, { id, piece });
/** Slot 0 closes the wheel without using anything. */
export const sendWheelPick = (slot: number) => postNui(NuiCallback.WheelPick, { slot });

