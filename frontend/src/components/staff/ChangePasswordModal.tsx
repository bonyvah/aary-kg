"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { isAccountCode, passwordProblem } from "@/lib/account";
import { changePassword } from "@/lib/api/auth";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import type { ManagedUser } from "@/types/user";

type ChangePasswordModalProps = {
  open: boolean;
  onClose: () => void;
  onChanged: (user: ManagedUser) => void;
};

const FORM_ID = "change-password-form";

type Errors = { current?: string; next?: string; again?: string; form?: string };

/** A new password. The rules are listed up front; the server also refuses a password that contains the person's name or login. */
export function ChangePasswordModal({ open, onClose, onChanged }: ChangePasswordModalProps) {
  const t = useTranslations("staff.account");
  const te = useTranslations("staff.account.errors");
  const tc = useTranslations("common");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setAgain("");
      setErrors({});
      setBusy(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    if (current === "") found.current = te("FIELD_REQUIRED");
    const problem = passwordProblem(next);
    if (problem) found.next = te(problem);
    else if (again !== next) found.again = te("PASSWORDS_DIFFER");
    setErrors(found);
    if (found.current || found.next || found.again) return;
    setBusy(true);
    try {
      onChanged(await changePassword(current, next));
    } catch (failure) {
      const code = failure instanceof ApiRequestError ? failure.code : "";
      const field = failure instanceof ApiRequestError ? failure.field : null;
      if (isAccountCode(code) && field === "currentPassword") setErrors({ current: te(code) });
      else if (isAccountCode(code) && field === "newPassword") setErrors({ next: te(code) });
      else setErrors({ form: tc(`apiError.${toKnownCode(failure)}`) });
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("password.title")}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
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
          label={t("currentPassword")}
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          error={errors.current}
        />
        <Input
          label={t("password.new")}
          helper={t("password.rules")}
          type="password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          error={errors.next}
        />
        <Input
          label={t("password.again")}
          type="password"
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          autoComplete="new-password"
          error={errors.again}
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
