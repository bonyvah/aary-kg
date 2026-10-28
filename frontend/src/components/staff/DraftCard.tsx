"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listDrafts, type Draft, type DraftKind } from "@/lib/quizEditor/drafts";

const HREF: Record<DraftKind, string> = { quiz: "/quizzes/manage/new", exam: "/exams/manage/new" };

/** Every quiz or exam sheet being created in this browser, as grey cards: not saved yet. Nothing when there are none. */
export function DraftCards({ kind }: { kind: DraftKind }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    setDrafts(listDrafts(kind));
  }, [kind]);

  if (drafts.length === 0) return null;
  return (
    <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
      {drafts.map((draft) => (
        <li key={draft.id} className="flex">
          <DraftCard draft={draft} href={`${HREF[kind]}?draft=${encodeURIComponent(draft.id)}`} />
        </li>
      ))}
    </ul>
  );
}

function DraftCard({ draft, href }: { draft: Draft; href: string }) {
  const t = useTranslations("staff.dashboard");
  const count = draft.doc.questions.filter((q) => q.text.trim() !== "").length;

  return (
    <div
      className={
        "relative flex min-h-[116px] flex-1 flex-col gap-2 rounded-lg border-2 border-draft-edge bg-draft p-6 text-on-draft " +
        "shadow-[0_4px_0_0_var(--draft-edge)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--draft-edge)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <span className="w-fit rounded-full border-2 border-draft-edge px-3 py-1 text-caption font-bold">{t("draft")}</span>
      <h2 className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={href} className="outline-none after:absolute after:inset-0 after:content-['']">
          {draft.doc.title.trim() || t("untitled")}
        </Link>
      </h2>
      <p className="mt-auto text-body">{t("questionCount", { count })}</p>
    </div>
  );
}
