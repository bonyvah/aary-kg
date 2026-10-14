import type { ReactNode } from "react";
import type { Face } from "./characters";

// Faces are drawn around (0, 0), about 20 wide, with round eyes and 2.5px rounded strokes.
// Everything uses currentColor, so the color token of the body decides the face tone.

function Eye({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="currentColor" />;
}

function Line({ d }: { d: string }) {
  return (
    <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  );
}

function Solid({ d }: { d: string }) {
  return <path d={d} fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />;
}

function StarEye({ x, y }: { x: number; y: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? 4.2 : 1.8;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(x + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
  return <polygon points={points} fill="currentColor" stroke="currentColor" strokeWidth={0.8} strokeLinejoin="round" />;
}

export const faces: Record<Face, ReactNode> = {
  smile: (
    <>
      <Eye x={-6} y={-2} />
      <Eye x={6} y={-2} />
      <Line d="M-5 4Q0 9 5 4" />
    </>
  ),
  grin: (
    <>
      <Eye x={-6} y={-2} />
      <Eye x={6} y={-2} />
      <Solid d="M-6 3Q0 13 6 3Z" />
    </>
  ),
  wink: (
    <>
      <Eye x={-6} y={-2} />
      <Line d="M3.5 -1Q6 -4.5 8.5 -1" />
      <Line d="M-4 5Q1 9 6 4" />
    </>
  ),
  surprised: (
    <>
      <Eye x={-6} y={-3} r={3.2} />
      <Eye x={6} y={-3} r={3.2} />
      <Eye x={0} y={7} r={3.2} />
    </>
  ),
  glasses: (
    <>
      <circle cx={-6.5} cy={-2} r={4.5} fill="none" stroke="currentColor" strokeWidth={2.5} />
      <circle cx={6.5} cy={-2} r={4.5} fill="none" stroke="currentColor" strokeWidth={2.5} />
      <Line d="M-2 -2H2" />
      <Eye x={-6.5} y={-2} r={1.6} />
      <Eye x={6.5} y={-2} r={1.6} />
      <Line d="M-4 7Q0 10 4 7" />
    </>
  ),
  sleepy: (
    <>
      <Line d="M-9 -2Q-6 1.5 -3 -2" />
      <Line d="M3 -2Q6 1.5 9 -2" />
      <circle cx={0} cy={6.5} r={2} fill="none" stroke="currentColor" strokeWidth={2.5} />
    </>
  ),
  cool: (
    <>
      <Eye x={-6} y={-2} />
      <Eye x={6} y={-2} />
      <Line d="M-4.5 6H4.5" />
    </>
  ),
  happy: (
    <>
      <Line d="M-9 0Q-6 -4.5 -3 0" />
      <Line d="M3 0Q6 -4.5 9 0" />
      <Solid d="M-6 4Q0 12 6 4Z" />
    </>
  ),
  tongue: (
    <>
      <Eye x={-6} y={-2} />
      <Eye x={6} y={-2} />
      <Line d="M-6 4Q0 9 6 4" />
      <Line d="M-2.5 7.5V11A2.5 2.5 0 0 0 2.5 11V7.5" />
    </>
  ),
  angry: (
    <>
      <Line d="M-9.5 -7.5L-3.5 -4.5" />
      <Line d="M9.5 -7.5L3.5 -4.5" />
      <Eye x={-6} y={-1} />
      <Eye x={6} y={-1} />
      <Line d="M-4 7.5Q0 4.5 4 7.5" />
    </>
  ),
  stars: (
    <>
      <StarEye x={-6} y={-2} />
      <StarEye x={6} y={-2} />
      <Line d="M-5 5Q0 10 5 5" />
    </>
  ),
  shy: (
    <>
      <Eye x={-6} y={-2} />
      <Eye x={6} y={-2} />
      <Line d="M-3 6.5Q0 8.5 3 6.5" />
      <ellipse cx={-9.5} cy={4} rx={2.6} ry={1.6} fill="none" stroke="currentColor" strokeWidth={1.8} />
      <ellipse cx={9.5} cy={4} rx={2.6} ry={1.6} fill="none" stroke="currentColor" strokeWidth={1.8} />
    </>
  ),
};
