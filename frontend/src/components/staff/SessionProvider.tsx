"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { me, logout } from "@/lib/api/auth";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import type { KnownApiCode } from "@/lib/api/client";
import type { ManagedUser } from "@/types/user";
import { WarningCircle } from "@phosphor-icons/react";

type Session = {
  user: ManagedUser | null;
  signedIn: (user: ManagedUser) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

const LOGIN_PATH = "/login";

type State = { status: "loading" } | { status: "error"; code: KnownApiCode } | { status: "ready"; user: ManagedUser | null };

/**
 * Asks the backend who is signed in (the session is an httpOnly cookie the page can't read).
 * Every staff route except /login needs a user: without one it goes to /login.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", user: await me() });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) setState({ status: "ready", user: null });
      else setState({ status: "error", code: toKnownCode(error) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const user = state.status === "ready" ? state.user : null;
  const onLogin = pathname === LOGIN_PATH;

  useEffect(() => {
    if (state.status !== "ready") return;
    if (!user && !onLogin) router.replace(LOGIN_PATH);
    if (user && onLogin) router.replace("/dashboard");
  }, [state.status, user, onLogin, router]);

  const session: Session = {
    user,
    signedIn: (next) => setState({ status: "ready", user: next }),
    signOut: async () => {
      // Even if the call fails the user wants out: drop the local session and go to /login.
      await logout().catch(() => undefined);
      setState({ status: "ready", user: null });
      router.replace(LOGIN_PATH);
    },
  };

  if (state.status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <EmptyState
          icon={WarningCircle}
          title={t(`apiError.${state.code}`)}
          action={<Button onClick={() => void load()}>{t("retry")}</Button>}
        />
      </div>
    );
  }
  // Children only render when they are allowed to: no flash of a staff screen before a redirect.
  const allowed = state.status === "ready" && (onLogin ? !user : user !== null);
  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label={t("loading")} />
      </div>
    );
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** The session, or null outside the staff area (e.g. the /design gallery). */
export function useSession(): Session | null {
  return useContext(SessionContext);
}

/** The signed-in user. Only call it in screens behind the guard. */
export function useCurrentUser(): ManagedUser {
  const user = useContext(SessionContext)?.user;
  if (!user) throw new Error("useCurrentUser needs a signed-in staff session");
  return user;
}
