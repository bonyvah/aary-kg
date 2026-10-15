import { apiFetch } from "./client";

/** Who can be picked as jury: active users. The login tells apart two people with the same name. */
export type DirectoryUser = { id: string; name: string; login: string };

export const listDirectory = () => apiFetch<DirectoryUser[]>("/users/directory");
