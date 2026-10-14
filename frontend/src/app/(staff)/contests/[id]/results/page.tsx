import { notFound } from "next/navigation";
import { ResultsNotReady } from "@/components/staff/ResultsNotReady";
import { ResultsScreen } from "@/components/staff/ResultsScreen";
import { getMockContest } from "@/mocks/contests";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contest = getMockContest(id);
  if (!contest) notFound();
  if (contest.status !== "closed") return <ResultsNotReady contestId={contest.id} />;
  return <ResultsScreen contest={contest} />;
}
