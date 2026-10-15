import { ResultsLoader } from "@/components/staff/ContestLoaders";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsLoader id={id} />;
}
