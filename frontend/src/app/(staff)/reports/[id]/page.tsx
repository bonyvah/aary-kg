import { ReportLoader } from "@/components/staff/ReportLoader";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportLoader id={id} />;
}
