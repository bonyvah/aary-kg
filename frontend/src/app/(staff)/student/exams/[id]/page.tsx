import { StudentExamLoader } from "@/components/staff/StudentExamLoader";

export default async function StudentExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentExamLoader id={id} />;
}
