import type { ManagedUser } from "@/types/user";
import { apiFetch } from "./client";

export const login = (login: string, password: string) =>
  apiFetch<ManagedUser>("/auth/login", { method: "POST", body: { login, password } });

export const logout = () => apiFetch<void>("/auth/logout", { method: "POST" });

export const me = () => apiFetch<ManagedUser>("/auth/me");
