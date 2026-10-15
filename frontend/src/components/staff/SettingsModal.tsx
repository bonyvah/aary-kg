"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Modal } from "@/components/ui/Modal";
import { useCurrentUser, useSession } from "./SessionProvider";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

/** Account settings: who is signed in, the language switcher and sign out. */
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { name } = useCurrentUser();
  const session = useSession();
  const t = useTranslations("staff.menu");
  const tc = useTranslations("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      actions={
        <>
          <Button variant="neutral" onClick={onClose}>
            {t("close")}
          </Button>
          <Button variant="danger" onClick={() => void session?.signOut()}>
            {t("signOut")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-body font-bold">{name}</p>
        <p className="text-body font-bold text-ink-muted">{tc("language")}</p>
        <LocaleSwitcher />
      </div>
    </Modal>
  );
}
