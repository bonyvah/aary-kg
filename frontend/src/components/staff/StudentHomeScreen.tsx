"use client";

import { useTranslations } from "next-intl";
import { Exam } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

/** Where a student lands after signing in: their exams. The list comes with the exams (#59). */
export function StudentHomeScreen() {
  const t = useTranslations("student.home");

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <StaffMenu />
        </div>
      }
    >
      <h1 className="text-h1 font-black">{t("title")}</h1>
      <EmptyState icon={Exam} title={t("empty")} />
    </StaffShell>
  );
}
