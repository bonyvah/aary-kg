"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type { NewUser } from "@/lib/api/adminUsers";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { validateNewUser, type AdminErrorCode, type NewUserField } from "@/lib/adminUsers";
import type { Group } from "@/types/group";
import type { ManagedUser } from "@/types/user";

type CreateUserModalProps = {
  /** Which account the modal makes, or null when closed. A student also gets a group. */
  role: NewUser["role"] | null;
  existing: readonly ManagedUser[];
  groups: readonly Group[];
  onClose: () => void;
  /** Rejects with ApiRequestError when the server says no. */
  onCreate: (input: NewUser) => Promise<void>;
};

const FORM_ID = "create-user-form";

export function CreateUserModal({ role, existing, groups, onClose, onCreate }: CreateUserModalProps) {
  const open = role !== null;
  const student = role === "student";
  const t = useTranslations("admin.create");
  const te = useTranslations("admin.errors");
  const tc = useTranslations("common");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [login, setLogin] = useState("");
  const [groupId, setGroupId] = useState("");
  const [errors, setErrors] = useState<Partial<Record<NewUserField, AdminErrorCode>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A fresh form every time it opens.
  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setLogin("");
      setGroupId("");
      setErrors({});
      setFormError(null);
      setBusy(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateNewUser({ firstName, lastName, login, groupId, student }, existing);
    setErrors(found);
    setFormError(null);
    if (found.firstName || found.lastName || found.login || found.groupId) return;
    setBusy(true);
    try {
      await onCreate({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        login: login.trim().toLowerCase(),
        role: role ?? "teacher",
        groupId: student ? groupId : null,
      });
    } catch (failure) {
      // The server checks the same rules: its answer for a field shows under that field.
      const known: readonly string[] = ["FIELD_REQUIRED", "LOGIN_INVALID", "LOGIN_TAKEN", "GROUP_REQUIRED"];
      if (failure instanceof ApiRequestError && known.includes(failure.code) && (failure.field === "firstName" || failure.field === "lastName" || failure.field === "login" || failure.field === "groupId")) {
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
      title={t(student ? "studentTitle" : "title")}
      actions={
        <>
          <Button variant="neutral" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="success" type="submit" form={FORM_ID} disabled={busy}>
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
        {student ? (
          <Select
            label={t("group")}
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            error={errors.groupId ? te(errors.groupId) : undefined}
          >
            <option value="" disabled>
              {t("groupPick")}
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        ) : null}
        {formError ? (
          <p role="alert" className="text-caption font-bold text-danger-text">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
