"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Modal } from "@/components/ui/Modal";
import { useCurrentUser, useSession } from "./SessionProvider";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  /** Left out on the live host screen: nobody changes a password in the middle of a game. */
  onChangeLogin?: () => void;
  onChangePassword?: () => void;
};

/** Account settings: who is signed in, change login and password, the language switcher and sign out. */
export function SettingsModal({ open, onClose, onChangeLogin, onChangePassword }: SettingsModalProps) {
  const { name, login } = useCurrentUser();
  const session = useSession();
  const t = useTranslations("staff.menu");
  const ta = useTranslations("staff.account");
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
        <p className="text-body font-bold wrap-anywhere">{name}</p>
        <p className="text-body text-ink-muted wrap-anywhere">{ta("loginIs", { login })}</p>
        {onChangeLogin && onChangePassword ? (
          <div className="mb-2 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onChangeLogin}>
              {ta("login.open")}
            </Button>
            <Button variant="secondary" onClick={onChangePassword}>
              {ta("password.open")}
            </Button>
          </div>
        ) : null}
        <p className="text-body font-bold text-ink-muted">{tc("language")}</p>
        <LocaleSwitcher />
      </div>
    </Modal>
  );
}
