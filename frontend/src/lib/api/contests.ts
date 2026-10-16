import type { Contest, ContestResults, Score } from "@/types/contest";
import { apiFetch } from "./client";

/** What the form sends. The ids are the form's own: the server reports failed fields against them. */
export type ContestInput = {
  title: string;
  description: string;
  criteria: { id: string; name: string; coefficient: number }[];
  entries: { id: string; name: string; description: string }[];
  juryIds: string[];
};

/** Contests the user owns or judges. */
export const listContests = () => apiFetch<Contest[]>("/contests");

/** Every contest of everyone. Admins only. */
export const listAllContests = () => apiFetch<Contest[]>("/admin/contests");

export const getContest = (id: string) => apiFetch<Contest>(`/contests/${id}`);

export const createContest = (input: ContestInput) => apiFetch<Contest>("/contests", { method: "POST", body: input });

export const openContest = (id: string) => apiFetch<Contest>(`/contests/${id}/open`, { method: "POST" });

export const closeContest = (id: string) => apiFetch<Contest>(`/contests/${id}/close`, { method: "POST" });

export const setScore = (id: string, entryId: string, criterionId: string, score: Score) =>
  apiFetch<void>(`/contests/${id}/scores`, { method: "PUT", body: { entryId, criterionId, score } });

export const finishScoring = (id: string) => apiFetch<Contest>(`/contests/${id}/finish`, { method: "POST" });

export const getResults = (id: string) => apiFetch<ContestResults>(`/contests/${id}/results`);
