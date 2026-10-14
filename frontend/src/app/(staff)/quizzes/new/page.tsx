import { EditorScreen } from "@/components/staff/EditorScreen";
import { newMockQuiz } from "@/mocks/quizzes";

export default function NewQuizPage() {
  return <EditorScreen quiz={newMockQuiz()} />;
}
