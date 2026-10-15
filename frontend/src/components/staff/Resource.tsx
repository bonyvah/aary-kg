"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { toKnownCode } from "@/lib/api/client";
import type { KnownApiCode } from "@/lib/api/client";

type State<T> = { status: "loading" } | { status: "error"; code: KnownApiCode } | { status: "ready"; data: T };

/** Loads something from the API when the screen opens, and again on `reload`. */
export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  // The latest loader without making callers memoize it.
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await loadRef.current() });
    } catch (error) {
      setState({ status: "error", code: toKnownCode(error) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}

/** A failed load that is just «nothing there»: the link was old, or the item isn't yours. */
function isMissing(code: KnownApiCode) {
  return code === "QUIZ_NOT_FOUND" || code === "CONTEST_NOT_FOUND";
}

type ResourceViewProps<T> = {
  resource: ReturnType<typeof useResource<T>>;
  /** Part of a screen (a tab) instead of the whole page. */
  inline?: boolean;
  children: (data: T) => ReactNode;
};

/** Spinner while loading, a message with retry on failure, the screen when the data is here. */
export function ResourceView<T>({ resource, inline = false, children }: ResourceViewProps<T>) {
  const t = useTranslations("common");
  const { state, reload } = resource;
  if (state.status === "ready") return <>{children(state.data)}</>;
  return (
    <div className={inline ? "flex items-center justify-center py-8" : "flex min-h-dvh items-center justify-center p-4"}>
      {state.status === "loading" ? (
        <Spinner label={t("loading")} />
      ) : (
        <EmptyState
          icon={WarningCircle}
          title={t(`apiError.${state.code}`)}
          action={
            isMissing(state.code) ? (
              <ButtonLink href="/dashboard">{t("toDashboard")}</ButtonLink>
            ) : (
              <Button onClick={() => void reload()}>{t("retry")}</Button>
            )
          }
        />
      )}
    </div>
  );
}
