"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LOGIN_PATTERN } from "@/lib/adminUsers";
import { isAccountCode } from "@/lib/account";
import { changeLogin } from "@/lib/api/auth";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import type { ManagedUser } from "@/types/user";

type ChangeLoginModalProps = {
  open: boolean;
  currentLogin: string;
  onClose: () => void;
  onChanged: (user: ManagedUser) => void;
};

const FORM_ID = "change-login-form";

/** A new login. The current password is asked again, so an open session left behind can't take the account over. */
export function ChangeLoginModal({ open, currentLogin, onClose, onChanged }: ChangeLoginModalProps) {
  const t = useTranslations("staff.account");
  const te = useTranslations("staff.account.errors");
  const tc = useTranslations("common");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ login?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setLogin(currentLogin);
      setPassword("");
      setErrors({});
      setBusy(false);
    }
  }, [open, currentLogin]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = login.trim().toLowerCase();
    const found: { login?: string; password?: string } = {};
    if (next === "") found.login = te("FIELD_REQUIRED");
    else if (!LOGIN_PATTERN.test(next)) found.login = te("LOGIN_INVALID");
    else if (next === currentLogin) found.login = te("NOTHING_TO_CHANGE");
    if (password === "") found.password = te("FIELD_REQUIRED");
    setErrors(found);
    if (found.login || found.password) return;
    setBusy(true);
    try {
      onChanged(await changeLogin(password, next));
    } catch (failure) {
      const code = failure instanceof ApiRequestError ? failure.code : "";
      if (isAccountCode(code) && failure instanceof ApiRequestError && failure.field === "login") setErrors({ login: te(code) });
      else if (isAccountCode(code) && failure instanceof ApiRequestError && failure.field === "currentPassword") setErrors({ password: te(code) });
      else setErrors({ form: tc(`apiError.${toKnownCode(failure)}`) });
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("login.title")}
      actions={
        <>
          <Button variant="neutral" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={busy}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t("login.label")}
          helper={t("login.help")}
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          error={errors.login}
        />
        <Input
          label={t("currentPassword")}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          error={errors.password}
        />
        {errors.form ? (
          <p role="alert" className="text-caption font-bold text-danger-text">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
