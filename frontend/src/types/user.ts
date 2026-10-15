export type UserRole = "admin" | "user";

/** An account an admin creates and manages. There is no self-registration. */
export type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  /** First name, then last name: what lists and messages show. */
  name: string;
  login: string;
  role: UserRole;
  active: boolean;
  /** ISO date the account was created. */
  createdAt: string;
};
