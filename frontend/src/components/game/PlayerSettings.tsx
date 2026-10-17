"use client";

import { useState } from "react";
import { Gear } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Modal } from "@/components/ui/Modal";

/** The gear in the player's top bar: the language, and a way out of the game when the player is in one. */
export function PlayerSettings({ onLeave }: { onLeave?: () => void }) {
  const t = useTranslations("player.settings");
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function close() {
    setOpen(false);
    setConfirming(false);
  }

  return (
    <>
      <IconButton label={t("title")} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon icon={Gear} weight="bold" size={28} />
      </IconButton>
      <Modal
        open={open}
        onClose={close}
        title={t("title")}
        actions={
          // One row that never wraps: on a phone the longer Russian labels would push the second button below.
          <div className="flex w-full gap-4">
            {confirming ? (
              <>
                <Button variant="secondary" className="flex-auto" onClick={() => setConfirming(false)}>
                  {t("cancel")}
                </Button>
                <Button variant="danger" className="flex-auto" onClick={onLeave}>
                  {t("leave")}
                </Button>
              </>
            ) : (
              <>
                {onLeave ? (
                  <Button variant="danger" className="flex-auto" onClick={() => setConfirming(true)}>
                    {t("leave")}
                  </Button>
                ) : null}
                <Button variant="secondary" className="flex-auto" onClick={close}>
                  {t("close")}
                </Button>
              </>
            )}
          </div>
        }
      >
        {confirming ? <p>{t("leaveConfirm")}</p> : <LocaleSwitcher />}
      </Modal>
    </>
  );
}
