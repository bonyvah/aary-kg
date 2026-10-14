import { notFound } from "next/navigation";
import { EditorScreen } from "@/components/staff/EditorScreen";
import { getMockQuiz } from "@/mocks/quizzes";

export default async function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = getMockQuiz(id);
  if (!quiz) notFound();
  return <EditorScreen quiz={quiz} />;
}
