export type UserRole = "admin" | "teacher" | "student";

/** An account an admin creates and manages. There is no self-registration. */
export type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  /** First name, then last name: what lists and messages show. */
  name: string;
  login: string;
  role: UserRole;
  /** Students only: the one group they are in. */
  groupId: string | null;
  groupName: string | null;
  active: boolean;
  /** ISO date the account was created. */
  createdAt: string;
};
