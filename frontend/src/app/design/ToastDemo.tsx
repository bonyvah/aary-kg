"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Toast, ToastRegion } from "@/components/ui/Toast";

const VISIBLE_MS = 3000;

export function ToastDemo() {
  const t = useTranslations("design");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <>
      <Button variant="neutral" onClick={() => setShown(true)}>
        {t("toast.show")}
      </Button>
      {shown ? (
        <ToastRegion>
          <Toast variant="success">{t("toast.success")}</Toast>
        </ToastRegion>
      ) : null}
    </>
  );
}
