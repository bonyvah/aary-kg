import type { ManagedUser, UserRole } from "@/types/user";
import { apiFetch } from "./client";

export const listUsers = () => apiFetch<ManagedUser[]>("/admin/users");

export const createUser = (input: { name: string; login: string; role: UserRole }) =>
  apiFetch<{ user: ManagedUser; password: string }>("/admin/users", { method: "POST", body: input });

export const setUserActive = (id: string, active: boolean) =>
  apiFetch<ManagedUser>(`/admin/users/${id}/${active ? "enable" : "disable"}`, { method: "POST" });

/** The new password is in the answer and nowhere else: show it once. */
export const resetPassword = (id: string) =>
  apiFetch<{ password: string }>(`/admin/users/${id}/reset-password`, { method: "POST" });
