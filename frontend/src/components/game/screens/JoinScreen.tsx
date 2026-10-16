"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { errorMessageKey } from "@/lib/playerFlow/errors";
import type { ErrorCode } from "@/types/game";
import { PlayerScreen } from "../PlayerScreen";

type JoinScreenProps = {
  error: ErrorCode | null;
  /** A PIN from the link or QR code the host showed (`/?pin=123456`). */
  initialPin?: string;
  onSubmit: (pin: string) => void;
};

export function JoinScreen({ error, initialPin = "", onSubmit }: JoinScreenProps) {
  const t = useTranslations("player");
  const [pin, setPin] = useState(initialPin);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(pin);
  }

  return (
    <PlayerScreen>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col justify-center gap-6">
          <h1 className="text-display font-black [overflow-wrap:anywhere]">{t("join.title")}</h1>
          <Input
            pin
            autoFocus
            label={t("join.pinLabel")}
            placeholder={t("join.pinPlaceholder")}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            error={error ? t(errorMessageKey[error]) : undefined}
          />
        </div>
        <Button type="submit" size="lg" block>
          {t("join.submit")}
        </Button>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center text-center font-bold underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {t("join.staffLogin")}
        </Link>
      </form>
    </PlayerScreen>
  );
}
