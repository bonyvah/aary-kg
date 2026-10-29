"use client";

import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { cx } from "@/lib/cx";
import type { ImageFrameAt } from "@/lib/api/images";

type ImageCropperProps = {
  /** The picked file, before upload (an object URL). Null while it is being made: the empty frame. */
  src: string | null;
  at: ImageFrameAt;
  onMove: (at: ImageFrameAt) => void;
  /** Translated name of the frame, for screen readers. */
  label: string;
  className?: string;
};

// One arrow key press moves the window this far.
const STEP = 0.05;
const RATIO = 16 / 9;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The whole picked picture with a bright 16:9 window on it: what stays. The rest is dimmed. Dragging
 * the window (or the arrow keys) moves it: left and right on a wide picture, up and down on a tall one.
 */
export function ImageCropper({ src, at, onMove, label, className }: ImageCropperProps) {
  const picture = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ pointer: number; startX: number; startY: number; from: ImageFrameAt } | null>(null);

  // The window's size, as a share of the picture: full along one side, cut along the other.
  const wide = natural ? natural.width / natural.height > RATIO : false;
  const share = natural ? (wide ? (natural.height * RATIO) / natural.width : natural.width / RATIO / natural.height) : 1;
  const free = { x: wide ? 1 - share : 0, y: wide ? 0 : 1 - share };

  function move(next: ImageFrameAt) {
    onMove({ x: free.x > 0 ? clamp(next.x) : at.x, y: free.y > 0 ? clamp(next.y) : at.y });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, from: at };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    const box = picture.current?.getBoundingClientRect();
    if (!current || current.pointer !== event.pointerId || !box) return;
    // The window follows the pointer over the room it has left to move in.
    move({
      x: free.x > 0 ? current.from.x + (event.clientX - current.startX) / (box.width * free.x) : at.x,
      y: free.y > 0 ? current.from.y + (event.clientY - current.startY) / (box.height * free.y) : at.y,
    });
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, ImageFrameAt> = {
      ArrowLeft: { x: at.x - STEP, y: at.y },
      ArrowRight: { x: at.x + STEP, y: at.y },
      ArrowUp: { x: at.x, y: at.y - STEP },
      ArrowDown: { x: at.x, y: at.y + STEP },
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    move(next);
  }

  const windowVars = {
    "--left": `${at.x * free.x * 100}%`,
    "--top": `${at.y * free.y * 100}%`,
    "--width": `${wide ? share * 100 : 100}%`,
    "--height": `${wide ? 100 : share * 100}%`,
  } as CSSProperties;

  return (
    <div className={cx("flex justify-center overflow-hidden bg-brand-dark", className)}>
      <div ref={picture} className="relative overflow-hidden select-none">
        {src ? (
          // A local object URL, not a bucket file: nothing for Next's image optimizer to do.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(event) =>
              setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
            }
            className="block h-auto max-h-[60dvh] w-auto max-w-full"
          />
        ) : (
          <div className="aspect-video w-[360px] max-w-full" />
        )}
        {natural ? (
          <div
            role="img"
            aria-label={label}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleKeyDown}
            style={windowVars}
            className={cx(
              "absolute top-(--top) left-(--left) h-(--height) w-(--width) touch-none border-2 border-ink",
              // Everything around the window is dimmed: the spread covers the rest of the picture.
              "shadow-[0_0_0_100vmax_color-mix(in_oklab,var(--color-brand-dark)_65%,transparent)]",
              free.x > 0 || free.y > 0 ? "cursor-move" : "",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
