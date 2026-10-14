import type { SVGProps } from "react";

/** Pass a translated `aria-label` when the icon carries meaning, otherwise it is hidden from assistive tech. */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children">;

export function a11y(props: IconProps): IconProps {
  return props["aria-label"]
    ? { role: "img", ...props }
    : { "aria-hidden": true, focusable: false, ...props };
}
