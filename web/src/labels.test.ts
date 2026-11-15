/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

// Every label the page asks for exists in English, so no screen ever shows a raw key.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { flattenLabels } from "@/lib/labels";
import { Filter } from "@/store/inventoryStore";
import { Kind } from "@/types/protocol";

const SOURCE = path.resolve(import.meta.dirname);

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) return entry === "dev" ? [] : sources(full);

    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const english = flattenLabels((JSON.parse(readFileSync("../locales/en.json", "utf8")) as { page: Record<string, unknown> }).page);

it("has every label key the page uses", () => {
  const used = new Set<string>();

  for (const file of sources(SOURCE)) {
    for (const match of readFileSync(file, "utf8").matchAll(/\blabel\("([\w.]+)"/g)) {
      used.add(match[1] as string);
    }
  }

  for (const filter of Object.values(Filter)) used.add(`filter.${filter}`);
  for (const kind of Object.values(Kind)) used.add(`kind.${kind}`);

  expect(used.size).toBeGreaterThan(20);

  for (const key of used) {
    expect(english[key], key).toBeTypeOf("string");
  }
});
