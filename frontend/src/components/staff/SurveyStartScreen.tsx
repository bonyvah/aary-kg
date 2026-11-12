"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/useToast";
import { toKnownCode } from "@/lib/api/client";
import { startSurvey } from "@/lib/api/surveys";
import type { Group } from "@/types/group";
import type { SurveySheetSummary } from "@/types/survey";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

type Props = {
  sheets: readonly SurveySheetSummary[];
  groups: readonly Group[];
  /** The sheet to preselect, from `?sheet=`. */
  sheetId: string | null;
};

/** Start a survey: the sheet and the groups whose students answer it. */
export function SurveyStartScreen({ sheets, groups, sheetId: preselected }: Props) {
  const t = useTranslations("admin.surveys.start");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast, show } = useToast();
  const [sheetId, setSheetId] = useState(
    preselected && sheets.some((s) => s.id === preselected) ? preselected : (sheets[0]?.id ?? ""),
  );
  const [groupIds, setGroupIds] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Groups without students can't answer: they are not offered.
  const sorted = useMemo(
    () => groups.filter((g) => g.studentCount > 0).sort((a, b) => a.name.localeCompare(b.name, locale)),
    [groups, locale],
  );

  function flip(id: string) {
    setGroupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start() {
    setBusy(true);
    try {
      const survey = await startSurvey({ sheetId, groupIds: [...groupIds] });
      router.push(`/admin/surveys/${survey.id}`);
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
      setBusy(false);
    }
  }

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href="/admin" variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-black">{t("title")}</h1>
        <Button variant="success" disabled={busy || sheetId === "" || groupIds.size === 0} onClick={() => void start()}>
          {t("start")}
        </Button>
      </div>
      <Select label={t("sheet")} value={sheetId} wrapperClassName="max-w-[560px]" onChange={(event) => setSheetId(event.target.value)}>
        {sheets.length === 0 ? <option value="">{t("noSheets")}</option> : null}
        {sheets.map((sheet) => (
          <option key={sheet.id} value={sheet.id}>
            {sheet.title}
          </option>
        ))}
      </Select>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-body font-bold">{t("groups")}</legend>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((group) => (
            <Checkbox
              key={group.id}
              label={group.name}
              hint={t("studentCount", { count: group.studentCount })}
              checked={groupIds.has(group.id)}
              onChange={() => flip(group.id)}
            />
          ))}
        </div>
      </fieldset>
      {toast}
    </StaffShell>
  );
}
