"use client";

import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/ui/Dropdown";
import { MAX_MINUTES, MIN_MINUTES, MINUTES_OPTIONS } from "@/lib/examEditor";
import { useExamEditor } from "@/lib/quizEditor/useQuizEditor";
import type { Exam } from "@/types/exam";
import { DocEditorScreen } from "./DocEditorScreen";

export function ExamEditorScreen({ exam }: { exam: Exam }) {
  const t = useTranslations("staff.examEditor");
  const editor = useExamEditor(exam);
  const { minutes } = editor.state.doc;
  // The presets, plus a typed-in time limit this exam already has.
  const options = Array.from(new Set([...MINUTES_OPTIONS, minutes]))
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: String(value) }));
  const choose = (value: number) => editor.changeDoc({ minutes: value });

  return (
    <DocEditorScreen
      editor={editor}
      titleLabel={t("titleLabel")}
      savedMessage={t("saved")}
      toolbar={
        <Dropdown
          label={t("minutesLabel")}
          wrapperClassName="w-full max-w-[200px]"
          value={minutes}
          options={options}
          selectedLabel={t("minutesOption", { minutes })}
          onChange={choose}
          custom={{ label: t("customMinutesLabel"), min: MIN_MINUTES, max: MAX_MINUTES, onCommit: choose }}
        />
      }
    />
  );
}
