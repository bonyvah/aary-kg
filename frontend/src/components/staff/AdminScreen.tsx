"use client";

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AvatarInitial } from "@/components/game/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Table, Td, Th } from "@/components/ui/Table";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/useToast";
import { generatePassword } from "@/lib/adminUsers";
import { mockContests } from "@/mocks/contests";
import { mockUsers } from "@/mocks/users";
import { mockCurrentUser } from "@/mocks/staff";
import type { ManagedUser, UserRole } from "@/types/user";
import { ConfirmModal } from "./ConfirmModal";
import { ContestsTable } from "./ContestsTable";
import { CreateUserModal } from "./CreateUserModal";
import { PasswordModal } from "./PasswordModal";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

type Pending =
  | { kind: "disable"; user: ManagedUser }
  | { kind: "reset"; user: ManagedUser }
  | null;

const TABS = ["users", "contests"] as const;
type Tab = (typeof TABS)[number];

export function AdminScreen() {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<Tab>("users");
  const idBase = useId();
  const format = useFormatter();
  const { toast, show } = useToast();
  const [users, setUsers] = useState<readonly ManagedUser[]>(mockUsers);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  // The password lives here only until the modal closes: it is never stored on the user.
  const [revealed, setRevealed] = useState<{ name: string; password: string } | null>(null);

  function createUser(input: { name: string; login: string; role: UserRole }) {
    const user: ManagedUser = {
      id: `u-${input.login}`,
      name: input.name,
      login: input.login,
      role: input.role,
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setUsers((current) => [...current, user]);
    setCreating(false);
    setRevealed({ name: user.name, password: generatePassword() });
    show("success", t("toast.created"));
  }

  function setActive(user: ManagedUser, active: boolean) {
    setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, active } : item)));
    show("success", t(active ? "toast.enabled" : "toast.disabled"));
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === "disable") setActive(pending.user, false);
    else setRevealed({ name: pending.user.name, password: generatePassword() });
    setPending(null);
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
          <ButtonLink href="/dashboard" variant="neutral">
            {t("toDashboard")}
          </ButtonLink>
          <StaffMenu name={mockCurrentUser.name} />
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
          className="max-w-[360px] flex-1"
        />
        {tab === "users" ? (
          <Button variant="accent" onClick={() => setCreating(true)}>
            {t("createUser")}
          </Button>
        ) : null}
      </div>

      <div id={panelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)}>
        {tab === "contests" ? (
          <ContestsTable contests={mockContests} />
        ) : (
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th>{t("columns.name")}</Th>
              <Th>{t("columns.login")}</Th>
              <Th>{t("columns.role")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th>{t("columns.created")}</Th>
              <Th>{t("columns.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === mockCurrentUser.id;
              return (
                <tr key={user.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <AvatarInitial name={user.name} />
                      <span className="min-w-0 break-words font-bold">{user.name}</span>
                    </span>
                  </Td>
                  <Td>{user.login}</Td>
                  <Td>
                    <Badge variant={user.role === "admin" ? "brand" : "neutral"}>{t(`roles.${user.role}`)}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={user.active ? "success" : "neutral"}>{t(user.active ? "status.active" : "status.disabled")}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      {user.active ? (
                        <Button
                          variant="neutral"
                          disabled={isSelf}
                          aria-describedby={isSelf ? `self-${user.id}` : undefined}
                          onClick={() => setPending({ kind: "disable", user })}
                        >
                          {t("actions.disable")}
                        </Button>
                      ) : (
                        <Button variant="neutral" onClick={() => setActive(user, true)}>
                          {t("actions.enable")}
                        </Button>
                      )}
                      <Button variant="neutral" onClick={() => setPending({ kind: "reset", user })}>
                        {t("actions.resetPassword")}
                      </Button>
                      {isSelf ? (
                        <span id={`self-${user.id}`} className="text-caption text-ink-muted">
                          {t("selfNote")}
                        </span>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        )}
      </div>

      <CreateUserModal open={creating} existing={users} onClose={() => setCreating(false)} onCreate={createUser} />
      <ConfirmModal
        open={pending !== null}
        title={t(pending?.kind === "reset" ? "confirmReset.title" : "confirmDisable.title")}
        body={t(pending?.kind === "reset" ? "confirmReset.body" : "confirmDisable.body", { name: pending?.user.name ?? "" })}
        confirmLabel={t(pending?.kind === "reset" ? "confirmReset.confirm" : "confirmDisable.confirm")}
        cancelLabel={t("cancel")}
        onConfirm={confirmPending}
        onClose={() => setPending(null)}
      />
      <PasswordModal
        open={revealed !== null}
        name={revealed?.name ?? ""}
        password={revealed?.password ?? ""}
        onCopy={() => void copyPassword()}
        onClose={() => setRevealed(null)}
      />
      {toast}
    </StaffShell>
  );
}
