import { notFound } from "next/navigation";
import { ReportScreen } from "@/components/staff/ReportScreen";
import { getMockQuiz } from "@/mocks/quizzes";
import { buildMockReport } from "@/mocks/report";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = getMockQuiz(id);
  if (!quiz) notFound();
  return <ReportScreen report={buildMockReport(quiz)} />;
}
