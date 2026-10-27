"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useDateTime } from "@/lib/useDateTime";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { Table, Td, Th } from "@/components/ui/Table";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/useToast";
import * as api from "@/lib/api/adminUsers";
import type { NewUser } from "@/lib/api/adminUsers";
import { listGroups } from "@/lib/api/groups";
import { listAllGames } from "@/lib/api/adminGames";
import { listAllContests } from "@/lib/api/contests";
import { listAllExamSessions } from "@/lib/api/examSessions";
import { toKnownCode } from "@/lib/api/client";
import type { KnownApiCode } from "@/lib/api/client";
import { CheckCircle, PencilSimple, Prohibit, WarningCircle } from "@phosphor-icons/react";
import type { Group } from "@/types/group";
import type { ManagedUser } from "@/types/user";
import { AdminExamsTable } from "./AdminExamsTable";
import { AdminGamesTable } from "./AdminGamesTable";
import { AdminGroups } from "./AdminGroups";
import { ConfirmModal } from "./ConfirmModal";
import { ContestsTable } from "./ContestsTable";
import { CreateUserModal } from "./CreateUserModal";
import { EditUserModal } from "./EditUserModal";
import { PasswordModal } from "./PasswordModal";
import { ResourceView, useResource } from "./Resource";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

type Pending = { kind: "disable"; user: ManagedUser } | null;

const TABS = ["users", "groups", "exams", "contests", "games"] as const;
type Tab = (typeof TABS)[number];

export function AdminScreen() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [tab, setTab] = useState<Tab>("users");
  const allContests = useResource(listAllContests);
  const allGames = useResource(listAllGames);
  const allExams = useResource(listAllExamSessions);
  const idBase = useId();
  const dateTime = useDateTime();
  const { toast, show } = useToast();
  const [users, setUsers] = useState<readonly ManagedUser[] | null>(null);
  const [loadError, setLoadError] = useState<KnownApiCode | null>(null);
  const [creating, setCreating] = useState<NewUser["role"] | null>(null);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [groups, setGroups] = useState<readonly Group[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  // The password lives here only until the modal closes: it is never stored on the user.
  const [revealed, setRevealed] = useState<{ name: string; password: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadError(null);
    try {
      setUsers(await api.listUsers());
    } catch (error) {
      setLoadError(toKnownCode(error));
    }
  }, []);

  // The session guard keeps non-admins out of /admin; the server refuses them too.
  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function fail(error: unknown) {
    show("danger", tc(`apiError.${toKnownCode(error)}`));
  }

  // Groups are read fresh each time a student is added or moved: they change on the groups tab.
  async function withGroups(open: () => void) {
    try {
      setGroups(await listGroups());
      open();
    } catch (error) {
      fail(error);
    }
  }

  async function createUser(input: NewUser) {
    const created = await api.createUser(input);
    setUsers((current) => [...(current ?? []), created.user]);
    setCreating(null);
    setRevealed({ name: created.user.name, password: created.password });
    show("success", t("toast.created"));
  }

  async function setActive(user: ManagedUser, active: boolean) {
    try {
      const updated = await api.setUserActive(user.id, active);
      setUsers((current) => (current ?? []).map((item) => (item.id === updated.id ? updated : item)));
      show("success", t(active ? "toast.enabled" : "toast.disabled"));
    } catch (error) {
      fail(error);
    }
  }

  async function moveToGroup(groupId: string) {
    if (!editing) return;
    const updated = await api.moveToGroup(editing.id, groupId);
    setUsers((current) => (current ?? []).map((item) => (item.id === updated.id ? updated : item)));
    setEditing(null);
    show("success", t("toast.moved"));
  }

  async function resetPassword() {
    if (!editing) return;
    const { password } = await api.resetPassword(editing.id);
    setRevealed({ name: editing.name, password });
  }

  async function confirmPending() {
    if (!pending) return;
    setPending(null);
    return setActive(pending.user, false);
  }

  async function copyPassword() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.password);
      show("success", t("toast.copied"));
    } catch {
      show("danger", t("toast.copyFailed"));
    }
  }

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <StaffMenu />
        </div>
      }
    >
      <h1 className="sr-only">{t("title")}</h1>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          idBase={idBase}
          label={t("tabsLabel")}
          tabs={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))}
          value={tab}
          onChange={setTab}
          className="max-w-[820px] flex-1"
        />
        {tab === "users" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="success" onClick={() => setCreating("teacher")}>
              {t("createTeacher")}
            </Button>
            <Button variant="success" onClick={() => void withGroups(() => setCreating("student"))}>
              {t("createStudent")}
            </Button>
          </div>
        ) : tab === "groups" ? (
          <Button variant="success" onClick={() => setAddingGroup(true)}>
            {t("groups.add")}
          </Button>
        ) : null}
      </div>

      <div id={panelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)}>
        {tab === "groups" ? (
          <AdminGroups adding={addingGroup} onAddingClose={() => setAddingGroup(false)} show={show} />
        ) : tab === "games" ? (
          <ResourceView resource={allGames} inline>
            {(items) => <AdminGamesTable games={items} />}
          </ResourceView>
        ) : tab === "exams" ? (
          <ResourceView resource={allExams} inline>
            {(items) => <AdminExamsTable exams={items} />}
          </ResourceView>
        ) : tab === "contests" ? (
          <ResourceView resource={allContests} inline>
            {(items) => <ContestsTable contests={items} />}
          </ResourceView>
        ) : loadError ? (
          <EmptyState
            icon={WarningCircle}
            title={tc(`apiError.${loadError}`)}
            action={<Button onClick={() => void loadUsers()}>{tc("retry")}</Button>}
          />
        ) : users === null ? (
          <div className="flex justify-center py-8">
            <Spinner label={tc("loading")} />
          </div>
        ) : (
        <Table className="min-w-[960px]">
          <thead>
            <tr>
              <Th>{t("columns.name")}</Th>
              <Th>{t("columns.login")}</Th>
              <Th>{t("columns.role")}</Th>
              <Th>{t("columns.group")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th>{t("columns.created")}</Th>
              <Th>{t("columns.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              // Other admins are listed for information only: the server refuses any action on them.
              const isAdminUser = user.role === "admin";
              return (
                <tr key={user.id}>
                  <Td>
                    <span className="min-w-0 wrap-break-word font-bold">{user.name}</span>
                  </Td>
                  <Td>{user.login}</Td>
                  <Td>
                    <Badge variant={user.role === "admin" ? "brand" : "neutral"}>{t(`roles.${user.role}`)}</Badge>
                  </Td>
                  <Td>{user.groupName ?? ""}</Td>
                  <Td>
                    <Badge variant={user.active ? "success" : "neutral"}>{t(user.active ? "status.active" : "status.disabled")}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {dateTime(new Date(user.createdAt), { time: false })}
                  </Td>
                  <Td>
                    {isAdminUser ? null : (
                      <div className="flex flex-wrap items-center gap-2">
                        {user.active ? (
                          <Button
                            variant="danger"
                            aria-label={`${t("actions.disable")}: ${user.name}`}
                            title={`${t("actions.disable")}: ${user.name}`}
                            onClick={() => setPending({ kind: "disable", user })}
                          >
                            <Icon icon={Prohibit} weight="bold" />
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            aria-label={`${t("actions.enable")}: ${user.name}`}
                            title={`${t("actions.enable")}: ${user.name}`}
                            onClick={() => setActive(user, true)}
                          >
                            <Icon icon={CheckCircle} weight="bold" />
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          aria-label={`${t("actions.edit")}: ${user.name}`}
                          title={`${t("actions.edit")}: ${user.name}`}
                          onClick={() => void (user.role === "student" ? withGroups(() => setEditing(user)) : setEditing(user))}
                        >
                          <Icon icon={PencilSimple} weight="bold" />
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        )}
      </div>

      <CreateUserModal role={creating} existing={users ?? []} groups={groups} onClose={() => setCreating(null)} onCreate={createUser} />
      <EditUserModal
        user={editing}
        groups={groups}
        onClose={() => setEditing(null)}
        onMove={moveToGroup}
        onResetPassword={resetPassword}
      />
      <ConfirmModal
        open={pending !== null}
        title={t("confirmDisable.title")}
        body={t("confirmDisable.body", { name: pending?.user.name ?? "" })}
        confirmLabel={t("confirmDisable.confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => void confirmPending()}
        onClose={() => setPending(null)}
      />
      <PasswordModal
        open={revealed !== null}
        name={revealed?.name ?? ""}
        password={revealed?.password ?? ""}
        onCopy={() => void copyPassword()}
        onClose={() => {
          setRevealed(null);
          setEditing(null);
        }}
      />
      {toast}
    </StaffShell>
  );
}
