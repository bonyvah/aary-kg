import { LibraryQuizLoader } from "@/components/staff/LibraryQuizLoader";

export default async function LibraryQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryQuizLoader id={id} />;
}
