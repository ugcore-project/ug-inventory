/*

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

*/

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ItemIcon } from "@/components/ItemIcon";
import { shortCount } from "@/lib/format";
import { slotAt } from "@/lib/wheel";
import { hoverWheel, itemLabel, label, pickWheel, useInventory } from "@/store/inventoryStore";

const SIZE = 420;
const OUTER = 200;
const INNER = 78;
const GAP_DEGREES = 1.5;

function polar(radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;

  return [SIZE / 2 + radius * Math.cos(radians), SIZE / 2 + radius * Math.sin(radians)];
}

/** A ring segment from `start` to `end` degrees, clockwise from the top. */
function segment(start: number, end: number): string {
  const [ax, ay] = polar(OUTER, start);
  const [bx, by] = polar(OUTER, end);
  const [cx, cy] = polar(INNER, end);
  const [dx, dy] = polar(INNER, start);
  const large = end - start > 180 ? 1 : 0;

  return `M ${ax} ${ay} A ${OUTER} ${OUTER} 0 ${large} 1 ${bx} ${by} L ${cx} ${cy} A ${INNER} ${INNER} 0 ${large} 0 ${dx} ${dy} Z`;
}

/** The quick-use wheel, held open by a key. Releasing the key over a slot uses it; Lua asks through wheelClose. */
export function Wheel() {
  const wheel = useInventory((state) => state.wheel);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    if (!wheel) return;

    setHover(0);
    hoverWheel(0);

    const onMove = (event: PointerEvent) => {
      const slot = slotAt(event.clientX - window.innerWidth / 2, event.clientY - window.innerHeight / 2, wheel.slots);

      setHover(slot);
      hoverWheel(slot);
    };

    window.addEventListener("pointermove", onMove);

    return () => window.removeEventListener("pointermove", onMove);
  }, [wheel]);

  if (!wheel) return null;

  const step = 360 / wheel.slots;
  const hovered = hover ? wheel.items[hover] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-wheel onClick={() => pickWheel(hover)}>
      <motion.svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        initial={{ scale: 0.6, opacity: 0, rotate: -30 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
        className="drop-shadow-[0_10px_40px_rgb(0_0_0/0.6)]"
      >
        {Array.from({ length: wheel.slots }, (_, index) => {
          const slot = index + 1;
          const start = index * step + GAP_DEGREES;
          const end = (index + 1) * step - GAP_DEGREES;
          const [x, y] = polar((OUTER + INNER) / 2, index * step + step / 2);
          const item = wheel.items[slot];
          const active = hover === slot;

          return (
            <g key={slot} data-wheel-slot={slot}>
              <path
                d={segment(start, end)}
                fill={active ? "hsl(var(--ug-primary) / 0.55)" : "rgb(9 9 11 / 0.82)"}
                stroke={active ? "hsl(var(--ug-primary))" : "rgb(255 255 255 / 0.1)"}
                strokeWidth={active ? 2 : 1}
                className="transition-[fill] duration-100"
              />
              <foreignObject x={x - 32} y={y - 32} width={64} height={64} className="pointer-events-none">
                <div className={`relative size-16 transition-transform duration-150 ${active ? "scale-125" : ""}`}>
                  {item ? (
                    <ItemIcon name={item.name} weapon={item.metadata?.weapon !== undefined} className="size-full p-2" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-white/25">{label("empty")}</div>
                  )}
                  <span className="absolute left-0 top-0 text-[0.625rem] font-bold text-white/50">{slot}</span>
                  {item && item.count > 1 && (
                    <span className="absolute bottom-0 right-0 text-[0.625rem] font-semibold tabular-nums text-white">{shortCount(item.count)}</span>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={INNER - 8} fill="rgb(9 9 11 / 0.9)" stroke="rgb(255 255 255 / 0.08)" />
        <foreignObject x={SIZE / 2 - 60} y={SIZE / 2 - 30} width={120} height={60} className="pointer-events-none">
          <div className="flex size-full flex-col items-center justify-center text-center text-white">
            <span className="w-full truncate text-xs font-semibold">{hovered ? itemLabel(hovered) : ""}</span>
            <span className="text-[0.625rem] text-white/50">{label("wheelHint")}</span>
          </div>
        </foreignObject>
      </motion.svg>
    </div>
  );
}
