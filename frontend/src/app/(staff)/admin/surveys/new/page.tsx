import { Suspense } from "react";
import { SurveyStartLoader } from "@/components/staff/SurveyLoaders";

export default function NewSurveyPage() {
  return (
    <Suspense>
      <SurveyStartLoader />
    </Suspense>
  );
}
