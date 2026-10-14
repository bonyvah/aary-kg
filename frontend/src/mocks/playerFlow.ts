import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Character } from "@/components/game/avatar/characters";
import type { PlayerQuestion, Standing } from "@/types/game";
import { mockPlayers } from "./design";

export const QUESTION_SECONDS = 20;
export const MOCK_PIN_NOT_FOUND = "000000";
/** Taken in the mock lobby, so the nickname screen can show the NICKNAME_TAKEN error. */
export const MOCK_TAKEN_NICKNAMES: readonly string[] = mockPlayers.map((player) => player.nickname);

type MockQuestion = PlayerQuestion & { correct: AnswerPosition };

const questions: readonly MockQuestion[] = [
  { index: 1, total: 3, text: "Кыргызстандын борбору кайсы шаар?", seconds: QUESTION_SECONDS, correct: 2 },
  { index: 2, total: 3, text: "Ысык-Көл Кыргызстандын кайсы облусунда жайгашкан?", seconds: QUESTION_SECONDS, correct: 1 },
  { index: 3, total: 3, text: "Манас эпосунун башкы каарманы ким?", seconds: QUESTION_SECONDS, correct: 4 },
];

export const MOCK_TOTAL_QUESTIONS = questions.length;

/** What the server would send when a question starts: no answer, no answer text. */
export function mockQuestion(index: number): PlayerQuestion | null {
  const question = questions[index - 1];
  if (!question) return null;
  const { correct, ...visible } = question;
  void correct;
  return visible;
}

/** What the server would send after the question closed. */
export function mockCorrectAnswer(index: number): AnswerPosition {
  return questions[index - 1]?.correct ?? 1;
}

/** Faster correct answers score more: 500 to 1000. Wrong or missing answers score nothing. */
export function mockPoints(correct: boolean, secondsLeft: number): number {
  return correct ? 500 + Math.max(0, secondsLeft) * 25 : 0;
}

const OPPONENT_SCALE = 0.25;

/** Opponents grow round by round; the player sits among them by their own score. */
export function mockStandings(
  round: number,
  you: { nickname: string; character: Character; score: number },
): Standing[] {
  const progress = Math.min(1, round / MOCK_TOTAL_QUESTIONS);
  const rows = [
    ...mockPlayers.map((player) => ({
      ...player,
      score: Math.round(player.score * OPPONENT_SCALE * progress),
      isYou: false,
    })),
    { id: "you", nickname: you.nickname, character: you.character, score: you.score, isYou: true },
  ];
  rows.sort((a, b) => b.score - a.score || Number(b.isYou) - Number(a.isYou));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
