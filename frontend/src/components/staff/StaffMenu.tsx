"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AvatarInitial } from "@/components/game/Avatar";
import { useCurrentUser } from "./SessionProvider";
import { SettingsModal } from "./SettingsModal";

/** The initial in a circle opens the account settings. */
export function StaffMenu() {
  const { name } = useCurrentUser();
  const t = useTranslations("staff.menu");
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
      <SettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
