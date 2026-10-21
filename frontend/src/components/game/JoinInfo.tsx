"use client";

import { useState } from "react";
import { QrCode } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { formatPin } from "@/lib/joinLink";
import { JoinQrModal } from "./JoinQrModal";

/** In the host's top bar: the game PIN always in view, and a QR button that opens it large for the room. */
export function JoinInfo({ pin }: { pin: string }) {
  const t = useTranslations("host.bar");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <IconButton label={t("showQr")} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon icon={QrCode} weight="bold" size={28} />
      </IconButton>
      <p className="text-body-lg">
        {t("pin")} <span className="font-black tabular-nums">{formatPin(pin)}</span>
      </p>
      <JoinQrModal pin={pin} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
