/** Anonymous surveys: an admin writes a sheet, runs it as a survey for groups, students answer once. */

/** How many choices a multiple-select question takes: at least `min`, at most `max` (null: all of them). */
export type SelectLimit = { min: number; max: number | null };

type QuestionBase = { id: string; text: string; required: boolean };

export type SingleQuestion = QuestionBase & { kind: "single"; choices: string[] };
export type MultiQuestion = QuestionBase & { kind: "multi"; choices: string[]; limit: SelectLimit };
export type OpenQuestion = QuestionBase & { kind: "open"; maxWords: number };

export type SurveyQuestion = SingleQuestion | MultiQuestion | OpenQuestion;
export type SurveyQuestionKind = SurveyQuestion["kind"];

export type SurveySheet = { id: string; title: string; questions: SurveyQuestion[] };
export type SurveySheetSummary = { id: string; title: string; questionCount: number };

export type SurveyStatus = "open" | "closed";

export type SurveySummary = {
  id: string;
  title: string;
  status: SurveyStatus;
  openedAt: string;
  closedAt: string | null;
  groupNames: string[];
  studentCount: number;
  answeredCount: number;
};

/** A question and what was answered: `counts` per choice, or the open answers in a random order. */
export type QuestionResult = {
  question: SurveyQuestion;
  answered: number;
  counts: number[] | null;
  texts: string[] | null;
};

/** A student the survey is for and whether they answered, never what. */
export type SurveyStudent = { id: string; name: string; groupName: string | null; answered: boolean };

export type Survey = SurveySummary & {
  sheetId: string;
  groups: { id: string; name: string }[];
  results: QuestionResult[];
  students: SurveyStudent[];
};

/** A single choice is its number (1 to n), a multiple select the numbers, an open answer the text. */
export type SurveyAnswer = number | number[] | string;

export type StudentSurvey = {
  id: string;
  title: string;
  status: SurveyStatus;
  openedAt: string;
  closedAt: string | null;
  questionCount: number;
  answered: boolean;
  /** Only on its own page, while the survey is open (answered or not: the answers can be changed). */
  questions: SurveyQuestion[] | null;
  /** The answers sent so far, with the questions; null before the first send. */
  answers: Record<string, SurveyAnswer> | null;
};
