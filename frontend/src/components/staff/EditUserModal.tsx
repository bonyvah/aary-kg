"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Password } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { toKnownCode } from "@/lib/api/client";
import type { Group } from "@/types/group";
import type { ManagedUser } from "@/types/user";

type EditUserModalProps = {
  /** The user being edited, or null when closed. */
  user: ManagedUser | null;
  groups: readonly Group[];
  onClose: () => void;
  /** Rejects with ApiRequestError when the server says no. */
  onMove: (groupId: string) => Promise<void>;
  /** Rejects with ApiRequestError when the server says no. The new password opens on top. */
  onResetPassword: () => Promise<void>;
};

const FORM_ID = "edit-user-form";

/** A new password for anybody, another group for a student. A student is never left without one. */
export function EditUserModal({ user, groups, onClose, onMove, onResetPassword }: EditUserModalProps) {
  const t = useTranslations("admin.editUser");
  const tc = useTranslations("common");
  const [groupId, setGroupId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const student = user?.role === "student";

  useEffect(() => {
    if (user) {
      setGroupId(user.groupId ?? "");
      setFormError(null);
      setBusy(false);
    }
  }, [user]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFormError(null);
    try {
      await action();
    } catch (failure) {
      setFormError(tc(`apiError.${toKnownCode(failure)}`));
    }
    setBusy(false);
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
        <Button variant="secondary" className="self-start" disabled={busy} onClick={() => void run(onResetPassword)}>
          <Icon icon={Password} weight="bold" />
          {t("resetPassword")}
        </Button>
        {formError ? (
          <p role="alert" className="text-caption font-bold text-danger-text">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
