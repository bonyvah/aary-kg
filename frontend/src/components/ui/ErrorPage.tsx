import type { ReactNode } from "react";
import { Warning } from "@phosphor-icons/react/ssr";
import { EmptyState } from "./EmptyState";

type ErrorPageProps = {
  title: string;
  description: string;
  action: ReactNode;
};

/** A whole-screen message on the game theme: for a missing page or a page that crashed. */
export function ErrorPage({ title, description, action }: ErrorPageProps) {
  return (
    <div data-theme="game" className="grid min-h-dvh place-items-center bg-surface p-4 text-ink">
      <EmptyState icon={Warning} title={title} description={description} action={action} />
    </div>
  );
}
