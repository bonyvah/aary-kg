import { ImageFrame } from "@/components/ui/ImageFrame";
import { cx } from "@/lib/cx";

type GameImageProps = {
  image: string | undefined;
  /** The biggest it gets, as a share of the screen's height, e.g. `34dvh`. */
  maxHeight: "28dvh" | "34dvh";
};

const WIDTH = {
  "28dvh": "w-[min(100cqw,calc(100cqh*16/9),calc(28dvh*16/9))]",
  "34dvh": "w-[min(100cqw,calc(100cqh*16/9),calc(34dvh*16/9))]",
} as const;

/**
 * A question's image on a game screen. It takes the room the question text and the answers leave, up to
 * `maxHeight`, so a long question with an image still has its answers on screen.
 */
export function GameImage({ image, maxHeight }: GameImageProps) {
  if (!image) return null;
  return (
    <div className="flex min-h-[120px] flex-1 basis-0 items-center justify-center [container-type:size]">
      <ImageFrame image={image} className={cx("rounded-md", WIDTH[maxHeight])} />
    </div>
  );
}
