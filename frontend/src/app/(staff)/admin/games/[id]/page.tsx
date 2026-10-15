import { AdminGameLoader } from "@/components/staff/AdminGameLoader";

export default async function AdminGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminGameLoader id={id} />;
}
