import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type AvatarId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AvatarSize = "default" | "lg" | "xl";

const sizes: Record<AvatarSize, string> = {
  default: "size-10",
  lg: "size-[64px]",
  xl: "size-[96px]",
};

type Body = "red" | "yellow" | "blue" | "green";

const bodyClass: Record<Body, string> = {
  red: "fill-tile-red stroke-tile-red-edge",
  yellow: "fill-tile-yellow stroke-tile-yellow-edge",
  blue: "fill-tile-blue stroke-tile-blue-edge",
  green: "fill-tile-green stroke-tile-green-edge",
};

// Faces use on-tile, and on-tile-yellow on yellow bodies.
function faceTone(body: Body) {
  return body === "yellow"
    ? { eye: "fill-on-tile-yellow", line: "stroke-on-tile-yellow" }
    : { eye: "fill-on-tile", line: "stroke-on-tile" };
}

type Face = { eye: string; line: string };

function Eye({ cx: x, cy: y, r, face }: { cx: number; cy: number; r: number; face: Face }) {
  return <circle cx={x} cy={y} r={r} className={cx(face.eye, "stroke-none")} />;
}

function Line({ d, face }: { d: string; face: Face }) {
  return (
    <path
      d={d}
      className={cx("fill-none", face.line)}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Body({ tone, children }: { tone: Body; children: ReactNode }) {
  return (
    <g className={bodyClass[tone]} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
  );
}

const TRIANGLE = "M24 10 44 42H4Z";
const DIAMOND = "M24 3 45 24 24 45 3 24Z";

// The eight characters from design-system/components/Avatar/avatars.svg, ids 0-7 in that order.
const characters: Record<AvatarId, () => ReactNode> = {
  0: () => {
    const face = faceTone("red");
    return (
      <>
        <Body tone="red">
          <path d={TRIANGLE} />
          <path d="M24 10V4" />
          <circle cx={24} cy={4} r={2.5} />
        </Body>
        <Eye cx={18} cy={31} r={2.6} face={face} />
        <Eye cx={30} cy={31} r={2.6} face={face} />
        <Line d="M19 36Q24 40 29 36" face={face} />
      </>
    );
  },
  1: () => {
    const face = faceTone("yellow");
    return (
      <>
        <Body tone="yellow">
          <path d={TRIANGLE} />
        </Body>
        <Eye cx={18} cy={31} r={2.6} face={face} />
        <Line d="M27.5 32Q30 29 32.5 32" face={face} />
        <Line d="M20 37Q25 40 29 36" face={face} />
      </>
    );
  },
  2: () => {
    const face = faceTone("blue");
    return (
      <>
        <Body tone="blue">
          <path d={DIAMOND} />
        </Body>
        <Eye cx={18} cy={21} r={2.6} face={face} />
        <Eye cx={30} cy={21} r={2.6} face={face} />
        <path d="M19.5 28Q24 36 28.5 28Z" className={cx(face.eye, "stroke-none")} />
      </>
    );
  },
  3: () => {
    const face = faceTone("green");
    return (
      <>
        <Body tone="green">
          <path d={DIAMOND} />
        </Body>
        <Line d="M15.5 23Q18 19.5 20.5 23" face={face} />
        <Line d="M27.5 23Q30 19.5 32.5 23" face={face} />
        <Line d="M18.5 28Q24 34 29.5 28" face={face} />
      </>
    );
  },
  4: () => {
    const face = faceTone("yellow");
    return (
      <>
        <Body tone="yellow">
          <circle cx={11} cy={13} r={6} />
          <circle cx={37} cy={13} r={6} />
          <circle cx={24} cy={26} r={17} />
        </Body>
        <Eye cx={18} cy={24} r={2.6} face={face} />
        <Eye cx={30} cy={24} r={2.6} face={face} />
        <Line d="M19 31Q24 36 29 31" face={face} />
      </>
    );
  },
  5: () => {
    const face = faceTone("red");
    return (
      <>
        <Body tone="red">
          <circle cx={24} cy={25} r={18} />
        </Body>
        <Eye cx={17.5} cy={22} r={3.2} face={face} />
        <Eye cx={30.5} cy={22} r={3.2} face={face} />
        <Eye cx={24} cy={32} r={3.4} face={face} />
      </>
    );
  },
  6: () => {
    const face = faceTone("green");
    return (
      <>
        <Body tone="green">
          <path d="M19 10 24 3 29 10Z" />
          <rect x={6} y={10} width={36} height={34} rx={6} />
        </Body>
        <Eye cx={17} cy={26} r={2.6} face={face} />
        <Eye cx={31} cy={26} r={2.6} face={face} />
        <Line d="M18 33Q24 38 30 33" face={face} />
      </>
    );
  },
  7: () => {
    const face = faceTone("blue");
    return (
      <>
        <Body tone="blue">
          <rect x={6} y={8} width={36} height={36} rx={6} />
        </Body>
        <circle cx={17} cy={25} r={5.5} className={cx("fill-none", face.line)} strokeWidth={2.5} />
        <circle cx={31} cy={25} r={5.5} className={cx("fill-none", face.line)} strokeWidth={2.5} />
        <Line d="M22.5 25H25.5" face={face} />
        <Eye cx={17} cy={25} r={1.8} face={face} />
        <Eye cx={31} cy={25} r={1.8} face={face} />
        <Line d="M20 35Q24 38 28 35" face={face} />
      </>
    );
  },
};

type AvatarProps = {
  /** Character id 0-7, assigned by the server or picked on the join screen. */
  avatar: AvatarId;
  size?: AvatarSize;
  className?: string;
};

/** Decorative: always render the nickname next to it. */
export function Avatar({ avatar, size = "default", className }: AvatarProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cx("block flex-none", sizes[size], className)}
    >
      {characters[avatar]()}
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
