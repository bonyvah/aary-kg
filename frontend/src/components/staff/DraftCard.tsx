"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readDraft, type DraftKind } from "@/lib/quizEditor/drafts";
import type { EditorDoc } from "@/lib/quizEditor/reducer";

const HREF: Record<DraftKind, string> = { quiz: "/quizzes/manage/new", exam: "/exams/manage/new" };

/** The quiz or exam sheet being created in this browser, in grey: not saved yet. Nothing when there is none. */
export function DraftCard({ kind }: { kind: DraftKind }) {
  const t = useTranslations("staff.dashboard");
  const [draft, setDraft] = useState<EditorDoc | null>(null);

  useEffect(() => {
    setDraft(readDraft(kind));
  }, [kind]);

  if (!draft) return null;
  const count = draft.questions.filter((q) => q.text.trim() !== "").length;

  return (
    <div
      className={
        "relative flex min-h-[116px] w-full flex-col gap-2 rounded-lg border-2 border-draft-edge bg-draft p-6 text-on-draft sm:max-w-[calc(50%-0.5rem)] lg:max-w-[calc(33.333%-0.7rem)] " +
        "shadow-[0_4px_0_0_var(--draft-edge)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--draft-edge)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <span className="w-fit rounded-full border-2 border-draft-edge px-3 py-1 text-caption font-bold">{t("draft")}</span>
      <h2 className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={HREF[kind]} className="outline-none after:absolute after:inset-0 after:content-['']">
          {draft.title.trim() || t("untitled")}
        </Link>
      </h2>
      <p className="mt-auto text-body">{t("questionCount", { count })}</p>
    </div>
  );
}
