import { ExamEditorLoader } from "@/components/staff/ExamEditorLoader";

export default async function ExamEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamEditorLoader id={id} />;
}
