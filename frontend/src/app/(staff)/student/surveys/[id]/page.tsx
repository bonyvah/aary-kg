import { StudentSurveyLoader } from "@/components/staff/StudentSurveyLoader";

export default async function StudentSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentSurveyLoader id={id} />;
}
