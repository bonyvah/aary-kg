import type { Contest, Criterion, Entry, JuryMember, Score, ScoreSheet } from "../../src/types/contest.ts";

const criteria = (names: readonly [string, number][], prefix: string): Criterion[] =>
  names.map(([name, coefficient], index) => ({ id: `${prefix}-c${index + 1}`, name, coefficient }));

const entries = (items: readonly [string, string][], prefix: string): Entry[] =>
  items.map(([name, description], index) => ({ id: `${prefix}-e${index + 1}`, name, description }));

const jury = (members: readonly [string, string, boolean][]): JuryMember[] =>
  members.map(([userId, name, finished]) => ({ userId, name, finished }));

// The closed contest: three criteria (coefficients 4, 3, 3), five entries, three finished jury members.
// Entries 2 and 3 have identical scores from everyone, so they share the second place.
const closedCriteria = criteria(
  [
    ["Үн жана аткаруу", 4],
    ["Сахнадагы чыгармачылык", 3],
    ["Тандалган чыгарма", 3],
  ],
  "closed",
);
const closedEntries = entries(
  [
    ["Айдана Токтосунова", "«Ак мөөр» ыры, 3 мүнөт"],
    ["Бекболот Алиев", "Комуз менен аткаруу"],
    ["Гүлзат Мырзабекова", "Элдик бий жана ыр"],
    ["Нурсултан Эсенов", "Манас эпосунан үзүндү"],
    ["Жылдыз Орозова", "Заманбап ыр"],
  ],
  "closed",
);
const closedJury = jury([
  ["u-aizhan", "Айжан Мамбетова", true],
  ["u-omur", "Өмүр Күмөш кызы", true],
  ["u-gulzat", "Гүлзат Токтогулова", true],
]);

/** Per jury member, per entry, the scores of the three criteria. */
const closedRaw: Record<string, readonly (readonly [Score, Score, Score])[]> = {
  "u-aizhan": [[5, 4, 5], [4, 4, 4], [4, 4, 4], [3, 3, 4], [2, 3, 2]],
  "u-omur": [[5, 5, 4], [4, 3, 5], [4, 3, 5], [3, 4, 3], [3, 2, 2]],
  "u-gulzat": [[4, 5, 5], [5, 4, 4], [5, 4, 4], [4, 3, 3], [2, 2, 3]],
};

function sheetFrom(
  raw: Record<string, readonly (readonly Score[])[]>,
  contestCriteria: readonly Criterion[],
  contestEntries: readonly Entry[],
): ScoreSheet {
  const sheet: ScoreSheet = {};
  for (const [userId, perEntry] of Object.entries(raw)) {
    sheet[userId] = {};
    perEntry.forEach((values, entryIndex) => {
      const entry = contestEntries[entryIndex];
      if (!entry) return;
      const byCriterion: Record<string, Score> = {};
      values.forEach((value, criterionIndex) => {
        const criterion = contestCriteria[criterionIndex];
        if (criterion) byCriterion[criterion.id] = value;
      });
      (sheet[userId] as Record<string, Record<string, Score>>)[entry.id] = byCriterion;
    });
  }
  return sheet;
}

const openCriteria = criteria(
  [
    ["Идея", 1],
    ["Аткарылышы", 1],
  ],
  "open",
);
const openEntries = entries(
  [
    ["«Күз» сүрөтү", "Айылдын күзү, 9-класс"],
    ["«Тоолор» сүрөтү", "Ала-Тоо, 8-класс"],
    ["«Жайлоо» сүрөтү", "Жайлоодогу үй-бүлө, 10-класс"],
  ],
  "open",
);

export const mockContests: readonly Contest[] = [
  {
    id: "school-concert",
    title: "Мектеп концерти",
    description: "Мектептин жыл сайынкы концертине катышуучуларды тандоо.",
    status: "draft",
    ownerId: "u-aizhan",
    ownerName: "Айжан Мамбетова",
    criteria: criteria(
      [
        ["Аткаруу", 1.5],
        ["Артисттик", 1],
      ],
      "draft",
    ),
    entries: entries([["Класс 7А", "Бий"]], "draft"),
    jury: jury([["u-ulan", "Улан Эсенов", false]]),
    scores: {},
  },
  {
    id: "photo-contest",
    title: "Фото сынак: Кыргызстандын табияты",
    description: "Окуучулардын сүрөттөрү боюнча сынак.",
    status: "open",
    ownerId: "u-aizhan",
    ownerName: "Айжан Мамбетова",
    criteria: openCriteria,
    entries: openEntries,
    jury: jury([
      ["u-ulan", "Улан Эсенов", true],
      ["u-omur", "Өмүр Күмөш кызы", false],
      ["u-gulzat", "Гүлзат Токтогулова", false],
    ]),
    scores: sheetFrom({ "u-ulan": [[5, 4], [3, 3], [4, 5]] }, openCriteria, openEntries),
  },
  {
    id: "english-olympiad",
    title: "Англис тили олимпиадасы",
    description: "8–9-класстардын арасындагы олимпиада.",
    status: "open",
    ownerId: "u-ulan",
    ownerName: "Улан Эсенов",
    criteria: criteria(
      [
        ["Грамматика", 5],
        ["Сүйлөө", 3],
        ["Жазуу", 2],
      ],
      "english",
    ),
    entries: entries(
      [
        ["Эмир Садыков", "9-класс"],
        ["Алина Кадырова", "8-класс"],
        ["Тимур Бекматов", "9-класс"],
        ["Мээрим Асанова", "8-класс"],
      ],
      "english",
    ),
    jury: jury([
      ["u-aizhan", "Айжан Мамбетова", false],
      ["u-bakyt", "Бакыт Жумабаев", false],
    ]),
    scores: {},
  },
  {
    id: "singers",
    title: "Ырчылар сынагы",
    description: "Район аралык ырчылар сынагы.",
    status: "closed",
    ownerId: "u-ulan",
    ownerName: "Улан Эсенов",
    criteria: closedCriteria,
    entries: closedEntries,
    jury: closedJury,
    scores: sheetFrom(closedRaw, closedCriteria, closedEntries),
  },
];

export function getMockContest(id: string): Contest | null {
  return mockContests.find((contest) => contest.id === id) ?? null;
}

/** The contests a user owns or judges. */
export function contestsForUser(userId: string): Contest[] {
  return mockContests.filter(
    (contest) => contest.ownerId === userId || contest.jury.some((member) => member.userId === userId),
  );
}
