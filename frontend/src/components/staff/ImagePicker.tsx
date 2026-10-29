"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Image as ImageGlyph } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ImageFrame } from "@/components/ui/ImageFrame";
import { Modal } from "@/components/ui/Modal";
import { toKnownCode, type KnownApiCode } from "@/lib/api/client";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, uploadImage, type ImageFrameAt } from "@/lib/api/images";
import { ImageCropper } from "./ImageCropper";

type ImagePickerProps = {
  label: string;
  image: string | null | undefined;
  onChange: (image: string | null) => void;
};

/**
 * An optional image: add one, replace it or take it away. A picked file opens in a dialog to be framed
 * (dragged in the 16:9 frame) and is uploaded on «save», cut where it was placed.
 */
export function ImagePicker({ label, image, onChange }: ImagePickerProps) {
  const t = useTranslations("staff.editor.image");
  const tc = useTranslations("common");
  const input = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<KnownApiCode | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [at, setAt] = useState<ImageFrameAt>({ x: 0.5, y: 0.5 });

  // The picked file is shown from memory until it is saved or dropped.
  // Made here, not on pick, so a cleanup never leaves a revoked URL on screen.
  useEffect(() => {
    if (!pending) return setPreview(null);
    const url = URL.createObjectURL(pending);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    // The server checks the same; this only saves sending a file it would refuse.
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return setError("IMAGE_UNSUPPORTED");
    if (file.size > MAX_IMAGE_BYTES) return setError("FILE_TOO_LARGE");
    setAt({ x: 0.5, y: 0.5 });
    setPending(file);
  }

  async function save() {
    if (!pending) return;
    setError(null);
    setBusy(true);
    try {
      onChange((await uploadImage(pending, at)).id);
      setPending(null);
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
      {image ? <ImageFrame image={image} className="w-full max-w-[360px] rounded-md" /> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={busy}
          aria-describedby={error ? errorId : undefined}
          onClick={() => input.current?.click()}
        >
          <Icon icon={ImageGlyph} />
          {image ? t("replace") : t("add")}
        </Button>
        {image ? (
          <Button variant="neutral" onClick={() => onChange(null)}>
            {t("remove")}
          </Button>
        ) : null}
      </div>
      {error && !pending ? (
        <p id={errorId} role="alert" className="text-caption font-bold text-danger-text">
          {tc(`apiError.${error}`)}
        </p>
      ) : null}
      <Modal
        open={pending !== null}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        title={label}
        wide
        actions={
          <>
            <Button variant="neutral" disabled={busy} onClick={() => setPending(null)}>
              {t("cancel")}
            </Button>
            <Button variant="success" disabled={busy} onClick={() => void save()}>
              {busy ? t("uploading") : t("save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <ImageCropper src={preview} at={at} onMove={setAt} label={t("frame")} className="w-full rounded-md" />
          {error && pending ? (
            <p role="alert" className="text-caption font-bold text-danger-text">
              {tc(`apiError.${error}`)}
            </p>
          ) : null}
        </div>
      </Modal>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
