"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";

const IDS = ["buttons", "inputs", "badges"] as const;
type Id = (typeof IDS)[number];

export function TabsDemo({ idBase }: { idBase: string }) {
  const t = useTranslations("design");
  const [tab, setTab] = useState<Id>("buttons");

  return (
    <div className="flex max-w-[480px] flex-col gap-4">
      <Tabs
        idBase={idBase}
        label={t("section.tabs")}
        tabs={IDS.map((id) => ({ id, label: t(`section.${id}`) }))}
        value={tab}
        onChange={setTab}
      />
      <p id={panelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)} className="text-body-lg">
        {t(`section.${tab}`)}
      </p>
      <Select label={t("section.select")}>
        <option>{t("state.rest")}</option>
        <option>{t("state.locked")}</option>
        <option>{t("state.long")}</option>
      </Select>
      <Select label={t("section.select")} disabled>
        <option>{t("state.disabled")}</option>
      </Select>
    </div>
  );
}
