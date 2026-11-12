import { SurveyResultsLoader } from "@/components/staff/SurveyLoaders";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SurveyResultsLoader id={id} />;
}
