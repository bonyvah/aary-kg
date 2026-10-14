"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { errorMessageKey } from "@/lib/playerFlow/errors";
import type { ErrorCode } from "@/types/game";
import { PlayerScreen } from "../PlayerScreen";

type NicknameScreenProps = {
  error: ErrorCode | null;
  onSubmit: (nickname: string) => void;
};

export function NicknameScreen({ error, onSubmit }: NicknameScreenProps) {
  const t = useTranslations("player");
  const [nickname, setNickname] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(nickname);
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
        </div>
        <Button type="submit" size="lg" block>
          {t("nickname.submit")}
        </Button>
      </form>
    </PlayerScreen>
  );
}
