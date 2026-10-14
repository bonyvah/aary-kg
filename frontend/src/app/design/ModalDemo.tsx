"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function ModalDemo() {
  const t = useTranslations("design");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("modal.open")}</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("modal.title")}
        actions={
          <>
            <Button variant="neutral" onClick={() => setOpen(false)}>
              {t("button.neutral")}
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              {t("button.danger")}
            </Button>
          </>
        }
      >
        {t("modal.body")}
      </Modal>
    </>
  );
}
