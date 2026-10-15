import type { ManagedUser } from "@/types/user";

/** Stable codes of a failed «create user». The frontend turns them into translated text. */
export type AdminErrorCode = "FIELD_REQUIRED" | "LOGIN_INVALID" | "LOGIN_TAKEN";

/** The rule for a login, here and when changing it in the account settings. Same as the server's. */
export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export type NewUserField = "firstName" | "lastName" | "login";

/** What the server checks on «create user». Returns the first error per field. */
export function validateNewUser(
  input: { firstName: string; lastName: string; login: string },
  existing: readonly Pick<ManagedUser, "login">[],
): Partial<Record<NewUserField, AdminErrorCode>> {
  const errors: Partial<Record<NewUserField, AdminErrorCode>> = {};
  if (input.firstName.trim() === "") errors.firstName = "FIELD_REQUIRED";
  if (input.lastName.trim() === "") errors.lastName = "FIELD_REQUIRED";
  const login = input.login.trim().toLowerCase();
  if (login === "") errors.login = "FIELD_REQUIRED";
  else if (!LOGIN_PATTERN.test(login)) errors.login = "LOGIN_INVALID";
  else if (existing.some((user) => user.login.toLowerCase() === login)) errors.login = "LOGIN_TAKEN";
  return errors;
}

// No 0/O, 1/l/I: a password read off a screen must not be ambiguous.
const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random password in three groups of four, e.g. `k7Tm-Qp3x-Zs9w`. Shown once, never stored in the UI. */
export function generatePassword(random: (max: number) => number = randomIndex): string {
  const group = () => Array.from({ length: 4 }, () => PASSWORD_CHARS[random(PASSWORD_CHARS.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

function randomIndex(max: number): number {
  const values = new Uint32Array(1);
  // Rejection sampling keeps every character equally likely.
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(values);
  while ((values[0] ?? 0) >= limit);
  return (values[0] ?? 0) % max;
}
