import type { StaffUser } from "@/types/game";

/** Who is "signed in" while there is no auth (Phase 5 brings the real session). */
export const mockCurrentUser: Pick<StaffUser, "name" | "role"> = {
  name: "Айжан Мамбетова",
  role: "user",
};
