import type { ButtonHTMLAttributes } from "react";
import { AnswerCircle, AnswerDiamond, AnswerSquare, AnswerTriangle, Check, Cross } from "@/components/icons";
import { cx } from "@/lib/cx";

export type AnswerPosition = 1 | 2 | 3 | 4;

const positions = {
  1: { Shape: AnswerTriangle, tone: "bg-tile-red text-on-tile [--tile-e:var(--tile-red-edge)]" },
  2: { Shape: AnswerDiamond, tone: "bg-tile-blue text-on-tile [--tile-e:var(--tile-blue-edge)]" },
  3: { Shape: AnswerCircle, tone: "bg-tile-yellow text-on-tile-yellow [--tile-e:var(--tile-yellow-edge)]" },
  4: { Shape: AnswerSquare, tone: "bg-tile-green text-on-tile [--tile-e:var(--tile-green-edge)]" },
} as const;

type AnswerTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
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

export function AnswerTile({
  position,
  pressed = false,
  dim = false,
  result,
  resultLabel,
  type = "button",
  className,
  children,
  ...rest
}: AnswerTileProps) {
  const { Shape, tone } = positions[position];

  return (
    <button
      type={type}
      aria-pressed={pressed}
      disabled={dim || rest.disabled}
      className={cx(
        "flex min-h-[96px] w-full items-center gap-4 rounded-md px-6 py-4 text-left text-h2 font-black",
        "[overflow-wrap:anywhere]",
        dim
          ? "cursor-default bg-disabled text-on-disabled"
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
      {...rest}
    >
      <Shape className="size-10 flex-none" />
      <span className="min-w-0">{children}</span>
      {result ? (
        <span
          role="img"
          aria-label={resultLabel}
          className={cx(
            "ml-auto grid size-10 flex-none place-items-center rounded-full bg-on-tile",
            result === "ok" ? "text-tile-green-edge" : "text-danger-edge",
          )}
        >
          {result === "ok" ? <Check width={28} height={28} /> : <Cross width={28} height={28} />}
        </span>
      ) : null}
    </button>
  );
}
