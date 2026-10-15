"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/game/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Table, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/components/ui/useToast";
import * as api from "@/lib/api/adminGames";
import { toKnownCode } from "@/lib/api/client";
import { describeEdit } from "@/lib/adminGame";
import type { DetailPlayer, GameDetail } from "@/types/adminGame";
import { ConfirmModal } from "./ConfirmModal";
import { PlayerEditModal } from "./PlayerEditModal";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

type Pending = { kind: "removePlayer"; player: DetailPlayer } | { kind: "deleteGame" } | null;

/**
 * A finished game, open for corrections: points, answers, nicknames, who took part and the
 * anti-cheat signals. The quiz itself stays as it was. Every change is logged below and the host sees it.
 */
export function AdminGameScreen({ game: initial }: { game: GameDetail }) {
  const t = useTranslations("admin.game");
  const tc = useTranslations("common");
  const tf = useTranslations("staff.report.flags");
  const tn = useTranslations("admin.game.flagNames");
  const format = useFormatter();
  const router = useRouter();
  const { toast, show } = useToast();
  const [game, setGame] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const editing = game.players.find((player) => player.id === editingId) ?? null;

  /** Runs one change. The server answers with the whole game: totals and ranks are already recomputed. */
  async function change(call: () => Promise<GameDetail>, message: "saved" | "removed" = "saved") {
    setBusy(true);
    try {
      setGame(await call());
      show("success", t(`toast.${message}`));
    } catch (error) {
      const code = toKnownCode(error);
      show("danger", tc(`apiError.${code}`));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    const current = pending;
    setPending(null);
    if (current.kind === "removePlayer") {
      if (editingId === current.player.id) setEditingId(null);
      await change(() => api.removePlayer(game.gameId, current.player.id), "removed");
      return;
    }
    setBusy(true);
    try {
      await api.deleteGame(game.gameId);
      router.replace("/admin");
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
      setBusy(false);
    }
  }

  const signed = (value: number) => format.number(value, { signDisplay: "exceptZero" });
  const minutes = Math.max(1, Math.round(game.durationSeconds / 60));
  const pendingName = pending?.kind === "removePlayer" ? pending.player.nickname : "";

  return (
    <StaffShell topRight={<StaffMenu />}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{game.quizTitle}</h1>
          <p className="text-body text-ink-muted">
            {t("meta", {
              host: game.ownerName,
              date: format.dateTime(new Date(game.finishedAt), { dateStyle: "long", timeStyle: "short" }),
              minutes,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/admin" variant="secondary">
            {t("back")}
          </ButtonLink>
          <Button variant="danger" disabled={busy} onClick={() => setPending({ kind: "deleteGame" })}>
            {t("deleteGame")}
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold">{t("playersTitle")}</h2>
        <p className="text-body text-ink-muted">{t("note")}</p>
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th className="w-[64px]">{t("columns.rank")}</Th>
              <Th className="min-w-[200px]">{t("columns.player")}</Th>
              <Th className="text-right">{t("columns.score")}</Th>
              <Th>{t("columns.correct")}</Th>
              <Th>{t("columns.signals")}</Th>
              <Th>{t("columns.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {game.players.map((player) => (
              <tr key={player.id}>
                <Td className="font-black tabular-nums">{format.number(player.rank)}</Td>
                <Td>
                  <span className="flex items-center gap-3">
                    <Avatar character={player.character} />
                    <span className="min-w-0 break-words">{player.nickname}</span>
                  </span>
                </Td>
                <Td className="text-right tabular-nums">
                  <span className="font-bold">{format.number(player.score)}</span>
                  {player.adjustment !== 0 ? (
                    <span className="block text-caption text-ink-muted">{t("adjusted", { delta: signed(player.adjustment) })}</span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {t("correctOf", { correct: player.correct, total: game.questions.length })}
                </Td>
                <Td>
                  {player.flags.length === 0 ? (
                    <span aria-label={t("noSignals")}>—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {player.flags.map((flag) => (
                        <Badge key={flag.kind} variant="danger" className="whitespace-normal">
                          {tf(flag.kind, { count: flag.count })}
                        </Badge>
                      ))}
                    </span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="neutral" disabled={busy} onClick={() => setEditingId(player.id)}>
                      {t("editPlayer")}
                    </Button>
                    <Button variant="neutral" disabled={busy} onClick={() => setPending({ kind: "removePlayer", player })}>
                      {t("removePlayer")}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-3 pb-4">
        <h2 className="text-h2 font-bold">{t("logTitle")}</h2>
        {game.edits.length === 0 ? (
          <p className="text-body text-ink-muted">{t("logEmpty")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {[...game.edits].reverse().map((edit) => {
              const line = describeEdit(edit, game.questions);
              const values = { ...line.values };
              if (typeof values.delta === "number") values.delta = signed(values.delta);
              if (typeof values.kind === "string") values.kind = tn(values.kind);
              return (
                <li key={`${edit.at}-${edit.action}-${edit.nickname ?? ""}`} className="flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-surface-raised px-4 py-3">
                  <span className="text-body text-ink-muted">
                    {format.dateTime(new Date(edit.at), { dateStyle: "medium", timeStyle: "short" })} · {edit.adminName}
                  </span>
                  <span className="min-w-[200px] flex-1 text-body [overflow-wrap:anywhere]">{t(`log.${line.key}`, values)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <PlayerEditModal
        open={editing !== null}
        player={editing}
        questions={game.questions}
        busy={busy}
        onClose={() => setEditingId(null)}
        rename={(nickname) => change(() => api.renamePlayer(game.gameId, editing?.id ?? "", nickname))}
        adjust={(delta) => change(() => api.adjustScore(game.gameId, editing?.id ?? "", delta))}
        setScore={(score) => change(() => api.setScore(game.gameId, editing?.id ?? "", score))}
        editAnswer={(questionId, edit) => change(() => api.editAnswer(game.gameId, editing?.id ?? "", questionId, edit))}
        clearFlag={(kind) => change(() => api.clearFlag(game.gameId, editing?.id ?? "", kind))}
      />
      <ConfirmModal
        open={pending !== null}
        title={t(pending?.kind === "deleteGame" ? "confirmDelete.title" : "confirmRemove.title")}
        body={t(pending?.kind === "deleteGame" ? "confirmDelete.body" : "confirmRemove.body", { nickname: pendingName, title: game.quizTitle })}
        confirmLabel={t(pending?.kind === "deleteGame" ? "confirmDelete.confirm" : "confirmRemove.confirm")}
        cancelLabel={t("cancel")}
        busy={busy}
        onConfirm={() => void confirmPending()}
        onClose={() => setPending(null)}
      />
      {toast}
    </StaffShell>
  );
}
