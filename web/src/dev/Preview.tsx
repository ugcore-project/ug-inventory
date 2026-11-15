/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// Dev and showcase builds only: a stand-in for the game, and buttons that play the scenes of scenes.ts.
// `?scene=<id>` plays one on load, `?clean` hides the buttons. `npm run capture` drives it through window.__showcase.

import english from "../../../locales/en.json?raw";
import { playScene, SCENES, type Area } from "@/dev/scenes";
import { handleMessage } from "@/store/inventoryStore";
import { NuiAction, type NuiMessage } from "@/types/protocol";

const send = (message: NuiMessage) => handleMessage(message);

const page = (JSON.parse(english) as { page: Record<string, unknown> }).page;

const BASE_CONFIG = { labels: page, locale: "en", hotbar: 5, wheel: 8, toasts: true, openKey: "TAB" };

send({ action: NuiAction.Config, payload: BASE_CONFIG });

// An in-game screenshot without HUD, saved as src/dev/backdrop.jpg (or .png, .webp), replaces the gradient.
const BACKDROPS = import.meta.glob<string>("./backdrop.{jpg,png,webp}", { eager: true, query: "?url", import: "default" });
const backdrop = Object.values(BACKDROPS)[0];

const params = new URLSearchParams(window.location.search);
const clean = params.has("clean");

declare global {
  interface Window {
    __showcase?: {
      scenes: { id: string; animated: boolean; crop: string | null }[];
      /** Plays a scene. Resolves with the area to crop to, null for the whole screen, undefined for an unknown id. */
      play: (id: string) => Promise<Area | null | undefined>;
      /** Sends the page config again with owner values on top, such as `{ layout: { pockets: "right" } }`. */
      configure: (overrides: Record<string, unknown>) => void;
    };
  }
}

window.__showcase = {
  scenes: SCENES.map((scene) => ({ id: scene.id, animated: scene.animated === true, crop: scene.crop ?? null })),
  play: async (id) => {
    const scene = SCENES.find((entry) => entry.id === id);

    return scene ? playScene(scene, send) : undefined;
  },
  configure: (overrides) => send({ action: NuiAction.Config, payload: { ...BASE_CONFIG, ...overrides } }),
};

const initial = params.get("scene");

if (initial) {
  void window.__showcase.play(initial);
}

export default function Preview() {
  return (
    <>
      {/* The game would be behind the page. */}
      {backdrop ? (
        <img src={backdrop} alt="" className="fixed inset-0 -z-10 size-full object-cover" />
      ) : (
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,#475569,#1e293b_55%,#020617)]">
          {/* Where the character would stand. */}
          <div className="absolute bottom-[22%] left-1/2 h-[52%] w-28 -translate-x-1/2 rounded-t-full bg-gradient-to-b from-slate-500/60 to-slate-700/40 blur-[2px]" />
        </div>
      )}
      {!clean && (
        <div className="fixed bottom-4 left-4 z-[70] flex flex-col gap-2">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className="rounded-md bg-black/60 px-3 py-1.5 text-left text-xs text-white hover:bg-black/80"
              onClick={() => void playScene(scene, send)}
            >
              {scene.title}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md bg-black/60 px-3 py-1.5 text-left text-xs text-white hover:bg-black/80"
            onClick={() => send({ action: NuiAction.Close })}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
