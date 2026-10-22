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
};

export const createUser = (input: NewUser) =>
  apiFetch<{ user: ManagedUser; password: string }>("/admin/users", { method: "POST", body: input });

export const moveToGroup = (id: string, groupId: string) =>
  apiFetch<ManagedUser>(`/admin/users/${id}/group`, { method: "PUT", body: { groupId } });

export const setUserActive = (id: string, active: boolean) =>
  apiFetch<ManagedUser>(`/admin/users/${id}/${active ? "enable" : "disable"}`, { method: "POST" });

/** The new password is in the answer and nowhere else: show it once. */
export const resetPassword = (id: string) =>
  apiFetch<{ password: string }>(`/admin/users/${id}/reset-password`, { method: "POST" });
