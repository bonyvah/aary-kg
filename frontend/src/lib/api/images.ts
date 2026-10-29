import { apiFetch } from "./client";

/** The formats the server takes; it stores every one as WebP. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** A quiz cover or a question image. Returns the id the quiz or question keeps. */
export function uploadImage(file: File): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{ id: string }>("/images", { method: "POST", body: form });
}
