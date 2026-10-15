import { apiFetch } from "./client";

/** Who can be picked as jury: active users, name only. */
export type DirectoryUser = { id: string; name: string };

export const listDirectory = () => apiFetch<DirectoryUser[]>("/users/directory");
