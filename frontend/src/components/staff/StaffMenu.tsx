"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "./SessionProvider";
import { SettingsModal } from "./SettingsModal";

/** The user's name opens the account settings. */
export function StaffMenu() {
  const { name } = useCurrentUser();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="neutral" aria-haspopup="dialog" onClick={() => setOpen(true)} className="max-w-[220px] truncate">
        {name}
      </Button>
      <SettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
