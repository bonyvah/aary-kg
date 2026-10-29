"use client";

import { useState } from "react";
import { Image as ImageGlyph } from "@phosphor-icons/react/ssr";
import { cx } from "@/lib/cx";
import { imageUrl } from "@/lib/images";
import { Icon } from "./Icon";

type ImageFrameProps = {
  /** An uploaded image's id. None: nothing is drawn, unless `placeholder`. */
  image: string | null | undefined;
  /** Draw the empty frame with an image mark when there is no image (cards, so they all keep one shape). */
  placeholder?: boolean;
  /** Sizing and corners from the screen: a width, a max width, a radius. The frame is always 16:9. */
  className?: string;
};

/**
 * Every quiz and question image fills the same 16:9 frame, so pictures take the same room everywhere.
 * Uploads are stored cut to 16:9; an older one of another shape is cut in the middle. A picture that
 * fails to load shows the empty frame.
 */
export function ImageFrame({ image, placeholder = false, className }: ImageFrameProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = image ? imageUrl(image) : null;
  const shown = src !== null && failed !== src;
  if (!shown && !placeholder && !image) return null;

  return (
    <div className={cx("relative grid aspect-video place-items-center overflow-hidden bg-brand-dark", className)}>
      {shown ? (
        // The bucket serves the final WebP, already sized: nothing for Next's image optimizer to do.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <Icon icon={ImageGlyph} weight="fill" size={40} className="text-brand-light" />
      )}
    </div>
  );
}
