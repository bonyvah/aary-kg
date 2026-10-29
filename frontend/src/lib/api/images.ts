import { apiFetch } from "./client";

/** The formats the server takes; it stores every one as WebP. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Where the 16:9 cut goes on a picture too wide or too tall: 0 keeps the left or top edge, 1 the other. */
export type ImageFrameAt = { x: number; y: number };

/** A quiz cover or a question image, stored cut to 16:9. Returns the id the quiz or question keeps. */
export function uploadImage(file: File, at: ImageFrameAt = { x: 0.5, y: 0.5 }): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("x", String(at.x));
  form.append("y", String(at.y));
  return apiFetch<{ id: string }>("/images", { method: "POST", body: form });
}
