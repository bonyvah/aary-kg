import { HostLoader } from "@/components/game/HostLoader";

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HostLoader id={id} />;
}
