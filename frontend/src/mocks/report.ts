import { mockJoiners, standingsAfter } from "@/mocks/hostGame";
import type { AntiCheatFlag, GameReport } from "@/types/report";
import type { Quiz } from "@/types/quiz";

/** Same pattern as standingsAfter: which players were right in which round. */
const isRight = (playerIndex: number, round: number) => (playerIndex * 7 + round * 3) % 10 < 6;

// A few players with signals, to show how the host sees them.
const flagsByNickname: Record<string, AntiCheatFlag[]> = {
  Нурбек: [{ kind: "TAB_BLUR", count: 4 }],
  Элмира: [
    { kind: "FAST_ANSWERS", count: 5 },
    { kind: "SAME_TIMING", count: 3 },
  ],
  Руслан: [{ kind: "PASTE", count: 2 }],
};

export function buildMockReport(quiz: Quiz): GameReport {
  const rounds = quiz.questions.length;
  const standings = standingsAfter(rounds, mockJoiners);

  const players = standings.map((row) => {
    const index = mockJoiners.findIndex((player) => player.id === row.id);
    let correct = 0;
    for (let round = 1; round <= rounds; round += 1) if (isRight(index, round)) correct += 1;
    return {
      id: row.id,
      nickname: row.nickname,
      character: row.character,
      rank: row.rank,
      score: row.score,
      correct,
      flags: flagsByNickname[row.nickname] ?? [],
    };
  });

  const questions = quiz.questions.map((question, position) => {
    const round = position + 1;
    const right = mockJoiners.filter((_, index) => isRight(index, round)).length;
    return { id: question.id, text: question.text, correctShare: right / mockJoiners.length };
  });

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    finishedAt: "2026-10-14T10:30:00",
    durationSeconds: rounds * 45,
    questionCount: rounds,
    players,
    questions,
  };
}
