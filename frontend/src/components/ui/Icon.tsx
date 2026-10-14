import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

type IconWrapperProps = {
  /** A Phosphor icon, e.g. `ArrowRight` from `@phosphor-icons/react/ssr`. */
  icon: PhosphorIcon;
  /** Only bold and fill are allowed by the design system. */
  weight?: "bold" | "fill";
  size?: number;
  /** Translated label. Leave out for decorative icons, which are hidden from assistive tech. */
  label?: string;
  className?: string;
};

export function Icon({ icon: Glyph, weight = "bold", size = 24, label, className }: IconWrapperProps) {
  return (
    <Glyph
      weight={weight}
      size={size}
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
