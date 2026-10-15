"use client";

import { useEffect, useState } from "react";
import { QrCode } from "@phosphor-icons/react/ssr";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { formatPin, joinUrl } from "@/lib/joinLink";

/** In the host's top bar: the game PIN always in view, and a QR button that opens it large for the room. */
export function JoinInfo({ pin }: { pin: string }) {
  const t = useTranslations("host.bar");
  const [open, setOpen] = useState(false);
  // The QR code opens the site the host screen is on.
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="flex items-center gap-2">
      <IconButton label={t("showQr")} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon icon={QrCode} weight="bold" size={28} />
      </IconButton>
      <p className="text-body-lg">
        {t("pin")} <span className="font-black tabular-nums">{formatPin(pin)}</span>
      </p>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("joinTitle")}
        actions={
          <Button variant="secondary" onClick={() => setOpen(false)}>
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
    </div>
  );
}
