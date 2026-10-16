"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmModal } from "@/components/staff/ConfirmModal";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { Cheater, Ruling } from "@/lib/game/events";
import type { Standing } from "@/types/game";
import { Podium } from "./Podium";

/** The host's choices, in the order they are offered. */
const RULINGS: ReadonlyArray<{ action: Ruling; variant: ButtonVariant }> = [
  { action: "kick", variant: "danger" },
  { action: "zero", variant: "secondary" },
  { action: "void_last", variant: "secondary" },
  { action: "mercy", variant: "success" },
];

type HostPodiumScreenProps = {
  gameId: string;
  standings: readonly Standing[];
  /** Players the server flagged and the host has not ruled on. */
  cheaters: readonly Cheater[];
  onRule: (playerId: string, action: Ruling) => void;
};

/** The end of the game: the winners, the suspected cheaters with what to do about them, then the report or back to the dashboard. */
export function HostPodiumScreen({ gameId, standings, cheaters, onRule }: HostPodiumScreenProps) {
  const t = useTranslations("host.live");
  const tc = useTranslations("host.cheaters");
  const tf = useTranslations("staff.report.flags");
  const [pending, setPending] = useState<{ cheater: Cheater; action: Ruling } | null>(null);

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="text-center text-display font-black sm:text-display-xl">{t("winner")}</h1>
      <Podium className="w-full max-w-[640px]" players={standings.slice(0, 3)} crownLabel={t("crown")} />

      {cheaters.length > 0 ? (
        <section aria-labelledby="cheaters-title" className="flex w-full max-w-[900px] flex-col gap-4">
          <h2 id="cheaters-title" className="text-h2 font-black">
            {tc("title")}
          </h2>
          <ul className="flex flex-col gap-4">
            {cheaters.map((cheater) => (
              <li key={cheater.playerId} className="flex flex-col gap-3 rounded-lg bg-surface-raised p-4">
                <p className="text-h3 font-bold [overflow-wrap:anywhere]">{cheater.nickname}</p>
                <ul className="list-disc pl-6 text-body-lg">
                  {cheater.flags.map((flag) => (
                    <li key={flag.kind}>{tf(flag.kind, { count: flag.count })}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  {RULINGS.map(({ action, variant }) => (
                    <Button key={action} variant={variant} onClick={() => setPending({ cheater, action })}>
                      {tc(`actions.${action}`)}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-center gap-4 pb-4">
        <ButtonLink href={`/reports/${gameId}`} variant="accent" size="lg">
          {t("viewReport")}
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="neutral" size="lg">
          {t("toDashboard")}
        </ButtonLink>
      </div>

      <ConfirmModal
        open={pending !== null}
        title={pending ? tc(`actions.${pending.action}`) : ""}
        body={pending ? tc(`confirm.${pending.action}`, { nickname: pending.cheater.nickname }) : ""}
        confirmLabel={pending ? tc(`actions.${pending.action}`) : ""}
        cancelLabel={tc("cancel")}
        variant={pending?.action === "mercy" ? "success" : "danger"}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) onRule(pending.cheater.playerId, pending.action);
          setPending(null);
        }}
      />
    </div>
  );
}
