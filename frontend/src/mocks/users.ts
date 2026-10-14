import type { ManagedUser } from "@/types/user";

export const mockUsers: readonly ManagedUser[] = [
  { id: "u-aizhan", name: "Айжан Мамбетова", login: "aizhan.m", role: "admin", active: true, createdAt: "2026-01-12" },
  { id: "u-ulan", name: "Улан Эсенов", login: "ulan.e", role: "user", active: true, createdAt: "2026-02-03" },
  { id: "u-omur", name: "Өмүр Күмөш кызы", login: "omur.k", role: "user", active: true, createdAt: "2026-03-18" },
  { id: "u-nurbek", name: "Нурбек Асанов", login: "nurbek.a", role: "user", active: false, createdAt: "2026-04-02" },
  { id: "u-gulzat", name: "Гүлзат Токтогулова", login: "gulzat.t", role: "user", active: true, createdAt: "2026-05-21" },
  { id: "u-bakyt", name: "Бакыт Жумабаев", login: "bakyt.j", role: "admin", active: true, createdAt: "2026-06-09" },
];
