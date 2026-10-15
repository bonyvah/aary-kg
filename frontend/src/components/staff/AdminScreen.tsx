"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { AvatarInitial } from "@/components/game/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Table, Td, Th } from "@/components/ui/Table";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/useToast";
import * as api from "@/lib/api/adminUsers";
import { toKnownCode } from "@/lib/api/client";
import type { KnownApiCode } from "@/lib/api/client";
import { mockContests } from "@/mocks/contests";
import { WarningCircle } from "@phosphor-icons/react";
import type { ManagedUser, UserRole } from "@/types/user";
import { ConfirmModal } from "./ConfirmModal";
import { ContestsTable } from "./ContestsTable";
import { CreateUserModal } from "./CreateUserModal";
import { PasswordModal } from "./PasswordModal";
import { useCurrentUser } from "./SessionProvider";
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
  const tc = useTranslations("common");
  const router = useRouter();
  const me = useCurrentUser();
  const [tab, setTab] = useState<Tab>("users");
  const idBase = useId();
  const format = useFormatter();
  const { toast, show } = useToast();
  const [users, setUsers] = useState<readonly ManagedUser[] | null>(null);
  const [loadError, setLoadError] = useState<KnownApiCode | null>(null);
  const [creating, setCreating] = useState(false);
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

  // The server refuses non-admins too; this only keeps them off a screen that would show an error.
  const isAdmin = me.role === "admin";
  useEffect(() => {
    if (!isAdmin) router.replace("/dashboard");
    else void loadUsers();
  }, [isAdmin, router, loadUsers]);

  function fail(error: unknown) {
    show("danger", tc(`apiError.${toKnownCode(error)}`));
  }

  async function createUser(input: { name: string; login: string; role: UserRole }) {
    const created = await api.createUser(input);
    setUsers((current) => [...(current ?? []), created.user]);
    setCreating(false);
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

  async function confirmPending() {
    if (!pending) return;
    const { kind, user } = pending;
    setPending(null);
    if (kind === "disable") return setActive(user, false);
    try {
      const { password } = await api.resetPassword(user.id);
      setRevealed({ name: user.name, password });
    } catch (error) {
      fail(error);
    }
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
              const isSelf = user.id === me.id;
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

      <CreateUserModal open={creating} existing={users ?? []} onClose={() => setCreating(false)} onCreate={createUser} />
      <ConfirmModal
        open={pending !== null}
        title={t(pending?.kind === "reset" ? "confirmReset.title" : "confirmDisable.title")}
        body={t(pending?.kind === "reset" ? "confirmReset.body" : "confirmDisable.body", { name: pending?.user.name ?? "" })}
        confirmLabel={t(pending?.kind === "reset" ? "confirmReset.confirm" : "confirmDisable.confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => void confirmPending()}
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
