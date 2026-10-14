import { cx } from "@/lib/cx";
import { colorClasses } from "./avatar/colors";
import type { Character } from "./avatar/characters";
import { faces } from "./avatar/faces";
import { shapes } from "./avatar/shapes";

export type AvatarSize = "default" | "lg" | "xl";

const sizes: Record<AvatarSize, string> = {
  default: "size-10",
  lg: "size-[64px]",
  xl: "size-[96px]",
};

type AvatarProps = {
  /** Shape, color and face of the player. Random after the nickname, changeable in the lobby. */
  character: Character;
  size?: AvatarSize;
  className?: string;
};

/** Decorative: always render the nickname next to it. */
export function Avatar({ character, size = "default", className }: AvatarProps) {
  const { body, anchor } = shapes[character.shape];
  const tone = colorClasses[character.color];

  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cx("block flex-none", sizes[size], className)}
    >
      <g className={tone.body} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {body}
      </g>
      <g className={tone.face} transform={`translate(${anchor.x} ${anchor.y}) scale(${anchor.scale})`}>
        {faces[character.face]}
      </g>
    </svg>
  );
}

const initialTones = {
  blue: "bg-tile-blue text-on-tile",
  red: "bg-tile-red text-on-tile",
  yellow: "bg-tile-yellow text-on-tile-yellow",
  green: "bg-tile-green text-on-tile",
} as const;

type AvatarInitialProps = {
  name: string;
  tone?: keyof typeof initialTones;
  className?: string;
};

/** Staff lists (admins, users, juries): an initial in a circle. */
export function AvatarInitial({ name, tone = "blue", className }: AvatarInitialProps) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-10 flex-none place-items-center rounded-full text-body-lg font-black",
        initialTones[tone],
        className,
      )}
    >
      {initial}
    </span>
  );
}
