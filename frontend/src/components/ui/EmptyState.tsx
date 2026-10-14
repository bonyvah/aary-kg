import type { ReactNode } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Icon } from "./Icon";
import { cx } from "@/lib/cx";

type EmptyStateProps = {
  icon: PhosphorIcon;
  /** Translated title: says what is empty. */
  title: string;
  /** Translated hint: says what to do next. */
  description?: string;
  /** At most one primary action. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center gap-2 px-4 py-8 text-center", className)}>
      <Icon icon={icon} weight="fill" size={48} className="text-ink-muted" />
      <h2 className="text-h3 font-bold">{title}</h2>
      {description ? <p className="max-w-[360px] text-body-lg text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
