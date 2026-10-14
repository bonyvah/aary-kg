import { useTranslations } from "next-intl";
import { Hourglass } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffShell } from "./StaffShell";

/** Results exist only once the contest is closed. */
export function ResultsNotReady({ contestId }: { contestId: string }) {
  const t = useTranslations("contest.results.notReady");
  return (
    <StaffShell>
      <EmptyState
        icon={Hourglass}
        title={t("title")}
        description={t("description")}
        action={<ButtonLink href={`/contests/${contestId}`}>{t("back")}</ButtonLink>}
      />
    </StaffShell>
  );
}
