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

// One arrow key press moves the cut this far.
const STEP = 0.05;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The picked picture filling the same 16:9 frame that will show it. Dragging it (or the arrow keys)
 * chooses which part stays: left and right on a wide picture, up and down on a tall one.
 */
export function ImageCropper({ src, at, onMove, label, className }: ImageCropperProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ pointer: number; startX: number; startY: number; from: ImageFrameAt } | null>(null);

  /** How many pixels the picture sticks out of the frame, across and down. */
  function overflow() {
    const box = frame.current?.getBoundingClientRect();
    if (!box || !natural) return { x: 0, y: 0 };
    const scale = Math.max(box.width / natural.width, box.height / natural.height);
    return { x: natural.width * scale - box.width, y: natural.height * scale - box.height };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, from: at };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const out = overflow();
    // Dragging the picture right brings its left side in: the cut moves left.
    onMove({
      x: out.x > 1 ? clamp(current.from.x - (event.clientX - current.startX) / out.x) : at.x,
      y: out.y > 1 ? clamp(current.from.y - (event.clientY - current.startY) / out.y) : at.y,
    });
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const out = overflow();
    const moves: Record<string, ImageFrameAt> = {
      ArrowLeft: { x: at.x - STEP, y: at.y },
      ArrowRight: { x: at.x + STEP, y: at.y },
      ArrowUp: { x: at.x, y: at.y - STEP },
      ArrowDown: { x: at.x, y: at.y + STEP },
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    onMove({ x: out.x > 1 ? clamp(next.x) : at.x, y: out.y > 1 ? clamp(next.y) : at.y });
  }

  const position = { "--at": `${at.x * 100}% ${at.y * 100}%` } as CSSProperties;

  return (
    <div
      ref={frame}
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      className={cx(
        "relative aspect-video cursor-grab touch-none overflow-hidden bg-brand-dark select-none active:cursor-grabbing",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        className,
      )}
    >
      {/* A local object URL, not a bucket file: nothing for Next's image optimizer to do. */}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) =>
            setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
          }
          style={position}
          className="pointer-events-none absolute inset-0 size-full object-cover object-(--at)"
        />
      ) : null}
    </div>
  );
}
