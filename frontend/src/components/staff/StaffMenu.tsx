"use client";

import { useState } from "react";
import { Gear } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/useToast";
import type { ManagedUser } from "@/types/user";
import { ChangeLoginModal } from "./ChangeLoginModal";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { useCurrentUser, useSession } from "./SessionProvider";
import { SettingsModal } from "./SettingsModal";

type View = "none" | "settings" | "login" | "password";

/** The gear opens the account settings; from there the login and the password can be changed. */
export function StaffMenu() {
  const { login } = useCurrentUser();
  const session = useSession();
  const t = useTranslations("staff.account");
  const tm = useTranslations("staff.menu");
  const { toast, show } = useToast();
  const [view, setView] = useState<View>("none");
  // Switching dialogs closes the old one, which reports `close` too: only the open one may reset the view.
  const closeIf = (mine: View) => () => setView((current) => (current === mine ? "none" : current));

  function changed(user: ManagedUser, message: "login" | "password") {
    session?.signedIn(user);
    setView("none");
    show("success", t(`toast.${message}`));
  }

  return (
    <>
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        aria-label={tm("title")}
        onClick={() => setView("settings")}
        className="size-11 p-0!"
      >
        <Icon icon={Gear} weight="bold" />
      </Button>
      <SettingsModal
        open={view === "settings"}
        onClose={closeIf("settings")}
        onChangeLogin={() => setView("login")}
        onChangePassword={() => setView("password")}
      />
      <ChangeLoginModal
        open={view === "login"}
        currentLogin={login}
        onClose={closeIf("login")}
        onChanged={(user) => changed(user, "login")}
      />
      <ChangePasswordModal open={view === "password"} onClose={closeIf("password")} onChanged={(user) => changed(user, "password")} />
      {toast}
    </>
  );
}
