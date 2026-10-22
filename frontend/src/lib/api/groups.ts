import type { Group } from "@/types/group";
import { apiFetch } from "./client";

export const listGroups = () => apiFetch<Group[]>("/admin/groups");

export const createGroup = (name: string) => apiFetch<Group>("/admin/groups", { method: "POST", body: { name } });

export const renameGroup = (id: string, name: string) =>
  apiFetch<Group>(`/admin/groups/${id}`, { method: "PUT", body: { name } });

/** Refused with GROUP_NOT_EMPTY while students are in it. */
export const deleteGroup = (id: string) => apiFetch<void>(`/admin/groups/${id}`, { method: "DELETE" });
