/** Rules for a password someone chooses. The server enforces them (and the name rule); this is the quick feedback. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type PasswordProblem = "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG" | "PASSWORD_NEEDS_LETTER" | "PASSWORD_NEEDS_DIGIT";

/** The first rule the password breaks, or null. Letters of any alphabet count; capitals and symbols are not required. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (Array.from(password).length < PASSWORD_MIN) return "PASSWORD_TOO_SHORT";
  if (password.length > PASSWORD_MAX) return "PASSWORD_TOO_LONG";
  if (!/\p{L}/u.test(password)) return "PASSWORD_NEEDS_LETTER";
  if (!/[0-9]/.test(password)) return "PASSWORD_NEEDS_DIGIT";
  return null;
}

/** Codes the account forms show under a field (anything else is a general error). */
export const ACCOUNT_CODES = [
  "FIELD_REQUIRED",
  "LOGIN_INVALID",
  "LOGIN_TAKEN",
  "NOTHING_TO_CHANGE",
  "CURRENT_PASSWORD_WRONG",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "PASSWORD_NEEDS_LETTER",
  "PASSWORD_NEEDS_DIGIT",
  "PASSWORD_CONTAINS_NAME",
  "PASSWORD_CONTAINS_LOGIN",
  "PASSWORD_SAME",
] as const;
export type AccountCode = (typeof ACCOUNT_CODES)[number];

export function isAccountCode(code: string): code is AccountCode {
  return (ACCOUNT_CODES as readonly string[]).includes(code);
}
