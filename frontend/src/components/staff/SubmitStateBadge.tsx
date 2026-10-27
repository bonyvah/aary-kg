import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { AttemptState, SubmitReason } from "@/types/examSession";

/** Where a student's attempt is: not started, writing, handed in, or ended by the time or the close. */
export function SubmitStateBadge({ state, reason }: { state: AttemptState; reason: SubmitReason | null }) {
  const t = useTranslations("staff.examSession.attendance");
  if (state === "in_progress") return <Badge variant="accent">{t("inProgress")}</Badge>;
  if (state === "none") return <Badge variant="neutral">{t("notStarted")}</Badge>;
  return <Badge variant="success">{t(reason === "timeout" ? "timeUp" : reason === "closed" ? "endedByClose" : "submitted")}</Badge>;
}
