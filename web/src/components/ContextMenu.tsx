/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRightLeft, ChevronRight, Gift, Hand, Scissors, UserRound, Wrench } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { cn } from "@/lib/cn";
import {
  activate,
  amountOf,
  closeMenu,
  drop,
  give,
  inventoryOf,
  itemLabel,
  label,
  openAmount,
  openWorkbench,
  quickMove,
  useInventory,
} from "@/store/inventoryStore";
import { Kind, Side } from "@/types/protocol";

const WIDTH = 248;
// Grid columns for 1 to 3 quick actions. Written out: Tailwind only keeps classes it finds as literals.
const QUICK_COLUMNS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

interface QuickProps {
  action: string;
  icon: ReactNode;
  title: string;
  /** Colours of the button, enabled. */
  tone: string;
  disabled: boolean;
  active?: boolean;
  onSelect: () => void;
}

/** One of the three big actions at the top of the menu. */
function Quick({ action, icon, title, tone, disabled, active = false, onSelect }: QuickProps) {
  return (
    <button
      type="button"
      role="menuitem"
      data-quick={action}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[0.6875rem] font-medium transition",
        "disabled:cursor-not-allowed disabled:bg-white/[0.02] disabled:text-white/20",
        !disabled && tone,
        active && "ring-1 ring-inset ring-white/40",
      )}
    >
      {icon}
      {title}
    </button>
  );
}

function Entry({ entry, icon, children, onSelect }: { entry: string; icon: ReactNode; children: ReactNode; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      data-entry={entry}
      onClick={() => {
        closeMenu();
        onSelect();
      }}
      className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
    >
      <span className="text-white/35 transition-colors group-hover:text-white/70">{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Right-click actions for one stack: use, give and drop first, then the rest. Counts come from the quantity bar. */
export function ContextMenu() {
  const menu = useInventory((state) => state.menu);
  const item = useInventory((state) => (state.menu ? inventoryOf(state, state.menu.side)?.items[state.menu.slot] : undefined));
  const definition = useInventory((state) => (item ? state.definitions[item.name] : undefined));
  const nearby = useInventory((state) => state.nearby);
  const container = useInventory((state) => state.other !== null && state.other.kind !== Kind.Shop);
  const quantity = useInventory((state) => state.quantity);
  const giving = useInventory((state) => state.config.giving);
  const dropping = useInventory((state) => state.config.dropping);
  const workbench = useInventory((state) => state.config.workbench);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    setChoosing(false);

    if (!menu) return;

    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-menu]")) closeMenu();
    };

    window.addEventListener("pointerdown", onDown, true);

    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [menu]);

  if (!menu || !item) return null;

  const player = menu.side === Side.Player;
  const weapon = item.metadata?.weapon;
  const units = amountOf(item.count);
  const usable = player && (definition?.usable === true || weapon !== undefined);
  const left = Math.min(menu.x, window.innerWidth - WIDTH - 8);
  const top = Math.min(menu.y, window.innerHeight - (choosing ? 340 : 280));

  const giveTo = (target: number) => {
    closeMenu();
    give(item.slot, units, target);
  };

  return (
    <div
      role="menu"
      data-menu
      className="ug-panel ug-enter fixed z-50 flex flex-col gap-2 rounded-xl p-2"
      style={{ left, top, width: WIDTH }}
    >
      <div className="flex items-center gap-2.5 px-1 pt-0.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
          <ItemIcon name={item.name} weapon={weapon !== undefined} className="size-7" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-white">{itemLabel(item)}</span>
          <span className="text-[0.6875rem] tabular-nums text-white/50">
            {units < item.count ? `${units} / ${item.count}` : `x${item.count}`}
          </span>
        </span>
      </div>

      <div className={cn("grid gap-1.5", QUICK_COLUMNS[1 + Number(giving) + Number(dropping)])}>
        <Quick
          action="use"
          icon={<Hand className="size-4" />}
          title={label("use")}
          tone="bg-success/10 text-success hover:bg-success/20"
          disabled={!usable}
          onSelect={() => {
            closeMenu();
            activate(item.slot);
          }}
        />
        {giving && (
        <Quick
          action="give"
          icon={<Gift className="size-4" />}
          title={label("give")}
          tone="bg-accent/10 text-accent hover:bg-accent/20"
          disabled={!player || nearby.length === 0}
          active={choosing}
          onSelect={() => {
            const only = nearby[0];

            if (nearby.length === 1 && only) giveTo(only.id);
            else setChoosing(!choosing);
          }}
        />
        )}
        {dropping && (
        <Quick
          action="drop"
          icon={<ArrowDownToLine className="size-4" />}
          title={label("drop")}
          tone="bg-destructive/10 text-destructive hover:bg-destructive/20"
          disabled={!player}
          onSelect={() => {
            closeMenu();
            drop(item.slot, units);
          }}
        />
        )}
      </div>

      {giving && player && nearby.length === 0 && <p className="px-1 text-[0.625rem] text-white/35">{label("nobodyNearby")}</p>}

      {choosing && (
        <div data-give-list className="ug-enter flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-lg bg-white/[0.04] p-1">
          {nearby.map((target) => (
            <button
              key={target.id}
              type="button"
              role="menuitem"
              data-give-target={target.id}
              onClick={() => giveTo(target.id)}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/85 transition hover:bg-accent/20 hover:text-white"
            >
              <UserRound className="size-3.5 text-accent" />
              <span className="flex-1 truncate">{target.name}</span>
              <span className="text-[0.625rem] tabular-nums text-white/40">#{target.id}</span>
              <ChevronRight className="size-3 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </button>
          ))}
        </div>
      )}

      {((weapon !== undefined && workbench) || container || item.count > 1) && <div className="h-px bg-white/[0.07]" />}

      <div className="flex flex-col">
        {player && weapon && workbench && (
          <Entry entry="inspect" icon={<Wrench className="size-3.5" />} onSelect={() => openWorkbench(item.slot)}>
            {label("inspect")}
          </Entry>
        )}
        {container && (
          <Entry entry="move" icon={<ArrowRightLeft className="size-3.5" />} onSelect={() => quickMove(menu.side, item.slot, quantity > 0 ? units : undefined)}>
            {label("moveAll")} · {units}
          </Entry>
        )}
        {item.count > 1 && (
          <Entry
            entry="split"
            icon={<Scissors className="size-3.5" />}
            onSelect={() => openAmount({ action: { kind: "split", side: menu.side, slot: item.slot }, name: item.name, max: item.count - 1 })}
          >
            {label("split")}
          </Entry>
        )}
      </div>
    </div>
  );
}
