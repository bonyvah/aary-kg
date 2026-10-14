import type { AvatarId } from "@/components/game/Avatar";

/** Shape of a player in a live game. Mock data uses it now, the API will return the same. */
export type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar: AvatarId;
};

export type StaffRole = "admin" | "user" | "jury";

export type StaffUser = {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
};
