import { validateContest } from "@/lib/contestScoring";
import type { ContestIssue } from "@/types/contest";

export type FormCriterion = { id: string; name: string; /** What the field holds: parsed on save. */ weight: string };
export type FormEntry = { id: string; name: string; description: string };

export type ContestFormState = {
  title: string;
  description: string;
  criteria: FormCriterion[];
  entries: FormEntry[];
  juryIds: string[];
  nextNumber: number;
  /** What the last save found wrong. */
  issues: ContestIssue[];
  saveResult: "saved" | "invalid" | null;
};

export type ContestFormEvent =
  | { type: "TITLE_CHANGED"; value: string }
  | { type: "DESCRIPTION_CHANGED"; value: string }
  | { type: "CRITERION_ADDED" }
  | { type: "CRITERION_REMOVED"; id: string }
  | { type: "CRITERION_CHANGED"; id: string; field: "name" | "weight"; value: string }
  | { type: "ENTRY_ADDED" }
  | { type: "ENTRY_REMOVED"; id: string }
  | { type: "ENTRY_CHANGED"; id: string; field: "name" | "description"; value: string }
  | { type: "JURY_TOGGLED"; userId: string }
  | { type: "SAVED" }
  | { type: "SAVE_RESULT_SEEN" };

export const initialContestForm: ContestFormState = {
  title: "",
  description: "",
  criteria: [{ id: "criterion-1", name: "", weight: "100" }],
  entries: [{ id: "entry-1", name: "", description: "" }],
  juryIds: [],
  nextNumber: 2,
  issues: [],
  saveResult: null,
};

export function weightValue(weight: string): number {
  return weight.trim() === "" ? Number.NaN : Number(weight);
}

/** Runs the same check the server will: the form fields become a contest draft. */
export function checkForm(state: ContestFormState): ContestIssue[] {
  return validateContest({
    title: state.title,
    criteria: state.criteria.map((c) => ({ id: c.id, name: c.name, weight: weightValue(c.weight) })),
    entries: state.entries.map((e) => ({ id: e.id, name: e.name, description: e.description })),
    jury: state.juryIds.map((userId) => ({ userId, name: "", finished: false })),
  });
}

const withoutIssue = (issues: readonly ContestIssue[], ...fields: string[]) =>
  issues.filter((issue) => !fields.includes(issue.field));

export function contestFormReducer(state: ContestFormState, event: ContestFormEvent): ContestFormState {
  switch (event.type) {
    case "TITLE_CHANGED":
      return { ...state, title: event.value, issues: withoutIssue(state.issues, "title") };
    case "DESCRIPTION_CHANGED":
      return { ...state, description: event.value };
    case "CRITERION_ADDED":
      return {
        ...state,
        criteria: [...state.criteria, { id: `criterion-${state.nextNumber}`, name: "", weight: "" }],
        nextNumber: state.nextNumber + 1,
        issues: withoutIssue(state.issues, "criteria"),
      };
    case "CRITERION_REMOVED":
      return {
        ...state,
        criteria: state.criteria.filter((c) => c.id !== event.id),
        issues: withoutIssue(state.issues, "criteria", `criterion:${event.id}:name`),
      };
    case "CRITERION_CHANGED":
      return {
        ...state,
        criteria: state.criteria.map((c) => (c.id === event.id ? { ...c, [event.field]: event.value } : c)),
        issues: withoutIssue(state.issues, event.field === "name" ? `criterion:${event.id}:name` : "criteria"),
      };
    case "ENTRY_ADDED":
      return {
        ...state,
        entries: [...state.entries, { id: `entry-${state.nextNumber}`, name: "", description: "" }],
        nextNumber: state.nextNumber + 1,
        issues: withoutIssue(state.issues, "entries"),
      };
    case "ENTRY_REMOVED":
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== event.id),
        issues: withoutIssue(state.issues, "entries", `entry:${event.id}:name`),
      };
    case "ENTRY_CHANGED":
      return {
        ...state,
        entries: state.entries.map((e) => (e.id === event.id ? { ...e, [event.field]: event.value } : e)),
        issues: event.field === "name" ? withoutIssue(state.issues, `entry:${event.id}:name`) : state.issues,
      };
    case "JURY_TOGGLED":
      return {
        ...state,
        juryIds: state.juryIds.includes(event.userId)
          ? state.juryIds.filter((id) => id !== event.userId)
          : [...state.juryIds, event.userId],
        issues: withoutIssue(state.issues, "jury"),
      };
    case "SAVED": {
      const issues = checkForm(state);
      return { ...state, issues, saveResult: issues.length === 0 ? "saved" : "invalid" };
    }
    case "SAVE_RESULT_SEEN":
      return { ...state, saveResult: null };
  }
}
