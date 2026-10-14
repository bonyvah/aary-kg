import type { ReactNode } from "react";
import type { Shape } from "./characters";

/** Where the face is centered on the 48x48 grid, and how much it shrinks to fit the shape. */
export type FaceAnchor = { x: number; y: number; scale: number };

function polygon(points: ReadonlyArray<readonly [number, number]>): string {
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}Z`;
}

function starPoints(cx: number, cy: number, outer: number, inner: number): Array<[number, number]> {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

const HEXAGON = polygon([
  [44, 24],
  [34, 41.3],
  [14, 41.3],
  [4, 24],
  [14, 6.7],
  [34, 6.7],
]);

const STAR = polygon(starPoints(24, 26, 22, 13.5));

const HEART =
  "M24 42C8 30 4 22 4 15C4 9 8 5 13 5C18 5 22 8 24 12C26 8 30 5 35 5C40 5 44 9 44 15C44 22 40 30 24 42Z";

// Eight bodies on a 48x48 grid. They are drawn inside a 3px outline, so keep 2px from the edge.
export const shapes: Record<Shape, { body: ReactNode; anchor: FaceAnchor }> = {
  triangle: { body: <path d="M24 10 44 42H4Z" />, anchor: { x: 24, y: 31, scale: 1 } },
  diamond: { body: <path d="M24 3 45 24 24 45 3 24Z" />, anchor: { x: 24, y: 24, scale: 1 } },
  circle: { body: <circle cx={24} cy={25} r={18} />, anchor: { x: 24, y: 25, scale: 1 } },
  square: { body: <rect x={6} y={8} width={36} height={36} rx={6} />, anchor: { x: 24, y: 26, scale: 1 } },
  hexagon: { body: <path d={HEXAGON} />, anchor: { x: 24, y: 24, scale: 1 } },
  star: { body: <path d={STAR} />, anchor: { x: 24, y: 28, scale: 0.85 } },
  heart: { body: <path d={HEART} />, anchor: { x: 24, y: 22, scale: 0.9 } },
  pill: { body: <rect x={11} y={4} width={26} height={40} rx={13} />, anchor: { x: 24, y: 24, scale: 0.9 } },
};
