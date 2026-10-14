import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Quiz, QuizQuestion, QuizStatus, QuizSummary } from "@/types/quiz";

export const DEFAULT_QUESTION_SECONDS = 20;

type Seed = { id: string; title: string; status: QuizStatus; questionCount: number };

const seeds: readonly Seed[] = [
  { id: "math-7", title: "Математика, 7-класс", status: "draft", questionCount: 5 },
  { id: "biology-9", title: "Биология, 9-класс", status: "draft", questionCount: 8 },
  { id: "history", title: "Кыргызстандын тарыхы", status: "ready", questionCount: 12 },
  { id: "manas", title: "Манас эпосу", status: "ready", questionCount: 20 },
  { id: "english-8", title: "Англис тили, 8-класс", status: "ready", questionCount: 15 },
  { id: "geography", title: "Борбор Азиянын географиясы", status: "ready", questionCount: 10 },
];

type Bank = Omit<QuizQuestion, "id" | "seconds">;

// A few sample questions, cycled to fill any quiz up to its question count.
const bank: readonly Bank[] = [
  { text: "Кыргызстандын борбору кайсы шаар?", answers: ["Ош", "Бишкек", "Жалал-Абад", "Каракол"], correct: 2 },
  { text: "Манас эпосу качан жаралган?", answers: ["IX кылым", "XV кылым", "XX кылым", "XII кылым"], correct: 1 },
  { text: "Ысык-Көл кайсы облуста?", answers: ["Нарын", "Талас", "Ысык-Көл", "Баткен"], correct: 3 },
  { text: "Эгемендүүлүк күнү качан?", answers: ["31-август", "1-май", "5-май", "7-ноябрь"], correct: 1 },
  { text: "Ысык-Көл облусунун административдик борбору кайсы шаар?", answers: ["Каракол", "Балыкчы", "Чолпон-Ата", "Тамчы"], correct: 1 },
  { text: "Кыргызстандагы эң бийик чоку кайсы?", answers: ["Жеңиш чокусу", "Ленин чокусу", "Хан-Тенгри", "Аламүдүн"], correct: 1 },
];

function buildQuestions(count: number): QuizQuestion[] {
  return Array.from({ length: count }, (_, index) => {
    const item = bank[index % bank.length] as Bank;
    return { ...item, id: `question-${index + 1}`, seconds: DEFAULT_QUESTION_SECONDS };
  });
}

export const mockQuizSummaries: readonly QuizSummary[] = seeds;

export function getMockQuiz(id: string): Quiz | null {
  const seed = seeds.find((item) => item.id === id);
  if (!seed) return null;
  return { id: seed.id, title: seed.title, status: seed.status, questions: buildQuestions(seed.questionCount) };
}

/** A new, empty quiz: one blank question so the editor has something to edit. */
export function newMockQuiz(): Quiz {
  const blank: AnswerPosition = 1;
  return {
    id: "new",
    title: "",
    status: "draft",
    questions: [
      { id: "question-1", text: "", answers: ["", "", "", ""], correct: blank, seconds: DEFAULT_QUESTION_SECONDS },
    ],
  };
}
