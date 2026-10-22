"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PencilSimple, Trash, UsersThree } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Table, Td, Th } from "@/components/ui/Table";
import * as api from "@/lib/api/groups";
import { toKnownCode } from "@/lib/api/client";
import { useDateTime } from "@/lib/useDateTime";
import type { Group } from "@/types/group";
import { ConfirmModal } from "./ConfirmModal";
import { GroupModal } from "./GroupModal";
import { ResourceView, useResource } from "./Resource";

type AdminGroupsProps = {
  /** The «add group» button above the tabs was pressed. */
  adding: boolean;
  onAddingClose: () => void;
  show: (variant: "success" | "danger", message: string) => void;
};

/** The groups tab of /admin: create, rename, delete. A group with students is not deleted. */
export function AdminGroups({ adding, onAddingClose, show }: AdminGroupsProps) {
  const t = useTranslations("admin.groups");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateTime = useDateTime();
  const resource = useResource(api.listGroups);
  // Kept here after a change, so the list doesn't reload (and flash) every time.
  const [changed, setChanged] = useState<readonly Group[] | null>(null);
  const [renaming, setRenaming] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = changed ?? (resource.state.status === "ready" ? resource.state.data : []);

  function sorted(list: readonly Group[]) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, locale));
  }

  async function save(name: string) {
    if (renaming) {
      const updated = await api.renameGroup(renaming.id, name);
      setChanged(sorted(groups.map((group) => (group.id === updated.id ? updated : group))));
      setRenaming(null);
      show("success", t("toast.renamed"));
    } else {
      const created = await api.createGroup(name);
      setChanged(sorted([...groups, created]));
      onAddingClose();
      show("success", t("toast.created"));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteGroup(deleting.id);
      setChanged(groups.filter((group) => group.id !== deleting.id));
      show("success", t("toast.deleted"));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
    }
    setBusy(false);
    setDeleting(null);
  }

  return (
    <>
      <ResourceView resource={resource} inline>
        {() =>
          groups.length === 0 ? (
            <EmptyState icon={UsersThree} title={t("empty")} />
          ) : (
            <Table className="min-w-[640px]">
              <thead>
                <tr>
                  <Th>{t("columns.name")}</Th>
                  <Th className="text-right">{t("columns.students")}</Th>
                  <Th>{t("columns.created")}</Th>
                  <Th>{t("columns.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <Td>
                      <span className="min-w-0 wrap-break-word font-bold">{group.name}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{group.studentCount}</Td>
                    <Td className="whitespace-nowrap">{dateTime(new Date(group.createdAt), { time: false })}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          aria-label={`${t("rename")}: ${group.name}`}
                          title={`${t("rename")}: ${group.name}`}
                          onClick={() => setRenaming(group)}
                        >
                          <Icon icon={PencilSimple} weight="bold" />
                        </Button>
                        <Button
                          variant="danger"
                          aria-label={`${t("delete")}: ${group.name}`}
                          title={`${t("delete")}: ${group.name}`}
                          onClick={() => setDeleting(group)}
                        >
                          <Icon icon={Trash} weight="bold" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </ResourceView>

      <GroupModal
        open={adding || renaming !== null}
        group={renaming}
        existing={groups}
        onClose={() => (renaming ? setRenaming(null) : onAddingClose())}
        onSave={save}
      />
      <ConfirmModal
        open={deleting !== null}
        title={t("confirmDelete.title")}
        body={t("confirmDelete.body", { name: deleting?.name ?? "" })}
        confirmLabel={t("confirmDelete.confirm")}
        cancelLabel={t("modal.cancel")}
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
