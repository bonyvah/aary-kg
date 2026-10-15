"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { useSession } from "./SessionProvider";
import { homePath } from "@/lib/staffRoutes";

/** The logo in the staff top bar: a link to the start page when signed in, plain on the login screen. */
export function StaffLogo() {
  const user = useSession()?.user;
  if (!user) return <Logo />;
  return (
    <Link
      href={homePath(user.role)}
      className="rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <Logo />
    </Link>
  );
}
