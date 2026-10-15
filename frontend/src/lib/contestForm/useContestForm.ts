"use client";

import { useCallback, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { createContest } from "@/lib/api/contests";
import { ApiRequestError } from "@/lib/api/client";
import type { ContestErrorCode } from "@/types/contest";
import { checkForm, contestFormReducer, initialContestForm, weightValue, type ContestFormEvent } from "./reducer";

const ISSUE_CODES: readonly string[] = [
  "FIELD_REQUIRED",
  "WEIGHTS_NOT_100",
  "CRITERIA_REQUIRED",
  "ENTRIES_REQUIRED",
  "JURY_REQUIRED",
] satisfies ContestErrorCode[];

/** State of the «new contest» form. «Save» checks the fields, sends the contest, then opens its page. */
export function useContestForm() {
  const router = useRouter();
  const [state, dispatch] = useReducer(contestFormReducer, initialContestForm);
  const [saving, setSaving] = useState(false);
  const send = useCallback((event: ContestFormEvent) => dispatch(event), []);

  const save = useCallback(async () => {
    dispatch({ type: "VALIDATED" });
    if (checkForm(state).length > 0) return;
    setSaving(true);
    try {
      const contest = await createContest({
        title: state.title,
        description: state.description,
        criteria: state.criteria.map((c) => ({ id: c.id, name: c.name, weight: weightValue(c.weight) })),
        entries: state.entries.map((e) => ({ id: e.id, name: e.name, description: e.description })),
        juryIds: state.juryIds,
      });
      router.push(`/contests/${contest.id}`);
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiRequestError && error.code === "CONTEST_INVALID") {
        const issues = error.issues.filter((issue) => ISSUE_CODES.includes(issue.code));
        dispatch({ type: "SAVE_REJECTED", issues: issues as { code: ContestErrorCode; field: string }[] });
      } else {
        dispatch({ type: "SAVE_FAILED", code: error instanceof ApiRequestError ? error.code : "UNKNOWN" });
      }
    }
  }, [state, router]);

  return { state, send, save, saving };
}
