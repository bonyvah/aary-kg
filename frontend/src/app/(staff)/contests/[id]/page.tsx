import { notFound } from "next/navigation";
import { ContestScreen } from "@/components/staff/ContestScreen";
import { getMockContest } from "@/mocks/contests";

export default async function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contest = getMockContest(id);
  if (!contest) notFound();
  return <ContestScreen contest={contest} />;
}
