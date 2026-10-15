import { ScoreLoader } from "@/components/staff/ContestLoaders";

export default async function ScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScoreLoader id={id} />;
}
