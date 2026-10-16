import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AnswerCircle, AnswerDiamond, AnswerSquare, AnswerTriangle, Check, Cross } from "@/components/icons";
import { cx } from "@/lib/cx";

export type AnswerPosition = 1 | 2 | 3 | 4;

/** In a two-column grid with an odd number of tiles, the last one takes the whole row. */
export const lastTileSpan = (index: number, count: number) => (count % 2 === 1 && index === count - 1 ? "col-span-2" : "");

/** Color, shape and edge of the four answer positions. Also used by the quiz editor. */
export const answerPositions = {
  1: { Shape: AnswerTriangle, tone: "bg-tile-red text-on-tile [--tile-e:var(--tile-red-edge)]" },
  2: { Shape: AnswerDiamond, tone: "bg-tile-blue text-on-tile [--tile-e:var(--tile-blue-edge)]" },
  3: { Shape: AnswerCircle, tone: "bg-tile-yellow text-on-tile-yellow [--tile-e:var(--tile-yellow-edge)]" },
  4: { Shape: AnswerSquare, tone: "bg-tile-green text-on-tile [--tile-e:var(--tile-green-edge)]" },
} as const;

type AnswerTileBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed" | "children"> & {
  /** 1 red triangle, 2 blue diamond, 3 yellow circle, 4 green square. */
  position: AnswerPosition;
  /** The player locked this answer. */
  pressed?: boolean;
  /** After the reveal: an answer that is not the right one. */
  dim?: boolean;
  /** After the reveal: check on the right answer, cross on a wrong chosen one. */
  result?: "ok" | "no";
  /** Translated text for the result mark, e.g. «Туура!» or «Туура эмес». */
  resultLabel?: string;
};

type AnswerTileProps =
  | (AnswerTileBase & { shapeOnly?: false; children: ReactNode })
  /** Player phone: only the shape on the color, the answer text is read on the host screen. */
  | (AnswerTileBase & { shapeOnly: true; "aria-label": string });

export function AnswerTile(props: AnswerTileProps) {
  const {
    position,
    pressed = false,
    dim = false,
    result,
    resultLabel,
    type = "button",
    className,
    shapeOnly = false,
    ...rest
  } = props;
  // `children` only exists on the text variant; the shapes-only variant has none.
  const { children, ...buttonProps } = rest as typeof rest & { children?: ReactNode };
  const { Shape, tone } = answerPositions[position];

  return (
    <button
      type={type}
      aria-pressed={pressed}
      disabled={dim || buttonProps.disabled}
      className={cx(
        "flex w-full items-center gap-4 rounded-md text-left text-h2 font-black [overflow-wrap:anywhere]",
        shapeOnly ? "relative min-h-[140px] justify-center p-4" : "min-h-[96px] px-6 py-4",
        dim
          ? cx(tone, "cursor-default opacity-50 shadow-[0_6px_0_0_var(--tile-e)]")
          : cx(
              tone,
              "cursor-pointer shadow-[0_6px_0_0_var(--tile-e)] transition-[transform,box-shadow] duration-150 ease-out",
              "hover:-translate-y-px hover:shadow-[0_7px_0_0_var(--tile-e)]",
              "active:translate-y-[6px] active:shadow-[0_0_0_0_var(--tile-e)]",
            ),
        "focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-focus-ring",
        "aria-pressed:outline-4 aria-pressed:outline-offset-4 aria-pressed:outline-focus-ring",
        className,
      )}
      {...buttonProps}
    >
      <Shape className={shapeOnly ? "size-[64px] flex-none" : "size-10 flex-none"} />
      {shapeOnly ? null : <span className="min-w-0">{children}</span>}
      {result ? (
        <span
          role="img"
          aria-label={resultLabel}
          className={cx(
            "grid size-10 flex-none place-items-center rounded-full bg-on-tile",
            shapeOnly ? "absolute top-2 right-2" : "ml-auto",
            result === "ok" ? "text-tile-green-edge" : "text-danger-edge",
          )}
        >
          {result === "ok" ? <Check width={28} height={28} /> : <Cross width={28} height={28} />}
        </span>
      ) : null}
    </button>
  );
}
