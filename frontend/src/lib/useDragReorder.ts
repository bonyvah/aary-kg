"use client";

import { useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";

/**
 * Drag and drop to reorder a list, plus Alt+↑ / Alt+↓ on a row for the keyboard.
 * `move(id, to)` puts the item with that id at index `to`.
 */
export function useDragReorder(ids: readonly string[], move: (id: string, to: number) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  return {
    dragging,
    over,
    /** Spread on each row. */
    row: (id: string) => ({
      draggable: true,
      onDragStart: (event: DragEvent) => {
        setDragging(id);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      },
      onDragOver: (event: DragEvent) => {
        if (!dragging) return;
        event.preventDefault();
        setOver(id);
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragging && dragging !== id) move(dragging, ids.indexOf(id));
        setDragging(null);
        setOver(null);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
      },
    }),
    /** Spread on the row's focusable element. */
    keys: (id: string) => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
        event.preventDefault();
        move(id, ids.indexOf(id) + (event.key === "ArrowUp" ? -1 : 1));
      },
    }),
  };
}
