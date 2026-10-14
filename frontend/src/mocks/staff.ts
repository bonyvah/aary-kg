import type { ManagedUser } from "@/types/user";

/**
 * Who is "signed in" while there is no auth (Phase 5 brings the real session).
 * An admin, so the admin screens and every contest can be seen.
 */
export const mockCurrentUser: Pick<ManagedUser, "id" | "name" | "role"> = {
  id: "u-aizhan",
  name: "Айжан Мамбетова",
  role: "admin",
};
