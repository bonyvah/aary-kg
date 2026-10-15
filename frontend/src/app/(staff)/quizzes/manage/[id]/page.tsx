import { QuizEditorLoader } from "@/components/staff/QuizEditorLoader";

export default async function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizEditorLoader id={id} />;
}
