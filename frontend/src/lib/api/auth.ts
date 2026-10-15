import type { ManagedUser } from "@/types/user";
import { apiFetch } from "./client";

export const login = (login: string, password: string) =>
  apiFetch<ManagedUser>("/auth/login", { method: "POST", body: { login, password } });

export const logout = () => apiFetch<void>("/auth/logout", { method: "POST" });

/** Both need the current password again. Changing the password ends the user's other sessions. */
export const changeLogin = (currentPassword: string, login: string) =>
  apiFetch<ManagedUser>("/auth/me/login", { method: "PUT", body: { currentPassword, login } });

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch<ManagedUser>("/auth/me/password", { method: "PUT", body: { currentPassword, newPassword } });

export const me = () => apiFetch<ManagedUser>("/auth/me");
