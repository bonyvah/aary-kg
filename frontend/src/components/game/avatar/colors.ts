import type { Color } from "./characters";

// Full class names on purpose: Tailwind only generates classes it can read in the source.
// Body fill, 3px outline in the darker edge color, and the face tone (dark on the light bodies).
export const colorClasses: Record<Color, { body: string; face: string; swatch: string }> = {
  red: { body: "fill-avatar-red stroke-avatar-red-edge", swatch: "bg-avatar-red border-avatar-red-edge", face: "text-on-avatar" },
  blue: { body: "fill-avatar-blue stroke-avatar-blue-edge", swatch: "bg-avatar-blue border-avatar-blue-edge", face: "text-on-avatar" },
  yellow: { body: "fill-avatar-yellow stroke-avatar-yellow-edge", swatch: "bg-avatar-yellow border-avatar-yellow-edge", face: "text-on-avatar-dark" },
  green: { body: "fill-avatar-green stroke-avatar-green-edge", swatch: "bg-avatar-green border-avatar-green-edge", face: "text-on-avatar" },
  orange: { body: "fill-avatar-orange stroke-avatar-orange-edge", swatch: "bg-avatar-orange border-avatar-orange-edge", face: "text-on-avatar-dark" },
  purple: { body: "fill-avatar-purple stroke-avatar-purple-edge", swatch: "bg-avatar-purple border-avatar-purple-edge", face: "text-on-avatar-dark" },
  pink: { body: "fill-avatar-pink stroke-avatar-pink-edge", swatch: "bg-avatar-pink border-avatar-pink-edge", face: "text-on-avatar-dark" },
  teal: { body: "fill-avatar-teal stroke-avatar-teal-edge", swatch: "bg-avatar-teal border-avatar-teal-edge", face: "text-on-avatar-dark" },
};
