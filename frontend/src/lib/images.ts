/** The image bucket's public URL (next.config.ts). Empty: images are not set up, none can be shown. */
const BASE = process.env.NEXT_PUBLIC_IMAGES_URL ?? "";

/** Where the browser loads an uploaded image from: `<bucket>/<id>.webp`. */
export function imageUrl(id: string): string | null {
  return BASE ? `${BASE}/${id}.webp` : null;
}
