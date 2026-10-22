import type { Player, StaffUser } from "@/types/game";

export const mockPlayers: readonly Player[] = [
  { id: "p1", nickname: "Айгерим", score: 12450, character: { shape: "triangle", color: "red", face: "smile" } },
  { id: "p2", nickname: "Бекзат", score: 11200, character: { shape: "diamond", color: "blue", face: "grin" } },
  { id: "p3", nickname: "Нурбек", score: 9870, character: { shape: "star", color: "yellow", face: "stars" } },
  { id: "p4", nickname: "Мээримбүбү Жумабаевна Токтогулова", score: 8300, character: { shape: "hexagon", color: "green", face: "wink" } },
  { id: "p5", nickname: "Эрлан", score: 7940, character: { shape: "heart", color: "pink", face: "happy" } },
];

export const mockLobbyPlayers: readonly Player[] = [
  ...mockPlayers,
  { id: "p6", nickname: "Жылдыз", score: 0, character: { shape: "pill", color: "purple", face: "cool" } },
  { id: "p7", nickname: "Данияр", score: 0, character: { shape: "circle", color: "orange", face: "tongue" } },
  { id: "p8", nickname: "Чынара", score: 0, character: { shape: "square", color: "teal", face: "glasses" } },
];

export const mockStaff: readonly StaffUser[] = [
  { id: "u1", name: "Асель Мамбетова", role: "admin", active: true },
  { id: "u2", name: "Улан Эсенов", role: "teacher", active: true },
  { id: "u3", name: "Ө. Күмөш кызы", role: "jury", active: false },
];
