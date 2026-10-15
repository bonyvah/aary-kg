import { ContestLoader } from "@/components/staff/ContestLoaders";

export default async function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContestLoader id={id} />;
}
