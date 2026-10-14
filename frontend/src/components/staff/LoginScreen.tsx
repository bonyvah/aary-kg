"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { mockLogin } from "@/lib/mockAuth";
import type { StaffErrorCode } from "@/types/staff";
import { StaffShell } from "./StaffShell";

export function LoginScreen() {
  const t = useTranslations("staff.login");
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<StaffErrorCode | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = mockLogin(login, password);
    setError(result);
    if (result === null) router.push("/dashboard");
  }

  return (
    <StaffShell topRight={<ButtonLink href="/" variant="neutral">{t("joinGame")}</ButtonLink>} className="items-center justify-center">
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
            error={error ? t(`errors.${error}`) : undefined}
          />
          <Button type="submit" size="lg" block>
            {t("submit")}
          </Button>
        </form>
      </Card>
    </StaffShell>
  );
}
