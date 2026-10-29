"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Password } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { generatePassword, NEW_USER_CODES, type AdminErrorCode } from "@/lib/adminUsers";
import { passwordProblem } from "@/lib/account";
import type { Group } from "@/types/group";
import type { ManagedUser } from "@/types/user";

type EditUserModalProps = {
  /** The user being edited, or null when closed. */
  user: ManagedUser | null;
  groups: readonly Group[];
  onClose: () => void;
  /** Rejects with ApiRequestError when the server says no. */
  onMove: (groupId: string) => Promise<void>;
  /** Blank: the server generates one. Rejects with ApiRequestError when the server says no. The new password opens on top. */
  onResetPassword: (password: string) => Promise<void>;
};

const FORM_ID = "edit-user-form";

/** A new password for anybody, typed or generated, another group for a student. A student is never left without one. */
export function EditUserModal({ user, groups, onClose, onMove, onResetPassword }: EditUserModalProps) {
  const t = useTranslations("admin.editUser");
  const tp = useTranslations("admin.create");
  const te = useTranslations("admin.errors");
  const tc = useTranslations("common");
  const [groupId, setGroupId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<AdminErrorCode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const student = user?.role === "student";

  useEffect(() => {
    if (user) {
      setGroupId(user.groupId ?? "");
      setPassword("");
      setPasswordError(null);
      setFormError(null);
      setBusy(false);
    }
  }, [user]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFormError(null);
    setPasswordError(null);
    try {
      await action();
    } catch (failure) {
      // The server checks the same rules: its answer for the password shows under that field.
      const known: readonly string[] = NEW_USER_CODES;
      if (failure instanceof ApiRequestError && failure.field === "password" && known.includes(failure.code)) {
        setPasswordError(failure.code as AdminErrorCode);
      } else {
        setFormError(tc(`apiError.${toKnownCode(failure)}`));
      }
    }
    setBusy(false);
  }

  function reset() {
    const problem = password ? passwordProblem(password) : null;
    setPasswordError(problem);
    if (problem) return;
    void run(() => onResetPassword(password));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!groupId || groupId === user?.groupId) return onClose();
    void run(() => onMove(groupId));
  }

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title={t("title", { name: user?.name ?? "" })}
      actions={
        student ? (
          <>
            <Button variant="neutral" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button variant="success" type="submit" form={FORM_ID} disabled={busy}>
              {t("submit")}
            </Button>
          </>
        ) : (
          <Button variant="neutral" onClick={onClose}>
            {t("close")}
          </Button>
        )
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {student ? (
          <Select label={t("group")} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Input
          label={tp("password")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            // Enter here sets the password, it doesn't save the group.
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (!busy) reset();
          }}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          wrapperClassName="w-full"
          error={passwordError ? te(passwordError) : undefined}
        />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setPassword(generatePassword())}>
            {tp("generate")}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={reset}>
            <Icon icon={Password} weight="bold" />
            {t("resetPassword")}
          </Button>
        </div>
        {formError ? (
          <p role="alert" className="text-caption font-bold text-danger-text">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
