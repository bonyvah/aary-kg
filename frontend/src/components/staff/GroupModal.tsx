"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { GROUP_NAME_MAX, validateGroupName, type GroupNameError } from "@/lib/groups";
import type { Group } from "@/types/group";

type GroupModalProps = {
  open: boolean;
  /** The group being renamed, or null for a new one. */
  group: Group | null;
  existing: readonly Group[];
  onClose: () => void;
  /** Rejects with ApiRequestError when the server says no. */
  onSave: (name: string) => Promise<void>;
};

const FORM_ID = "group-form";

/** One name field: a new group, or a new name for one. */
export function GroupModal({ open, group, existing, onClose, onSave }: GroupModalProps) {
  const t = useTranslations("admin.groups.modal");
  const te = useTranslations("admin.groups.errors");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [error, setError] = useState<GroupNameError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A fresh form every time it opens, with the current name when renaming.
  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setError(null);
      setFormError(null);
      setBusy(false);
    }
  }, [open, group]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateGroupName(name, existing, group?.id);
    setError(found);
    setFormError(null);
    if (found) return;
    setBusy(true);
    try {
      await onSave(name.trim());
    } catch (failure) {
      // The server checks the same rules: its answer for the name shows under the field.
      if (failure instanceof ApiRequestError && (failure.code === "FIELD_REQUIRED" || failure.code === "GROUP_NAME_TAKEN")) {
        setError(failure.code);
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
      title={t(group ? "renameTitle" : "createTitle")}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={busy}>
            {t(group ? "submitRename" : "submitCreate")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t("name")}
          value={name}
          maxLength={GROUP_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          error={error ? te(error) : undefined}
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
