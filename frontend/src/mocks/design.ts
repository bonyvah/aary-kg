import type { Player, StaffUser } from "@/types/game";

export const mockPlayers: readonly Player[] = [
  { id: "p1", nickname: "Айгерим", score: 12450, avatar: 0 },
  { id: "p2", nickname: "Бекзат", score: 11200, avatar: 2 },
  { id: "p3", nickname: "Нурбек", score: 9870, avatar: 4 },
  { id: "p4", nickname: "Мээримбүбү Жумабаевна Токтогулова", score: 8300, avatar: 6 },
  { id: "p5", nickname: "Эрлан", score: 7940, avatar: 7 },
];

export const mockLobbyPlayers: readonly Player[] = [
  ...mockPlayers,
  { id: "p6", nickname: "Жылдыз", score: 0, avatar: 1 },
  { id: "p7", nickname: "Данияр", score: 0, avatar: 3 },
  { id: "p8", nickname: "Чынара", score: 0, avatar: 5 },
];

export const mockStaff: readonly StaffUser[] = [
  { id: "u1", name: "Асель Мамбетова", role: "admin", active: true },
  { id: "u2", name: "Улан Эсенов", role: "user", active: true },
  { id: "u3", name: "Ө. Күмөш кызы", role: "jury", active: false },
];
