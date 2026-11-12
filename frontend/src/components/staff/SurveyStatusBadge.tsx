import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { SurveyStatus } from "@/types/survey";

// Open is the live accent, closed is the done green, as on exams.
const variants: Record<SurveyStatus, BadgeVariant> = { open: "accent", closed: "success" };

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  const t = useTranslations("admin.surveys.status");
  return <Badge variant={variants[status]}>{t(status)}</Badge>;
}
