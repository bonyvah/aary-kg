import { Suspense } from "react";
import { NewQuizLoader } from "@/components/staff/QuizEditorLoader";

export default function NewQuizPage() {
  return (
    <Suspense>
      <NewQuizLoader />
    </Suspense>
  );
}
