"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { toKnownCode } from "@/lib/api/client";
import type { Group } from "@/types/group";
import type { ManagedUser } from "@/types/user";

type MoveGroupModalProps = {
  /** The student being moved, or null when closed. */
  student: ManagedUser | null;
  groups: readonly Group[];
  onClose: () => void;
  /** Rejects with ApiRequestError when the server says no. */
  onMove: (groupId: string) => Promise<void>;
};

const FORM_ID = "move-group-form";

/** A student goes to another group. They are never left without one. */
export function MoveGroupModal({ student, groups, onClose, onMove }: MoveGroupModalProps) {
  const t = useTranslations("admin.moveGroup");
  const tc = useTranslations("common");
  const [groupId, setGroupId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (student) {
      setGroupId(student.groupId ?? "");
      setFormError(null);
      setBusy(false);
    }
  }, [student]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!groupId || groupId === student?.groupId) return onClose();
    setBusy(true);
    setFormError(null);
    try {
      await onMove(groupId);
    } catch (failure) {
      setFormError(tc(`apiError.${toKnownCode(failure)}`));
      setBusy(false);
    }
  }

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title={t("title", { name: student?.name ?? "" })}
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
        <Select label={t("group")} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
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
