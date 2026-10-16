"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmModal } from "@/components/staff/ConfirmModal";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import type { Cheater, Ruling } from "@/lib/game/events";

/** The host's choices, in the order they are offered. */
const RULINGS: ReadonlyArray<{ action: Ruling; variant: ButtonVariant }> = [
  { action: "kick", variant: "danger" },
  { action: "zero", variant: "secondary" },
  { action: "void_last", variant: "secondary" },
  { action: "mercy", variant: "success" },
];

type CheatersPanelProps = {
  /** Players who left their screen and have not been ruled on. The game waits for the host to decide each one. */
  cheaters: readonly Cheater[];
  onRule: (playerId: string, action: Ruling) => void;
};

/** The suspected cheaters, with the reasons and what to do about each of them (with a confirmation). */
export function CheatersPanel({ cheaters, onRule }: CheatersPanelProps) {
  const tc = useTranslations("host.cheaters");
  const tf = useTranslations("staff.report.flags");
  const [pending, setPending] = useState<{ cheater: Cheater; action: Ruling } | null>(null);

  if (cheaters.length === 0) return null;

  return (
    <>
      <section aria-labelledby="cheaters-title" className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
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
    </>
  );
}
