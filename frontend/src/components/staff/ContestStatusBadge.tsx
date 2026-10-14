import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { ContestStatus } from "@/types/contest";

// Draft is neutral, open is the live accent, closed is the done green (Badge README).
const variants: Record<ContestStatus, BadgeVariant> = { draft: "neutral", open: "accent", closed: "success" };

export function ContestStatusBadge({ status }: { status: ContestStatus }) {
  const t = useTranslations("contest.status");
  return <Badge variant={variants[status]}>{t(status)}</Badge>;
}
