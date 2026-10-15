"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { validateNewUser, type AdminErrorCode, type NewUserField } from "@/lib/adminUsers";
import type { ManagedUser } from "@/types/user";

type CreateUserModalProps = {
  open: boolean;
  existing: readonly ManagedUser[];
  onClose: () => void;
  /** Rejects with ApiRequestError when the server says no. */
  onCreate: (input: { firstName: string; lastName: string; login: string }) => Promise<void>;
};

const FORM_ID = "create-user-form";

export function CreateUserModal({ open, existing, onClose, onCreate }: CreateUserModalProps) {
  const t = useTranslations("admin.create");
  const te = useTranslations("admin.errors");
  const tc = useTranslations("common");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [login, setLogin] = useState("");
  const [errors, setErrors] = useState<Partial<Record<NewUserField, AdminErrorCode>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A fresh form every time it opens.
  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setLogin("");
      setErrors({});
      setFormError(null);
      setBusy(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateNewUser({ firstName, lastName, login }, existing);
    setErrors(found);
    setFormError(null);
    if (found.firstName || found.lastName || found.login) return;
    setBusy(true);
    try {
      await onCreate({ firstName: firstName.trim(), lastName: lastName.trim(), login: login.trim().toLowerCase() });
    } catch (failure) {
      // The server checks the same rules: its answer for a field shows under that field.
      const known: readonly string[] = ["FIELD_REQUIRED", "LOGIN_INVALID", "LOGIN_TAKEN"];
      if (failure instanceof ApiRequestError && known.includes(failure.code) && (failure.field === "firstName" || failure.field === "lastName" || failure.field === "login")) {
        setErrors({ [failure.field]: failure.code as AdminErrorCode });
      } else {
        setFormError(tc(`apiError.${toKnownCode(failure)}`));
      }
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={busy}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t("firstName")}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="off"
          error={errors.firstName ? te(errors.firstName) : undefined}
        />
        <Input
          label={t("lastName")}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="off"
          error={errors.lastName ? te(errors.lastName) : undefined}
        />
        <Input
          label={t("login")}
          helper={t("loginHelp")}
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          error={errors.login ? te(errors.login) : undefined}
        />
        {formError ? (
          <p role="alert" className="text-caption font-bold text-danger-text">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
