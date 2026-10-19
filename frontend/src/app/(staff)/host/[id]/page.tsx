import { HostLoader } from "@/components/game/HostLoader";

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A new quiz is a new game: nothing of the last one's screen is kept.
  return <HostLoader key={id} id={id} />;
}
