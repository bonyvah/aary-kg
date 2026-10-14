import { a11y, type IconProps } from "./types";

export function Cross(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...a11y(props)}>
      <path d="M9 9 23 23M23 9 9 23" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}
