"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatPin, joinUrl } from "@/lib/joinLink";

type JoinQrModalProps = {
  pin: string;
  open: boolean;
  onClose: () => void;
};

/** The QR code and the PIN, large enough for the room to scan from the projector. */
export function JoinQrModal({ pin, open, onClose }: JoinQrModalProps) {
  const t = useTranslations("host.bar");
  // The QR code opens the site the host screen is on.
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("joinTitle")}
      actions={
        <Button variant="secondary" onClick={onClose}>
          {t("closeQr")}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="rounded-lg bg-field p-4 text-on-field">
          <QRCodeSVG value={joinUrl(pin, origin)} size={280} marginSize={0} bgColor="transparent" fgColor="currentColor" role="img" aria-label={t("qrLabel")} />
        </div>
        <p className="text-display font-black tabular-nums">{formatPin(pin)}</p>
      </div>
    </Modal>
  );
}
