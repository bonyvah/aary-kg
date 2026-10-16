"use client";

import { homePath } from "@/lib/staffRoutes";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GameController } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconLink } from "@/components/ui/IconLink";
import { Input } from "@/components/ui/Input";
import { PlayerSettings } from "@/components/game/PlayerSettings";
import { login as signIn } from "@/lib/api/auth";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { useSession } from "./SessionProvider";
import { StaffShell } from "./StaffShell";

export function LoginScreen() {
  const t = useTranslations("staff.login");
  const tc = useTranslations("common");
  const router = useRouter();
  const session = useSession();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (login.trim() === "" || password === "") return setError(t("errors.CREDENTIALS_REQUIRED"));
    setBusy(true);
    try {
      const user = await signIn(login, password);
      session?.signedIn(user);
      router.push(homePath(user.role));
    } catch (failure) {
      const code = failure instanceof ApiRequestError ? failure.code : "";
      setError(code === "INVALID_CREDENTIALS" ? t("errors.INVALID_CREDENTIALS") : tc(`apiError.${toKnownCode(failure)}`));
      setBusy(false);
    }
  }

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-2">
          <IconLink href="/" label={t("joinGame")}>
            <Icon icon={GameController} weight="bold" size={28} />
          </IconLink>
          <PlayerSettings />
        </div>
      }
      className="items-center justify-center"
    >
      <Card className="w-full max-w-[400px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <h1 className="sr-only">{t("title")}</h1>
          <Input
            label={t("loginLabel")}
            placeholder={t("loginPlaceholder")}
            autoComplete="username"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
          />
          <Input
            label={t("passwordLabel")}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" size="lg" block disabled={busy}>
            {t("submit")}
          </Button>
        </form>
      </Card>
    </StaffShell>
  );
}
