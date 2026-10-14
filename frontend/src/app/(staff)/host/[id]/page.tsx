import { notFound } from "next/navigation";
import { HostFlow } from "@/components/game/HostFlow";
import { getMockQuiz } from "@/mocks/quizzes";

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = getMockQuiz(id);
  if (!quiz) notFound();
  return <HostFlow quiz={quiz} />;
}
