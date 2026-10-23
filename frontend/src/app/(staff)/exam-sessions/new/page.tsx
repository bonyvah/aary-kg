import { Suspense } from "react";
import { ExamSessionSetupLoader } from "@/components/staff/ExamSessionLoaders";

export default function NewExamSessionPage() {
  return (
    <Suspense>
      <ExamSessionSetupLoader />
    </Suspense>
  );
}
