import { QuizViewLoader } from "@/components/staff/QuizViewLoader";

export default async function QuizViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizViewLoader id={id} />;
}
