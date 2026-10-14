export type UserRole = "admin" | "user";

/** An account an admin creates and manages. There is no self-registration. */
export type ManagedUser = {
  id: string;
  name: string;
  login: string;
  role: UserRole;
  active: boolean;
  /** ISO date the account was created. */
  createdAt: string;
};
