import type { Group } from "@/types/group";

/** Same as the server's limit. */
export const GROUP_NAME_MAX = 60;

export type GroupNameError = "FIELD_REQUIRED" | "GROUP_NAME_TAKEN";

/** What the server checks on a group name. `keepId` is the group being renamed: its own name is fine. */
export function validateGroupName(name: string, existing: readonly Pick<Group, "id" | "name">[], keepId?: string): GroupNameError | null {
  const clean = name.trim();
  if (clean === "") return "FIELD_REQUIRED";
  const lower = clean.toLowerCase();
  if (existing.some((group) => group.id !== keepId && group.name.toLowerCase() === lower)) return "GROUP_NAME_TAKEN";
  return null;
}
