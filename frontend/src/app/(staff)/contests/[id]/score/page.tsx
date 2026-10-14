import { notFound } from "next/navigation";
import { NoAccess } from "@/components/staff/NoAccess";
import { JuryScreen } from "@/components/staff/JuryScreen";
import { canScore } from "@/lib/contestScoring";
import { getMockContest } from "@/mocks/contests";
import { mockCurrentUser } from "@/mocks/staff";

export default async function ScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contest = getMockContest(id);
  if (!contest) notFound();
  if (!canScore(contest, mockCurrentUser.id)) return <NoAccess contestId={contest.id} />;
  return <JuryScreen contest={contest} />;
}
