import { useTranslations } from "next-intl";
import { Lock } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffShell } from "./StaffShell";

/** The viewer cannot score this contest: it is not open, or they are not on its jury. */
export function NoAccess({ contestId }: { contestId: string }) {
  const t = useTranslations("contest.score.noAccess");
  return (
    <StaffShell>
      <EmptyState
        icon={Lock}
        title={t("title")}
        description={t("description")}
        action={<ButtonLink href={`/contests/${contestId}`}>{t("back")}</ButtonLink>}
      />
    </StaffShell>
  );
}
