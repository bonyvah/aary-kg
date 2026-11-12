import { SurveySheetLoader } from "@/components/staff/SurveySheetLoaders";

export default async function SurveySheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SurveySheetLoader id={id} />;
}
