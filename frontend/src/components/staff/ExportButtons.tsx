"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { downloadPdf, downloadXlsx, type ExportTable } from "@/lib/exportTable";

/** «Excel» and «PDF»: the results table as a file. `table` is built only when a button is pressed. */
export function ExportButtons({ table, onError }: { table: () => ExportTable; onError: () => void }) {
  const t = useTranslations("common.export");
  const [busy, setBusy] = useState(false);

  async function run(make: (table: ExportTable) => Promise<void>) {
    setBusy(true);
    try {
      await make(table());
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={() => void run(downloadXlsx)}>
        {t("xlsx")}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => void run(downloadPdf)}>
        {t("pdf")}
      </Button>
    </>
  );
}
