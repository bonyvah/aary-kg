"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AvatarInitial } from "@/components/game/Avatar";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Modal } from "@/components/ui/Modal";

/** The initial in a circle opens the account settings: language and sign out. */
export function StaffMenu({ name }: { name: string }) {
  const t = useTranslations("staff.menu");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t("open")}
        onClick={() => setOpen(true)}
        className="rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <AvatarInitial name={name} />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        actions={
          <>
            <Button variant="neutral" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
            <ButtonLink href="/login" variant="danger">
              {t("signOut")}
            </ButtonLink>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-body font-bold">{name}</p>
          <p className="text-body font-bold text-ink-muted">{tc("language")}</p>
          <LocaleSwitcher />
        </div>
      </Modal>
    </>
  );
}
