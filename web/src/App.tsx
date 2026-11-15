/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { lazy, Suspense, useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { Hotbar } from "@/components/Hotbar";
import { Inventory } from "@/components/Inventory";
import { Toasts } from "@/components/Toasts";
import { Wheel } from "@/components/Wheel";
import { isEnvBrowser, sendReady } from "@/lib/nui";
import { installMessages, useInventory } from "@/store/inventoryStore";

// Dev and showcase builds only: removed from production builds.
const Preview = import.meta.env.DEV || import.meta.env.MODE === "showcase" ? lazy(() => import("@/dev/Preview")) : null;

export default function App() {
  useEffect(() => {
    const uninstall = installMessages();

    // Lua queues messages until the page says it listens.
    void sendReady();

    return uninstall;
  }, []);

  const animations = useInventory((state) => state.config.layout.animations);

  return (
    <MotionConfig reducedMotion={animations ? "user" : "always"}>
      <Inventory />
      <Hotbar />
      <Wheel />
      <Toasts />
      {Preview && isEnvBrowser() && (
        <Suspense fallback={null}>
          <Preview />
        </Suspense>
      )}
    </MotionConfig>
  );
}
