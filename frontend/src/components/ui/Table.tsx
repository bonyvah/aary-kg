import type { TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cx } from "@/lib/cx";

/** Native table markup (thead, tbody, tr) inside a flat bordered frame that scrolls sideways on phones. */
export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface-raised">
      <table
        className={cx(
          "w-full border-collapse text-left text-body text-ink",
          "[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-surface",
          className,
        )}
        {...rest}
      />
    </div>
  );
}

export function Th({ className, scope = "col", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cx("border-b-2 border-border px-4 py-3 text-body font-bold text-ink-muted", className)}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("border-b-2 border-border px-4 py-3", className)} {...rest} />;
}

/** The header of a column that numbers the rows. */
export function RowNumberTh() {
  const t = useTranslations("common");
  return <Th className="w-[64px] whitespace-nowrap">{t("rowNumber")}</Th>;
}

export function RowNumberTd({ number }: { number: number }) {
  const format = useFormatter();
  return <Td className="whitespace-nowrap font-bold text-ink-muted tabular-nums">{format.number(number)}</Td>;
}
