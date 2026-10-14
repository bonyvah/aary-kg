import { a11y, type IconProps } from "./types";

export function Check(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...a11y(props)}>
      <path d="M7 17 13 23 25 9" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
