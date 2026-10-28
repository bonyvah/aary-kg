"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/useToast";
import { toKnownCode } from "@/lib/api/client";
import { startExamSession } from "@/lib/api/examSessions";
import { PRESENT, targetStudents } from "@/lib/examSessions";
import type { ExamSummary } from "@/types/exam";
import type { AttendanceChange, StudentChoice } from "@/types/examSession";
import type { Group } from "@/types/group";
import { Users } from "@phosphor-icons/react/ssr";
import { AttendanceButton, AttendanceModal } from "./AttendanceModal";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

type SetupProps = {
  exams: ExamSummary[];
  groups: Group[];
  students: StudentChoice[];
  /** The sheet to preselect, from `?exam=`. */
  examId: string | null;
};

/** Start an exam: the sheet, the group (or several groups and single students), then who is absent or late. */
export function ExamSessionSetupScreen({ exams, groups, students, examId: preselected }: SetupProps) {
  const t = useTranslations("staff.examSession.setup");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast, show } = useToast();
  const [examId, setExamId] = useState(
    preselected && exams.some((e) => e.id === preselected) ? preselected : (exams[0]?.id ?? ""),
  );
  const [groupIds, setGroupIds] = useState<ReadonlySet<string>>(new Set());
  const [extraIds, setExtraIds] = useState<ReadonlySet<string>>(new Set());
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState("");
  const [marks, setMarks] = useState<Readonly<Record<string, AttendanceChange>>>({});
  const [busy, setBusy] = useState(false);
  const [attending, setAttending] = useState(false);

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name, locale)), [groups, locale]);
  const targets = targetStudents(students, groupIds, extraIds, locale);
  const rows = targets.map((s) => ({ ...(marks[s.id] ?? PRESENT), studentId: s.id, name: s.name, groupName: s.groupName }));
  const query = search.trim().toLocaleLowerCase(locale);
  const outside = students
    .filter((s) => s.groupId === null || !groupIds.has(s.groupId))
    .filter((s) => query === "" || s.name.toLocaleLowerCase(locale).includes(query) || extraIds.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  function flip(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function start() {
    setBusy(true);
    try {
      const session = await startExamSession({
        examId,
        groupIds: [...groupIds],
        students: rows.map(({ studentId, attendance, lateMinutes }) => ({ studentId, attendance, lateMinutes })),
      });
      router.push(`/exam-sessions/${session.id}`);
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
      setBusy(false);
    }
  }

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href="/dashboard" variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-black">{t("title")}</h1>
        <Button variant="success" disabled={busy || examId === "" || rows.length === 0} onClick={() => void start()}>
          {t("start")}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t("sheet")} value={examId} onChange={(event) => setExamId(event.target.value)}>
          {exams.length === 0 ? <option value="">{t("noSheets")}</option> : null}
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.title}
            </option>
          ))}
        </Select>
        {more ? (
          <div className="flex items-end">
            <Button variant="secondary" aria-expanded onClick={() => setMore(false)}>
              {t("lessTargets")}
            </Button>
          </div>
        ) : (
          <Select
            label={t("group")}
            value={[...groupIds][0] ?? ""}
            onChange={(event) => setGroupIds(new Set(event.target.value ? [event.target.value] : []))}
          >
            <option value="">{t("groupPick")}</option>
            {sortedGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {more ? null : (
        <div>
          <Button variant="secondary" aria-expanded={false} onClick={() => setMore(true)}>
            {t("moreTargets")}
          </Button>
        </div>
      )}

      {more ? (
        <div className="grid gap-6 md:grid-cols-2">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 text-body font-bold">{t("groups")}</legend>
            {sortedGroups.map((group) => (
              <Checkbox
                key={group.id}
                label={group.name}
                checked={groupIds.has(group.id)}
                onChange={() => setGroupIds((set) => flip(set, group.id))}
              />
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-body font-bold">{t("students")}</legend>
            <SearchInput label={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {outside.map((student) => (
                <Checkbox
                  key={student.id}
                  label={student.name}
                  hint={student.groupName ?? undefined}
                  checked={extraIds.has(student.id)}
                  onChange={() => setExtraIds((set) => flip(set, student.id))}
                />
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-body-lg font-bold">{t("studentCount", { count: rows.length })}</p>
          <AttendanceButton rows={rows} onClick={() => setAttending(true)} />
        </div>
      ) : (
        <EmptyState icon={Users} title={t("noStudents")} />
      )}
      {attending ? (
        <AttendanceModal
          rows={rows}
          onChange={(studentId, change) => setMarks((m) => ({ ...m, [studentId]: change }))}
          onClose={() => setAttending(false)}
        />
      ) : null}
      {toast}
    </StaffShell>
  );
}
