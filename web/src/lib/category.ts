/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// One colour per item category, so a glance tells weapons, ammo, attachments and food apart. Owners set them through
// theme.colors. Class names are written out in full: Tailwind only keeps classes it finds as literals.

import { Apple, CircleDot, Crosshair, Package, Puzzle, Shirt, type LucideIcon } from "lucide-react";
import { Category, type Definition, type Item } from "@/types/protocol";

export interface Tone {
  icon: LucideIcon;
  /** Text and icon colour. */
  text: string;
  /** CSS variable holding the colour as an HSL triplet, for the fallback icon tile. */
  variable: string;
}

export const TONES: Record<Category, Tone> = {
  [Category.Weapon]: {
    icon: Crosshair,
    text: "text-weapon",
    variable: "--ug-weapon",
  },
  [Category.Ammo]: {
    icon: CircleDot,
    text: "text-ammo",
    variable: "--ug-ammo",
  },
  [Category.Attachment]: {
    icon: Puzzle,
    text: "text-attachment",
    variable: "--ug-attachment",
  },
  [Category.Consumable]: {
    icon: Apple,
    text: "text-consumable",
    variable: "--ug-consumable",
  },
  [Category.Clothing]: {
    icon: Shirt,
    text: "text-clothing",
    variable: "--ug-clothing",
  },
  [Category.Item]: {
    icon: Package,
    text: "text-item",
    variable: "--ug-item",
  },
};

/** An item's category: a weapon by its metadata, otherwise what its definition says. */
export function categoryOf(item: Pick<Item, "name" | "metadata">, definition: Definition | undefined): Category {
  if (item.metadata?.weapon) return Category.Weapon;

  return definition?.category ?? Category.Item;
}
