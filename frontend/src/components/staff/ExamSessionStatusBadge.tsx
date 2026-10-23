import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { ExamSessionStatus } from "@/types/examSession";

// Open is the live accent, closed is the done green, as on contests.
const variants: Record<ExamSessionStatus, BadgeVariant> = { open: "accent", closed: "success" };

export function ExamSessionStatusBadge({ status }: { status: ExamSessionStatus }) {
  const t = useTranslations("staff.examSession.status");
  return <Badge variant={variants[status]}>{t(status)}</Badge>;
}
