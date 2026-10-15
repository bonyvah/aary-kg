"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { validateNewUser, type AdminErrorCode } from "@/lib/adminUsers";
import type { ManagedUser, UserRole } from "@/types/user";

type CreateUserModalProps = {
  open: boolean;
  existing: readonly ManagedUser[];
  onClose: () => void;
  /** Rejects with ApiRequestError when the server says no. */
  onCreate: (input: { name: string; login: string; role: UserRole }) => Promise<void>;
};

const FORM_ID = "create-user-form";

export function CreateUserModal({ open, existing, onClose, onCreate }: CreateUserModalProps) {
  const t = useTranslations("admin.create");
  const te = useTranslations("admin.errors");
  const tr = useTranslations("admin.roles");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [errors, setErrors] = useState<{ name?: AdminErrorCode; login?: AdminErrorCode }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A fresh form every time it opens.
  useEffect(() => {
    if (open) {
      setName("");
      setLogin("");
      setRole("user");
      setErrors({});
      setFormError(null);
      setBusy(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateNewUser({ name, login }, existing);
    setErrors(found);
    setFormError(null);
    if (found.name || found.login) return;
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), login: login.trim().toLowerCase(), role });
    } catch (failure) {
      // The server checks the same rules: its answer for a field shows under that field.
      const known: readonly string[] = ["FIELD_REQUIRED", "LOGIN_INVALID", "LOGIN_TAKEN"];
      if (failure instanceof ApiRequestError && known.includes(failure.code) && (failure.field === "name" || failure.field === "login")) {
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
          <Button variant="neutral" onClick={onClose}>
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
          label={t("name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          error={errors.name ? te(errors.name) : undefined}
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
        <Select label={t("role")} value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
          <option value="user">{tr("user")}</option>
          <option value="admin">{tr("admin")}</option>
        </Select>
        {formError ? (
          <p role="alert" className="text-caption font-bold text-danger-text">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
