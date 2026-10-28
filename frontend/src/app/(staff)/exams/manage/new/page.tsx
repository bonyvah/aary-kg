import { Suspense } from "react";
import { NewExamLoader } from "@/components/staff/ExamEditorLoader";

export default function NewExamPage() {
  return (
    <Suspense>
      <NewExamLoader />
    </Suspense>
  );
}
