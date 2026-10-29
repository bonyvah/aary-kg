"use client";

import { useId, useRef, useState } from "react";
import { Image as ImageGlyph } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ImageFrame } from "@/components/ui/ImageFrame";
import { toKnownCode, type KnownApiCode } from "@/lib/api/client";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, uploadImage } from "@/lib/api/images";

type ImagePickerProps = {
  label: string;
  image: string | null | undefined;
  onChange: (image: string | null) => void;
};

/** An optional image: add one (uploaded at once), replace it or take it away. */
export function ImagePicker({ label, image, onChange }: ImagePickerProps) {
  const t = useTranslations("staff.editor.image");
  const tc = useTranslations("common");
  const input = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<KnownApiCode | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    // The server checks the same; this only saves sending a file it would refuse.
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return setError("IMAGE_UNSUPPORTED");
    if (file.size > MAX_IMAGE_BYTES) return setError("FILE_TOO_LARGE");
    setBusy(true);
    try {
      onChange((await uploadImage(file)).id);
    } catch (failure) {
      setError(toKnownCode(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <span id={labelId} className="text-body font-bold text-ink">
        {label}
      </span>
      {image ? <ImageFrame image={image} className="w-full max-w-[360px]" /> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={busy}
          aria-describedby={error ? errorId : undefined}
          onClick={() => input.current?.click()}
        >
          <Icon icon={ImageGlyph} />
          {busy ? t("uploading") : image ? t("replace") : t("add")}
        </Button>
        {image && !busy ? (
          <Button variant="neutral" onClick={() => onChange(null)}>
            {t("remove")}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-caption font-bold text-danger-text">
          {tc(`apiError.${error}`)}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
