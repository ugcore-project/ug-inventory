/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

/** Fills `{name}` placeholders, like ug-lib's locale. Unknown placeholders stay as they are. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Money in the player's locale, without decimals. */
export function money(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

/** Grams as kilograms with at most one decimal: `1.5`, `12`. */
export function kilograms(grams: number): string {
  const value = Math.round(grams / 100) / 10;

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** A count as a stack badge: `999`, `1.2k`, `15k`. */
export function shortCount(count: number): string {
  if (count < 1000) {
    return String(count);
  }

  const thousands = count / 1000;

  return `${thousands < 10 ? Math.floor(thousands * 10) / 10 : Math.floor(thousands)}k`;
}


/** A metadata key as words, when no label names it: `plateNumber` or `plate_number` becomes `Plate number`. */
export function humanize(key: string): string {
  const words = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The units an action takes from a stack: the chosen quantity, or the whole stack for 0. Never more than the stack. */
export function unitsOf(count: number, quantity: number): number {
  return quantity > 0 ? Math.min(quantity, count) : count;
}
