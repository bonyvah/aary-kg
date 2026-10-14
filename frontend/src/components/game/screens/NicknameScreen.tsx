"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { errorMessageKey } from "@/lib/playerFlow/errors";
import { cx } from "@/lib/cx";
import type { ErrorCode } from "@/types/game";
import { Avatar, type AvatarId } from "../Avatar";
import { PlayerScreen } from "../PlayerScreen";

const AVATAR_IDS: readonly AvatarId[] = [0, 1, 2, 3, 4, 5, 6, 7];

type NicknameScreenProps = {
  error: ErrorCode | null;
  onSubmit: (nickname: string, avatar: AvatarId) => void;
};

export function NicknameScreen({ error, onSubmit }: NicknameScreenProps) {
  const t = useTranslations("player");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>(0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(nickname, avatar);
  }

  return (
    <PlayerScreen>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col gap-6">
          <h1 className="text-display font-black [overflow-wrap:anywhere]">{t("nickname.title")}</h1>
          <Input
            label={t("nickname.label")}
            placeholder={t("nickname.placeholder")}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            autoComplete="off"
            error={error ? t(errorMessageKey[error]) : undefined}
          />
          <div role="radiogroup" aria-labelledby="character-label" className="flex flex-col gap-2">
            <p id="character-label" className="text-body font-bold">
              {t("nickname.character")}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={avatar === id}
                  aria-label={t("nickname.characterOption", { number: id + 1 })}
                  onClick={() => setAvatar(id)}
                  className={cx(
                    "grid place-items-center rounded-md p-1 transition-transform duration-150 ease-out",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                    "aria-checked:outline-3 aria-checked:outline-offset-2 aria-checked:outline-focus-ring",
                  )}
                >
                  <Avatar avatar={id} size="lg" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button type="submit" size="lg" block>
          {t("nickname.submit")}
        </Button>
      </form>
    </PlayerScreen>
  );
}
