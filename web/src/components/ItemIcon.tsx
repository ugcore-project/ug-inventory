/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { useState } from "react";
import { TONES } from "@/lib/category";
import { cn } from "@/lib/cn";
import { useInventory } from "@/store/inventoryStore";
import { Category } from "@/types/protocol";

// Item images are in the resource's images folder, next to web/dist. Owners add PNG or WebP files.
const IMAGE_ROOT = "../../images/";
const EXTENSIONS = ["png", "webp"];
// Names that failed every extension, so a missing image is asked for once per page load.
const missing = new Set<string>();

interface ItemIconProps {
  name: string;
  /** Shows the weapon colour, whatever the definition says. */
  weapon?: boolean;
  className?: string;
}

/** The item's image, or an icon on a tinted tile when the owner did not add one. */
export function ItemIcon({ name, weapon = false, className }: ItemIconProps) {
  const [attempt, setAttempt] = useState(0);
  const defined = useInventory((state) => state.definitions[name]?.category);
  // Definitions arrive with the first open: before that, weapon names still read as weapons.
  const category = weapon ? Category.Weapon : (defined ?? (name.startsWith("weapon_") ? Category.Weapon : Category.Item));
  const failed = missing.has(name) || attempt >= EXTENSIONS.length;

  if (failed) {
    const tone = TONES[category];
    const Icon = tone.icon;

    return (
      <div
        className={cn("flex items-center justify-center rounded-md", className)}
        style={{ background: `radial-gradient(circle at 50% 40%, hsl(var(${tone.variable}) / 0.35), transparent 70%)` }}
      >
        <Icon className={cn("size-1/2 drop-shadow-[0_2px_6px_rgb(0_0_0/0.6)]", tone.text)} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={`${IMAGE_ROOT}${name}.${EXTENSIONS[attempt]}`}
      alt=""
      draggable={false}
      className={cn("object-contain drop-shadow-[0_4px_6px_rgb(0_0_0/0.5)]", className)}
      onError={() => {
        if (attempt + 1 >= EXTENSIONS.length) missing.add(name);

        setAttempt(attempt + 1);
      }}
    />
  );
}
