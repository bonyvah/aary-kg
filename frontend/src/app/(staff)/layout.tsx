import type { ReactNode } from "react";
import { SessionProvider } from "@/components/staff/SessionProvider";

/** Every staff screen sits on the game theme (purple ground), as in the screen designs. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="game" className="min-h-dvh bg-surface text-ink">
      <SessionProvider>{children}</SessionProvider>
    </div>
  );
}
