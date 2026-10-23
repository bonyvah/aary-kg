import { ExamSessionLoader } from "@/components/staff/ExamSessionLoaders";

export default async function ExamSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamSessionLoader id={id} />;
}
