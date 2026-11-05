import type { ManagedUser } from "@/types/user";
import { apiFetch } from "./client";

export const listUsers = () => apiFetch<ManagedUser[]>("/admin/users");

export type NewUser = {
  firstName: string;
  lastName: string;
  login: string;
  role: "teacher" | "student";
  /** Students only. */
  groupId: string | null;
  /** Blank: the server generates one. */
  password: string;
};

export const createUser = (input: NewUser) =>
  apiFetch<{ user: ManagedUser; password: string }>("/admin/users", { method: "POST", body: input });

/** One person read from an admin's list. A login the model got wrong comes blank. */
export type StudentRow = { firstName: string; lastName: string; login: string };

/** A row as read. When its login got a number: the one the model chose, and whose that is. */
export type ProposedStudent = StudentRow & { takenLogin: string | null; takenBy: string | null };

/** A student list from a file or pasted text. Nothing is saved: the admin reviews it first. */
export function parseStudents(file: File | null, text: string) {
  const form = new FormData();
  if (file) form.set("file", file);
  else form.set("text", text);
  return apiFetch<ProposedStudent[]>("/admin/users/bulk/parse", { method: "POST", body: form });
}

/** All of them or none, in one group, with the one password the admin chose. */
export const createStudents = (input: { groupId: string; password: string; students: readonly StudentRow[] }) =>
  apiFetch<ManagedUser[]>("/admin/users/bulk", { method: "POST", body: input });

export const moveToGroup = (id: string, groupId: string) =>
  apiFetch<ManagedUser>(`/admin/users/${id}/group`, { method: "PUT", body: { groupId } });

export const disableUser = (id: string) => apiFetch<ManagedUser>(`/admin/users/${id}/disable`, { method: "POST" });

/** The new password is in the answer and nowhere else: show it once. Blank: the server generates one. */
export const resetPassword = (id: string, password: string) =>
  apiFetch<{ password: string }>(`/admin/users/${id}/reset-password`, { method: "POST", body: { password } });
