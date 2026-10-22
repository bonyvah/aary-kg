"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/ssr";
import { Avatar } from "@/components/game/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { parseWhole } from "@/lib/adminGame";
import type { DetailAnswer, DetailPlayer, DetailQuestion } from "@/types/adminGame";

/** What the screen does for the modal. Each call answers with the whole game, the screen shows it. */
export type PlayerEditActions = {
  rename: (nickname: string) => Promise<void>;
  adjust: (delta: number) => Promise<void>;
  setScore: (score: number) => Promise<void>;
  editAnswer: (questionId: string, change: { correct: boolean; points: number }) => Promise<void>;
  clearFlag: (kind: string) => Promise<void>;
};

type PlayerEditModalProps = {
  open: boolean;
  player: DetailPlayer | null;
  questions: readonly DetailQuestion[];
  busy: boolean;
  onClose: () => void;
} & PlayerEditActions;

const BASE_POINTS = 500;

function AnswerRow({
  number,
  question,
  answer,
  busy,
  onSave,
}: {
  number: number;
  question: DetailQuestion;
  answer: DetailAnswer | undefined;
  busy: boolean;
  onSave: (change: { correct: boolean; points: number }) => Promise<void>;
}) {
  const t = useTranslations("admin.game.edit");
  const [correct, setCorrect] = useState(answer?.correct ?? false);
  const [points, setPoints] = useState(String(answer?.points ?? 0));
  const [invalid, setInvalid] = useState(false);

  // A saved change comes back from the server: show what it says.
  useEffect(() => {
    setCorrect(answer?.correct ?? false);
    setPoints(String(answer?.points ?? 0));
    setInvalid(false);
  }, [answer?.correct, answer?.points]);

  function toggle(next: boolean) {
    setCorrect(next);
    setPoints(next ? String(BASE_POINTS) : "0");
    setInvalid(false);
  }

  async function save() {
    const value = parseWhole(points);
    const fits = value !== null && (correct ? value >= 1 && value <= 1000 : value === 0);
    setInvalid(!fits);
    if (fits) await onSave({ correct, points: value });
  }

  const label = t("question", { number });
  return (
    <li className="flex flex-col gap-2 rounded-md bg-surface px-3 py-3">
      <p className="text-body font-bold [overflow-wrap:anywhere]">
        {label}. {question.text}
      </p>
      {answer ? (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Checkbox label={t("correct")} checked={correct} onChange={(event) => toggle(event.target.checked)} />
          <Input
            label={t("points")}
            inputMode="numeric"
            value={points}
            onChange={(event) => {
              setPoints(event.target.value);
              setInvalid(false);
            }}
            error={invalid ? t("pointsInvalid") : undefined}
            wrapperClassName="w-[140px]"
          />
          <Button variant="secondary" disabled={busy} onClick={() => void save()} aria-label={`${t("saveAnswer")}: ${label}`}>
            {t("saveAnswer")}
          </Button>
        </div>
      ) : (
        <p className="text-body text-ink-muted">{t("noAnswer")}</p>
      )}
    </li>
  );
}

/** Everything an admin may correct about one player of a finished game. */
export function PlayerEditModal({ open, player, questions, busy, onClose, rename, adjust, setScore, editAnswer, clearFlag }: PlayerEditModalProps) {
  const t = useTranslations("admin.game.edit");
  const tf = useTranslations("staff.report.flags");
  const format = useFormatter();
  const [nickname, setNickname] = useState("");
  const [delta, setDelta] = useState("");
  const [total, setTotal] = useState("");
  const [invalid, setInvalid] = useState<"delta" | "total" | null>(null);

  const playerId = player?.id;
  const savedNickname = player?.nickname ?? "";
  const savedScore = player?.score;
  useEffect(() => {
    setNickname(savedNickname);
  }, [playerId, savedNickname]);
  useEffect(() => {
    setDelta("");
    setTotal("");
    setInvalid(null);
  }, [playerId, savedScore]);

  async function applyDelta() {
    const value = parseWhole(delta);
    setInvalid(value === null || value === 0 ? "delta" : null);
    if (value !== null && value !== 0) await adjust(value);
  }

  async function applyTotal() {
    const value = parseWhole(total);
    setInvalid(value === null || value < 0 ? "total" : null);
    if (value !== null && value >= 0) await setScore(value);
  }

  return (
    <Modal
      wide
      open={open && player !== null}
      onClose={onClose}
      title={t("title", { nickname: savedNickname })}
      actions={
        <Button variant="neutral" onClick={onClose}>
          {t("close")}
        </Button>
      }
    >
      {player ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-wrap items-end gap-3">
            <Avatar character={player.character} size="lg" />
            <Input
              label={t("nickname")}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              wrapperClassName="min-w-[200px] flex-1"
              autoComplete="off"
            />
            <Button variant="secondary" disabled={busy || nickname.trim() === "" || nickname === player.nickname} onClick={() => void rename(nickname)}>
              {t("saveNickname")}
            </Button>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-h3 font-bold">{t("pointsTitle")}</h3>
            <p className="text-body text-ink-muted">{t("currentScore", { score: format.number(player.score) })}</p>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label={t("adjustLabel")}
                helper={t("adjustHelp")}
                inputMode="numeric"
                value={delta}
                onChange={(event) => setDelta(event.target.value)}
                error={invalid === "delta" ? t("numberInvalid") : undefined}
                wrapperClassName="w-[200px]"
              />
              <Button variant="secondary" disabled={busy} onClick={() => void applyDelta()}>
                {t("adjustApply")}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label={t("totalLabel")}
                inputMode="numeric"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                error={invalid === "total" ? t("numberInvalid") : undefined}
                wrapperClassName="w-[200px]"
              />
              <Button variant="secondary" disabled={busy} onClick={() => void applyTotal()}>
                {t("totalApply")}
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-h3 font-bold">{t("answersTitle")}</h3>
            <ol className="flex flex-col gap-2">
              {questions.map((question, index) => (
                <AnswerRow
                  key={`${player.id}-${question.id}`}
                  number={index + 1}
                  question={question}
                  answer={player.answers.find((answer) => answer.question === question.id)}
                  busy={busy}
                  onSave={(change) => editAnswer(question.id, change)}
                />
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-h3 font-bold">{t("flagsTitle")}</h3>
            {player.flags.length === 0 ? (
              <p className="text-body text-ink-muted">{t("noFlags")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {player.flags.map((flag) => (
                  <li key={flag.kind} className="flex items-center gap-1">
                    <Badge variant="danger" className="whitespace-normal">
                      {tf(flag.kind, { count: flag.count })}
                    </Badge>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void clearFlag(flag.kind)}
                      aria-label={t("clearFlag", { flag: tf(flag.kind, { count: flag.count }) })}
                    >
                      <Icon icon={X} weight="bold" size={20} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
